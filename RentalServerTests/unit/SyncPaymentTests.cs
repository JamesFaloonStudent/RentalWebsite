using RentalServerTests.Support;
using RentalWebsite.Models;
using RentalWebsite.Services;

namespace RentalServerTests.Unit;


// SyncPaymentAsync (and through it ApplySession): copying Stripe's state into our database.
public sealed class SyncPaymentTests : IDisposable
{
    private readonly StripeTestContext _t = new();
    private readonly string _user;
    private readonly string _bookingId;
    private readonly string _paymentId;
    private readonly FakeSession _session;

    public SyncPaymentTests()
    {
        _user = _t.SeedUser();
        var rental = _t.SeedRental();
        var checkout = _t.NewService().CreateCheckoutAsync(
            _user, new CreateCheckoutRequest(rental, StripeTestContext.Today.AddDays(10), StripeTestContext.Today.AddDays(12))).Result;

        _bookingId = checkout.BookingId;
        _paymentId = _t.GetPayments(_bookingId).Single().Id;
        _session = _t.Stripe.SessionForBooking(_bookingId);
    }

    public void Dispose() => _t.Dispose();

    private Task<PaymentResponse> Sync(string? user = null, bool admin = false) =>
        _t.NewService().SyncPaymentAsync(user ?? _user, admin, _paymentId);

    [Fact]
    public async Task Unpaid_session_leaves_everything_pending()
    {
        var result = await Sync();

        Assert.Equal("Pending", result.Status);
        Assert.Equal(BookingStatus.PendingPayment, _t.GetBooking(_bookingId).Status);
    }

    [Fact]
    public async Task Paid_session_confirms_the_booking_and_stores_card_details()
    {
        _t.Stripe.MarkPaid(_session.Id, "mastercard", "4444");

        var result = await Sync();

        Assert.Equal("Succeeded", result.Status);
        Assert.Equal("mastercard", result.CardBrand);
        Assert.Equal("4444", result.Last4);
        Assert.NotNull(result.ReceiptUrl);
        Assert.NotNull(result.PaidAt);

        var payment = _t.GetPayment(_paymentId);
        Assert.Equal(_session.PaymentIntentId, payment.StripePaymentIntentId);
        Assert.Equal(_session.ChargeId, payment.StripeChargeId);
        Assert.Equal(BookingStatus.Confirmed, _t.GetBooking(_bookingId).Status);
    }

    [Fact]
    public async Task Syncing_twice_changes_nothing_the_second_time()
    {
        _t.Stripe.MarkPaid(_session.Id);
        var first = await Sync();
        var second = await Sync();

        Assert.Equal(first.PaidAt, second.PaidAt);
        Assert.Equal("Succeeded", second.Status);
    }

    [Fact]
    public async Task Expired_session_cancels_the_payment_and_expires_the_booking()
    {
        _t.Stripe.MarkExpired(_session.Id);

        var result = await Sync();

        Assert.Equal("Canceled", result.Status);
        Assert.Equal(BookingStatus.Expired, _t.GetBooking(_bookingId).Status);
    }

    [Fact]
    public async Task A_declined_attempt_records_the_failure_but_keeps_the_payment_pending()
    {
        _t.Stripe.MarkFailedAttempt(_session.Id, "card_declined", "Your card was declined.");

        await Sync();

        var payment = _t.GetPayment(_paymentId);
        Assert.Equal(PaymentStatus.Pending, payment.Status); // the customer can retry in the same session
        Assert.Equal("card_declined", payment.FailureCode);
        Assert.Equal("Your card was declined.", payment.FailureMessage);
        Assert.Equal(BookingStatus.PendingPayment, _t.GetBooking(_bookingId).Status);
    }

    [Fact]
    public async Task A_retry_that_succeeds_clears_the_earlier_failure()
    {
        _t.Stripe.MarkFailedAttempt(_session.Id);
        await Sync();

        _t.Stripe.MarkPaid(_session.Id);
        await Sync();

        var payment = _t.GetPayment(_paymentId);
        Assert.Equal(PaymentStatus.Succeeded, payment.Status);
        Assert.Null(payment.FailureCode);
        Assert.Null(payment.FailureMessage);
    }

    [Fact]
    public async Task A_paid_payment_is_never_moved_backwards()
    {
        _t.Stripe.MarkPaid(_session.Id);
        await Sync();

        _t.Stripe.MarkExpired(_session.Id); // contradictory later state
        var result = await Sync();

        Assert.Equal("Succeeded", result.Status);
        Assert.Equal(BookingStatus.Confirmed, _t.GetBooking(_bookingId).Status);
    }

    [Fact]
    public async Task Refunds_made_at_stripe_are_reflected_in_the_payment()
    {
        _t.Stripe.MarkPaid(_session.Id);
        await Sync();

        _t.Stripe.Sessions[_session.Id].AmountRefunded = 2500;
        var partial = await Sync();
        Assert.Equal("PartiallyRefunded", partial.Status);
        Assert.Equal(2500, partial.AmountRefundedCents);

        _t.Stripe.Sessions[_session.Id].AmountRefunded = _session.AmountCents;
        var full = await Sync();
        Assert.Equal("Refunded", full.Status);
        Assert.Equal(_session.AmountCents, full.AmountRefundedCents);
    }

    [Fact]
    public async Task Paying_for_a_booking_that_was_already_released_still_records_the_payment()
    {
        // The booking was cancelled locally, but the customer's payment went through anyway.
        using (var db = _t.NewDb())
        {
            db.Bookings.Single(b => b.Id == _bookingId).Status = BookingStatus.Cancelled;
            db.SaveChanges();
        }

        _t.Stripe.MarkPaid(_session.Id);
        var result = await Sync();

        Assert.Equal("Succeeded", result.Status);
        Assert.Equal(BookingStatus.Cancelled, _t.GetBooking(_bookingId).Status); // not resurrected
    }

    [Fact]
    public async Task Another_user_cannot_sync_but_an_admin_can()
    {
        _t.SeedUser("stranger");

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Sync("stranger"));
        Assert.Equal(PaymentErrorKind.NotFound, ex.Kind);

        _t.Stripe.MarkPaid(_session.Id);
        var result = await Sync("stranger", admin: true);
        Assert.Equal("Succeeded", result.Status);
    }

    [Fact]
    public async Task Stripe_outage_is_reported_as_an_upstream_error_and_changes_nothing()
    {
        _t.Stripe.FailPathContaining = "/v1/checkout/sessions/";

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Sync());

        Assert.Equal(PaymentErrorKind.Upstream, ex.Kind);
        Assert.Equal(PaymentStatus.Pending, _t.GetPayment(_paymentId).Status);
    }
}
