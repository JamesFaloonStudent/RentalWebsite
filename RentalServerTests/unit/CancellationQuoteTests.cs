using RentalServerTests.Support;
using RentalWebsite.Models;
using RentalWebsite.Services;

namespace RentalServerTests.Unit;


// GetCancellationQuoteAsync / BuildQuote / GetCancellablePayment: the late-cancellation fee rule.
// Defaults under test: 7-day window, 25 % fee.
public sealed class CancellationQuoteTests : IDisposable
{
    private readonly StripeTestContext _t;
    private readonly string _user;
    private readonly string _rental;

    public CancellationQuoteTests() : this(null) { }

    private CancellationQuoteTests(Action<BookingOptions>? configure)
    {
        _t = new StripeTestContext(configure);
        _user = _t.SeedUser();
        _rental = _t.SeedRental();
    }

    public void Dispose() => _t.Dispose();

    private Task<CancellationQuote> Quote(string bookingId, string? user = null, bool admin = false) =>
        _t.NewService().GetCancellationQuoteAsync(user ?? _user, admin, bookingId);

    [Theory]
    [InlineData(30, false, 0, 10000)]
    [InlineData(14, false, 0, 10000)]
    [InlineData(7, false, 0, 10000)]   // exactly 7 days out is still free
    [InlineData(6, true, 2500, 7500)]  // one day inside the window
    [InlineData(1, true, 2500, 7500)]
    [InlineData(0, true, 2500, 7500)]  // starts today: allowed, but with the fee
    public async Task Fee_depends_on_days_until_the_start_date(int daysUntilStart, bool late, long fee, long refund)
    {
        var (booking, _) = _t.SeedPaidBooking(_rental, _user, daysUntilStart, amountCents: 10000);

        var quote = await Quote(booking.Id);

        Assert.Equal(late, quote.LateCancellation);
        Assert.Equal(fee, quote.FeeCents);
        Assert.Equal(refund, quote.RefundCents);
        Assert.Equal(10000, quote.PaidCents);
        Assert.Equal(7, quote.CancellationWindowDays);
        Assert.Equal(25m, quote.FeePercent);
        Assert.Equal("cad", quote.Currency);
    }

    [Fact]
    public async Task Cancelling_after_the_rental_has_started_is_rejected()
    {
        var (booking, _) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: -1);

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Quote(booking.Id));
        Assert.Equal(PaymentErrorKind.Conflict, ex.Kind);
    }

    [Theory]
    [InlineData(1002, 251, 751)]  // 250.5 rounds away from zero
    [InlineData(3333, 833, 2500)] // 833.25 rounds down
    [InlineData(1, 0, 1)]         // 0.25 rounds to nothing
    public async Task Fee_is_rounded_to_whole_cents_and_fee_plus_refund_equals_paid(long paid, long fee, long refund)
    {
        var (booking, _) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: 2, amountCents: paid);

        var quote = await Quote(booking.Id);

        Assert.Equal(fee, quote.FeeCents);
        Assert.Equal(refund, quote.RefundCents);
        Assert.Equal(paid, quote.FeeCents + quote.RefundCents);
    }

    [Fact]
    public async Task Quote_has_no_side_effects()
    {
        var (booking, payment) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: 2);
        var requestsBefore = _t.Stripe.Requests.Count;

        await Quote(booking.Id);

        Assert.Equal(requestsBefore, _t.Stripe.Requests.Count); // Stripe not called
        Assert.Equal(BookingStatus.Confirmed, _t.GetBooking(booking.Id).Status);
        Assert.Equal(PaymentStatus.Succeeded, _t.GetPayment(payment.Id).Status);
        Assert.Empty(_t.GetRefunds());
    }

    [Fact]
    public async Task Fee_percent_is_configurable()
    {
        using var t = new StripeTestContext(o => o.LateCancellationFeePercent = 50);
        var user = t.SeedUser();
        var (booking, _) = t.SeedPaidBooking(t.SeedRental(), user, daysUntilStart: 2);

        var quote = await t.NewService().GetCancellationQuoteAsync(user, false, booking.Id);

        Assert.Equal(5000, quote.FeeCents);
        Assert.Equal(5000, quote.RefundCents);
    }

    [Fact]
    public async Task A_one_hundred_percent_fee_leaves_nothing_to_refund()
    {
        using var t = new StripeTestContext(o => o.LateCancellationFeePercent = 100);
        var user = t.SeedUser();
        var (booking, _) = t.SeedPaidBooking(t.SeedRental(), user, daysUntilStart: 2);

        var quote = await t.NewService().GetCancellationQuoteAsync(user, false, booking.Id);

        Assert.Equal(10000, quote.FeeCents);
        Assert.Equal(0, quote.RefundCents);
    }

    [Fact]
    public async Task Window_is_configurable()
    {
        using var t = new StripeTestContext(o => o.CancellationWindowDays = 14);
        var user = t.SeedUser();
        var (booking, _) = t.SeedPaidBooking(t.SeedRental(), user, daysUntilStart: 10);

        var quote = await t.NewService().GetCancellationQuoteAsync(user, false, booking.Id);

        Assert.True(quote.LateCancellation);
        Assert.Equal(14, quote.CancellationWindowDays);
    }

    [Fact]
    public async Task Unpaid_booking_must_be_cancelled_the_other_way()
    {
        var booking = _t.SeedBooking(_rental, _user, StripeTestContext.Today.AddDays(10), StripeTestContext.Today.AddDays(12), BookingStatus.PendingPayment);

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Quote(booking.Id));

        Assert.Equal(PaymentErrorKind.Conflict, ex.Kind);
        Assert.Contains("not been paid", ex.Message);
    }

    [Theory]
    [InlineData(BookingStatus.Cancelled)]
    [InlineData(BookingStatus.Expired)]
    [InlineData(BookingStatus.Refunded)]
    public async Task Finished_bookings_cannot_be_quoted(BookingStatus status)
    {
        var booking = _t.SeedBooking(_rental, _user, StripeTestContext.Today.AddDays(10), StripeTestContext.Today.AddDays(12), status);

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Quote(booking.Id));
        Assert.Equal(PaymentErrorKind.Conflict, ex.Kind);
    }

    [Fact]
    public async Task Confirmed_booking_without_a_completed_payment_is_a_conflict()
    {
        var booking = _t.SeedBooking(_rental, _user, StripeTestContext.Today.AddDays(10), StripeTestContext.Today.AddDays(12), BookingStatus.Confirmed);

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Quote(booking.Id));
        Assert.Equal(PaymentErrorKind.Conflict, ex.Kind);
    }

    [Fact]
    public async Task Other_users_cannot_quote_but_admins_can()
    {
        var (booking, _) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: 20);
        _t.SeedUser("stranger");

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Quote(booking.Id, "stranger"));
        Assert.Equal(PaymentErrorKind.NotFound, ex.Kind);

        Assert.Equal(0, (await Quote(booking.Id, "stranger", admin: true)).FeeCents);
    }
}
