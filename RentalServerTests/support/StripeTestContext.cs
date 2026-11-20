using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RentalWebsite.Controllers;
using RentalWebsite.Database;
using RentalWebsite.Models;
using RentalWebsite.Services;
using Stripe;

namespace RentalServerTests.Support;


// One isolated "server": a private in-memory SQLite database, a fake Stripe, and a way to
// create services/controllers the way the DI container would (new DbContext per request).
public sealed class StripeTestContext : IDisposable
{
    public const string WebhookSecret = "whsec_test_secret";

    private readonly SqliteConnection _connection;

    public StripeTestContext(Action<BookingOptions>? configure = null)
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        using var db = NewDb();
        db.Database.EnsureCreated();

        configure?.Invoke(Options);
        Service = NewService();
    }

    public FakeStripeHandler Stripe { get; } = new();
    public BookingOptions Options { get; } = new();

    // Mutable before NewService() is called; remove a key to simulate missing configuration.
    public Dictionary<string, string?> Settings { get; } = new()
    {
        ["STRIPE_WEBHOOK_SECRET"] = WebhookSecret,
        ["APP_BASE_URL"] = "https://rentals.example.test/"
    };

    public StripeService Service { get; private set; }

    public static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    public RentalDbContext NewDb() =>
        new(new DbContextOptionsBuilder<RentalDbContext>().UseSqlite(_connection).Options);

    // Equivalent of one HTTP request's scope: fresh DbContext, same database and same fake Stripe.
    public StripeService NewService()
    {
        var client = new StripeClient(
            apiKey: "sk_test_fake",
            httpClient: new SystemNetHttpClient(new HttpClient(Stripe), maxNetworkRetries: 0));

        var config = new ConfigurationBuilder().AddInMemoryCollection(Settings).Build();

        Service = new StripeService(
            client, NewDb(), config, Microsoft.Extensions.Options.Options.Create(Options),
            NullLogger<StripeService>.Instance);
        return Service;
    }

    public StripeController NewController(string userId, bool isAdmin = false, StripeService? service = null)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId) };
        if (isAdmin)
        {
            claims.Add(new Claim(ClaimTypes.Role, "Admin"));
        }

        var identity = new ClaimsIdentity(claims, "test", ClaimTypes.Name, ClaimTypes.Role);
        return new StripeController(service ?? NewService(), NullLogger<StripeController>.Instance)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext { User = new ClaimsPrincipal(identity) }
            }
        };
    }

    // ---- seeding ----

    public string SeedUser(string id = "user-1")
    {
        using var db = NewDb();
        db.Users.Add(new User
        {
            Id = id,
            UserName = $"{id}@example.test",
            NormalizedUserName = $"{id}@EXAMPLE.TEST".ToUpperInvariant(),
            Email = $"{id}@example.test"
        });
        db.SaveChanges();
        return id;
    }

    public string SeedRental(string id = "rental-1", float pricePerDay = 100f, bool visible = true)
    {
        using var db = NewDb();
        db.Rentals.Add(new Rental { id = id, name = "Test Boat", pricePerDay = pricePerDay, visible = visible });
        db.SaveChanges();
        return id;
    }

    public Booking SeedBooking(
        string rentalId, string userId, DateOnly start, DateOnly end,
        BookingStatus status = BookingStatus.Confirmed, DateTime? expiresAt = null, long totalCents = 10000)
    {
        using var db = NewDb();
        var booking = new Booking
        {
            RentalId = rentalId,
            UserId = userId,
            StartDate = start,
            EndDate = end,
            Days = Math.Max(1, end.DayNumber - start.DayNumber),
            UnitPriceCents = totalCents,
            TotalAmountCents = totalCents,
            Status = status,
            ExpiresAt = expiresAt ?? DateTime.UtcNow.AddMinutes(30)
        };
        db.Bookings.Add(booking);
        db.SaveChanges();
        return booking;
    }

    // A confirmed, fully paid booking that starts `daysUntilStart` days from today.
    public (Booking Booking, Payment Payment) SeedPaidBooking(
        string rentalId, string userId, int daysUntilStart, long amountCents = 10000)
    {
        var start = Today.AddDays(daysUntilStart);
        var booking = SeedBooking(rentalId, userId, start, start.AddDays(2), BookingStatus.Confirmed, totalCents: amountCents);

        using var db = NewDb();
        var payment = new Payment
        {
            BookingId = booking.Id,
            StripeCheckoutSessionId = $"cs_seed_{Guid.NewGuid():N}",
            StripePaymentIntentId = $"pi_seed_{Guid.NewGuid():N}",
            StripeChargeId = $"ch_seed_{Guid.NewGuid():N}",
            AmountCents = amountCents,
            Status = PaymentStatus.Succeeded,
            PaidAt = DateTime.UtcNow
        };
        db.Payments.Add(payment);
        db.SaveChanges();

        // Let the fake know about the charge so refunds against it are accepted.
        Stripe.Sessions[payment.StripeCheckoutSessionId] = new FakeSession
        {
            Id = payment.StripeCheckoutSessionId,
            BookingId = booking.Id,
            AmountCents = amountCents,
            Status = "complete",
            PaymentStatus = "paid",
            PaymentIntentId = payment.StripePaymentIntentId,
            ChargeId = payment.StripeChargeId
        };

        return (booking, payment);
    }

    // ---- reading back persisted state through a fresh DbContext ----

    public Booking GetBooking(string id)
    {
        using var db = NewDb();
        return db.Bookings.AsNoTracking().Single(b => b.Id == id);
    }

    public List<Payment> GetPayments(string bookingId)
    {
        using var db = NewDb();
        return [.. db.Payments.AsNoTracking().Where(p => p.BookingId == bookingId).OrderBy(p => p.CreatedAt)];
    }

    public Payment GetPayment(string id)
    {
        using var db = NewDb();
        return db.Payments.AsNoTracking().Single(p => p.Id == id);
    }

    public List<RentalWebsite.Models.Refund> GetRefunds()
    {
        using var db = NewDb();
        return [.. db.Refunds.AsNoTracking()];
    }

    public bool WebhookEventRecorded(string eventId)
    {
        using var db = NewDb();
        return db.StripeWebhookEvents.Any(e => e.Id == eventId);
    }

    public void Dispose()
    {
        _connection.Dispose();
        GC.SuppressFinalize(this);
    }
}
