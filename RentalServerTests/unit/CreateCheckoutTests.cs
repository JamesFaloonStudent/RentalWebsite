using RentalServerTests.Support;
using RentalWebsite.Models;
using RentalWebsite.Services;

namespace RentalServerTests.Unit;


// StripeService.CreateCheckoutAsync: validation, server-side pricing, double-booking, Stripe call shape.
public sealed class CreateCheckoutTests : IDisposable
{
    private readonly StripeTestContext _t = new();
    private readonly string _user;
    private readonly string _rental;

    public CreateCheckoutTests()
    {
        _user = _t.SeedUser();
        _rental = _t.SeedRental(pricePerDay: 100f); // 10 000 cents per day
    }

    public void Dispose() => _t.Dispose();

    private static DateOnly InDays(int n) => StripeTestContext.Today.AddDays(n);

    private Task<CheckoutResponse> Checkout(int startInDays, int endInDays, string? rental = null, string? user = null) =>
        _t.NewService().CreateCheckoutAsync(user ?? _user,
            new CreateCheckoutRequest(rental ?? _rental, InDays(startInDays), InDays(endInDays)));

    // ---- validation ----

    [Fact]
    public async Task Rejects_start_date_in_the_past()
    {
        var ex = await Assert.ThrowsAsync<PaymentException>(() => Checkout(-1, 2));
        Assert.Equal(PaymentErrorKind.Validation, ex.Kind);
    }

    [Theory]
    [InlineData(5, 5)]   // zero nights
    [InlineData(5, 4)]   // end before start
    [InlineData(1, 367)] // more than 365 nights
    public async Task Rejects_invalid_length(int start, int end)
    {
        var ex = await Assert.ThrowsAsync<PaymentException>(() => Checkout(start, end));
        Assert.Equal(PaymentErrorKind.Validation, ex.Kind);
    }

    [Fact]
    public async Task Allows_starting_today_and_exactly_365_nights()
    {
        await Checkout(0, 1);
        await Checkout(10, 375);
    }

    [Fact]
    public async Task Unknown_rental_is_not_found()
    {
        var ex = await Assert.ThrowsAsync<PaymentException>(() => Checkout(1, 3, rental: "nope"));
        Assert.Equal(PaymentErrorKind.NotFound, ex.Kind);
    }

    [Fact]
    public async Task Hidden_rental_is_not_found()
    {
        var hidden = _t.SeedRental("hidden", visible: false);
        var ex = await Assert.ThrowsAsync<PaymentException>(() => Checkout(1, 3, rental: hidden));
        Assert.Equal(PaymentErrorKind.NotFound, ex.Kind);
    }

    [Fact]
    public async Task Unknown_user_is_not_found()
    {
        var ex = await Assert.ThrowsAsync<PaymentException>(() => Checkout(1, 3, user: "ghost"));
        Assert.Equal(PaymentErrorKind.NotFound, ex.Kind);
    }

    [Fact]
    public async Task Rental_with_no_price_cannot_be_booked()
    {
        var free = _t.SeedRental("free", pricePerDay: 0f);
        var ex = await Assert.ThrowsAsync<PaymentException>(() => Checkout(1, 3, rental: free));
        Assert.Equal(PaymentErrorKind.Validation, ex.Kind);
    }

    [Fact]
    public async Task Missing_base_url_fails_before_a_booking_is_created()
    {
        _t.Settings.Remove("APP_BASE_URL");
        _t.NewService();

        await Assert.ThrowsAsync<InvalidOperationException>(() => _t.Service.CreateCheckoutAsync(
            _user, new CreateCheckoutRequest(_rental, InDays(1), InDays(3))));

        using var db = _t.NewDb();
        Assert.Empty(db.Bookings);
    }

    // ---- pricing ----

    [Fact]
    public async Task Total_is_unit_price_times_nights_computed_on_the_server()
    {
        var result = await Checkout(1, 4); // 3 nights

        var booking = _t.GetBooking(result.BookingId);
        Assert.Equal(10000, booking.UnitPriceCents);
        Assert.Equal(30000, booking.TotalAmountCents);
        Assert.Equal(3, booking.Days);
        Assert.Equal("cad", booking.Currency);

        var payment = Assert.Single(_t.GetPayments(result.BookingId));
        Assert.Equal(30000, payment.AmountCents);
        Assert.Equal("30000", _t.Stripe.RequestsTo(HttpMethod.Post, "/v1/checkout/sessions")
            .Single().Form["line_items[0][price_data][unit_amount]"]);
    }

    [Fact]
    public async Task Fractional_prices_are_rounded_to_whole_cents()
    {
        var rental = _t.SeedRental("fractional", pricePerDay: 123.45f);
        var result = await Checkout(1, 2, rental: rental);
        Assert.Equal(12345, _t.GetBooking(result.BookingId).UnitPriceCents);
    }

    // ---- what is persisted and sent to Stripe ----

    [Fact]
    public async Task Creates_pending_booking_pending_payment_and_returns_the_stripe_url()
    {
        var result = await Checkout(1, 3);

        var booking = _t.GetBooking(result.BookingId);
        Assert.Equal(BookingStatus.PendingPayment, booking.Status);
        Assert.Equal(_user, booking.UserId);
        Assert.True(booking.ExpiresAt > DateTime.UtcNow.AddMinutes(30));

        var payment = Assert.Single(_t.GetPayments(result.BookingId));
        Assert.Equal(PaymentStatus.Pending, payment.Status);
        Assert.Equal(_t.Stripe.SessionForBooking(result.BookingId).Id, payment.StripeCheckoutSessionId);
        Assert.Equal(_t.Stripe.SessionForBooking(result.BookingId).Url, result.Url);
    }

    [Fact]
    public async Task Sends_booking_metadata_urls_and_idempotency_key_to_stripe()
    {
        var result = await Checkout(1, 3);

        var request = _t.Stripe.RequestsTo(HttpMethod.Post, "/v1/checkout/sessions").Single();
        Assert.Equal("payment", request.Form["mode"]);
        Assert.Equal(result.BookingId, request.Form["metadata[bookingId]"]);
        Assert.Equal(result.BookingId, request.Form["payment_intent_data[metadata][bookingId]"]);
        Assert.Equal(result.BookingId, request.Form["client_reference_id"]);
        Assert.Equal($"checkout-{result.BookingId}", request.IdempotencyKey);
        Assert.Equal($"https://rentals.example.test/my-rentals?booking={result.BookingId}&checkout=success", request.Form["success_url"]);
        Assert.StartsWith("https://rentals.example.test/listings/rental-1/book", request.Form["cancel_url"]);
    }

    [Fact]
    public async Task Creates_the_stripe_customer_once_and_reuses_it()
    {
        await Checkout(1, 2);
        await Checkout(5, 6);

        var customerCalls = _t.Stripe.RequestsTo(HttpMethod.Post, "/v1/customers").ToList();
        Assert.Single(customerCalls);
        Assert.Equal($"customer-{_user}", customerCalls[0].IdempotencyKey);

        using var db = _t.NewDb();
        var customerId = db.Users.Single(u => u.Id == _user).StripeCustomerId;
        Assert.NotNull(customerId);
        Assert.All(_t.Stripe.Sessions.Values, s => Assert.Equal(customerId, s.Customer));
    }

    // ---- double-booking ----

    [Theory]
    [InlineData(12, 14, true)]  // overlaps the end of the existing booking
    [InlineData(9, 11, true)]   // overlaps the start
    [InlineData(8, 15, true)]   // encloses it
    [InlineData(11, 12, true)]  // inside it
    [InlineData(10, 13, true)]  // identical
    [InlineData(13, 15, false)] // starts the day it ends (half-open ranges)
    [InlineData(8, 10, false)]  // ends the day it starts
    public async Task Overlap_with_a_confirmed_booking(int start, int end, bool conflicts)
    {
        _t.SeedBooking(_rental, _user, InDays(10), InDays(13), BookingStatus.Confirmed);

        if (conflicts)
        {
            var ex = await Assert.ThrowsAsync<PaymentException>(() => Checkout(start, end));
            Assert.Equal(PaymentErrorKind.Conflict, ex.Kind);
        }
        else
        {
            await Checkout(start, end);
        }
    }

    [Fact]
    public async Task An_unexpired_unpaid_booking_blocks_the_dates()
    {
        _t.SeedBooking(_rental, _user, InDays(10), InDays(13), BookingStatus.PendingPayment, expiresAt: DateTime.UtcNow.AddMinutes(10));
        var ex = await Assert.ThrowsAsync<PaymentException>(() => Checkout(10, 13));
        Assert.Equal(PaymentErrorKind.Conflict, ex.Kind);
    }

    [Theory]
    [InlineData(BookingStatus.Cancelled)]
    [InlineData(BookingStatus.Expired)]
    [InlineData(BookingStatus.Refunded)]
    public async Task Released_bookings_do_not_block_the_dates(BookingStatus status)
    {
        _t.SeedBooking(_rental, _user, InDays(10), InDays(13), status);
        await Checkout(10, 13);
    }

    [Fact]
    public async Task A_lapsed_unpaid_hold_does_not_block_the_dates()
    {
        _t.SeedBooking(_rental, _user, InDays(10), InDays(13), BookingStatus.PendingPayment, expiresAt: DateTime.UtcNow.AddMinutes(-1));
        await Checkout(10, 13);
    }

    [Fact]
    public async Task The_same_dates_on_another_rental_are_free()
    {
        var other = _t.SeedRental("rental-2");
        _t.SeedBooking(_rental, _user, InDays(10), InDays(13), BookingStatus.Confirmed);
        await Checkout(10, 13, rental: other);
    }

    // ---- Stripe failure ----

    [Fact]
    public async Task Stripe_failure_releases_the_dates_and_reports_upstream_error()
    {
        _t.Stripe.FailPathContaining = "/v1/checkout/sessions";

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Checkout(1, 3));
        Assert.Equal(PaymentErrorKind.Upstream, ex.Kind);
        Assert.DoesNotContain("Simulated", ex.Message); // Stripe's text is never shown to the client

        using var db = _t.NewDb();
        var booking = Assert.Single(db.Bookings);
        Assert.Equal(BookingStatus.Expired, booking.Status);
        Assert.Empty(db.Payments);

        // The same dates can be booked again straight away once Stripe is back.
        _t.Stripe.FailPathContaining = null;
        await Checkout(1, 3);
    }
}
