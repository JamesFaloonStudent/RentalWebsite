using System.Security.Claims;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using RentalServerTests.Support;
using RentalWebsite.Controllers;
using RentalWebsite.Models;
using RentalWebsite.Services;

namespace RentalServerTests.Unit;


// BookingService / BookingsController: the customer's own booking list and single-booking reads.
public sealed class BookingsReadTests : IDisposable
{
    private readonly StripeTestContext _t = new();
    private readonly string _alice;
    private readonly string _bob;
    private readonly string _rental;

    public BookingsReadTests()
    {
        _alice = _t.SeedUser("alice");
        _bob = _t.SeedUser("bob");
        _rental = _t.SeedRental();
    }

    public void Dispose() => _t.Dispose();

    private BookingService NewService() => new(_t.NewDb());

    private BookingsController NewController(string userId, bool isAdmin = false)
    {
        var claims = new List<Claim> { new(ClaimTypes.NameIdentifier, userId) };
        if (isAdmin)
        {
            claims.Add(new Claim(ClaimTypes.Role, "Admin"));
        }

        return new BookingsController(NewService())
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext
                {
                    User = new ClaimsPrincipal(new ClaimsIdentity(claims, "test", ClaimTypes.Name, ClaimTypes.Role))
                }
            }
        };
    }

    [Fact]
    public async Task List_is_empty_when_the_user_has_no_bookings()
    {
        Assert.Empty(await NewService().ListMineAsync(_alice, default));
    }

    [Fact]
    public async Task List_returns_only_the_callers_bookings_newest_first()
    {
        var older = _t.SeedBooking(_rental, _alice, BookingsDate(10), BookingsDate(12));
        await Task.Delay(5);
        var newer = _t.SeedBooking(_rental, _alice, BookingsDate(20), BookingsDate(22));
        _t.SeedBooking(_rental, _bob, BookingsDate(30), BookingsDate(32));

        var result = await NewService().ListMineAsync(_alice, default);

        Assert.Equal([newer.Id, older.Id], result.Select(b => b.BookingId));
    }

    [Fact]
    public async Task List_for_an_admin_is_still_only_their_own_bookings()
    {
        _t.SeedBooking(_rental, _bob, BookingsDate(10), BookingsDate(12));

        Assert.Empty(await NewService().ListMineAsync("staff", default));
    }

    [Fact]
    public async Task Summary_carries_rental_details_and_latest_payment_without_stripe_ids()
    {
        var (booking, payment) = _t.SeedPaidBooking(_rental, _alice, daysUntilStart: 15, amountCents: 20000);

        var result = Assert.Single(await NewService().ListMineAsync(_alice, default));

        Assert.Equal(booking.Id, result.BookingId);
        Assert.Equal(_rental, result.RentalId);
        Assert.Equal("Test Boat", result.RentalName);
        Assert.Equal("Confirmed", result.Status);
        Assert.Equal(20000, result.TotalAmountCents);
        Assert.Equal("cad", result.Currency);
        Assert.NotNull(result.Payment);
        Assert.Equal(payment.Status.ToString(), result.Payment.Status);
        Assert.Equal(0, result.Payment.AmountRefundedCents);
    }

    [Fact]
    public async Task Booking_without_a_payment_has_no_payment_summary()
    {
        _t.SeedBooking(_rental, _alice, BookingsDate(10), BookingsDate(12), BookingStatus.PendingPayment);

        var result = Assert.Single(await NewService().ListMineAsync(_alice, default));

        Assert.Null(result.Payment);
        Assert.Equal("PendingPayment", result.Status);
    }

    [Fact]
    public async Task List_is_capped()
    {
        using (var db = _t.NewDb())
        {
            for (var i = 0; i < BookingService.MaxResults + 5; i++)
            {
                db.Bookings.Add(new Booking
                {
                    RentalId = _rental,
                    UserId = _alice,
                    StartDate = BookingsDate(10),
                    EndDate = BookingsDate(11),
                    Days = 1,
                    ExpiresAt = DateTime.UtcNow
                });
            }

            db.SaveChanges();
        }

        Assert.Equal(BookingService.MaxResults, (await NewService().ListMineAsync(_alice, default)).Count);
    }

    [Fact]
    public async Task Owner_can_get_their_booking()
    {
        var booking = _t.SeedBooking(_rental, _alice, BookingsDate(10), BookingsDate(12));

        var result = await NewService().GetAsync(_alice, false, booking.Id, default);

        Assert.Equal(booking.Id, result.BookingId);
    }

    [Fact]
    public async Task Another_user_gets_not_found_not_forbidden()
    {
        var booking = _t.SeedBooking(_rental, _alice, BookingsDate(10), BookingsDate(12));

        var ex = await Assert.ThrowsAsync<PaymentException>(() => NewService().GetAsync(_bob, false, booking.Id, default));

        Assert.Equal(PaymentErrorKind.NotFound, ex.Kind);
    }

    [Fact]
    public async Task Admin_can_get_anyones_booking()
    {
        var booking = _t.SeedBooking(_rental, _alice, BookingsDate(10), BookingsDate(12));

        var result = await NewService().GetAsync("staff", true, booking.Id, default);

        Assert.Equal(booking.Id, result.BookingId);
    }

    [Fact]
    public async Task Controller_maps_missing_and_foreign_ids_to_the_same_404()
    {
        var booking = _t.SeedBooking(_rental, _alice, BookingsDate(10), BookingsDate(12));

        var foreign = Assert.IsType<NotFoundObjectResult>(await NewController(_bob).Get(booking.Id, default));
        var missing = Assert.IsType<NotFoundObjectResult>(await NewController(_bob).Get("nope", default));

        Assert.Equal(missing.Value!.ToString(), foreign.Value!.ToString());
    }

    [Fact]
    public async Task Controller_lists_for_the_signed_in_user()
    {
        var booking = _t.SeedBooking(_rental, _alice, BookingsDate(10), BookingsDate(12));
        _t.SeedBooking(_rental, _bob, BookingsDate(30), BookingsDate(32));

        var ok = Assert.IsType<OkObjectResult>(await NewController(_alice).GetMine(default));
        var list = Assert.IsType<List<BookingSummaryResponse>>(ok.Value);

        Assert.Equal(booking.Id, Assert.Single(list).BookingId);
    }

    private static DateOnly BookingsDate(int daysFromToday) => StripeTestContext.Today.AddDays(daysFromToday);
}
