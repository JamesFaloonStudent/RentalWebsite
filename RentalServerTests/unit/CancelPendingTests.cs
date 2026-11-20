using RentalServerTests.Support;
using RentalWebsite.Models;
using RentalWebsite.Services;

namespace RentalServerTests.Unit;


// CancelPendingPaymentAsync: abandoning an unpaid booking (no money moves).
public sealed class CancelPendingTests : IDisposable
{
    private readonly StripeTestContext _t = new();
    private readonly string _user;
    private readonly string _bookingId;
    private readonly FakeSession _session;

    public CancelPendingTests()
    {
        _user = _t.SeedUser();
        var rental = _t.SeedRental();
        _bookingId = _t.NewService().CreateCheckoutAsync(
            _user, new CreateCheckoutRequest(rental, StripeTestContext.Today.AddDays(10), StripeTestContext.Today.AddDays(12))).Result.BookingId;
        _session = _t.Stripe.SessionForBooking(_bookingId);
    }

    public void Dispose() => _t.Dispose();

    private Task<CancelBookingResponse> CancelPending(string? user = null, bool admin = false) =>
        _t.NewService().CancelPendingPaymentAsync(user ?? _user, admin, _bookingId);

    [Fact]
    public async Task Expires_the_stripe_session_and_releases_the_booking()
    {
        var result = await CancelPending();

        Assert.Equal(new CancelBookingResponse(_bookingId, "Cancelled", 0, 0), result);
        Assert.Equal("expired", _t.Stripe.Sessions[_session.Id].Status);
        Assert.Equal(BookingStatus.Cancelled, _t.GetBooking(_bookingId).Status);
        Assert.Equal(PaymentStatus.Canceled, _t.GetPayments(_bookingId).Single().Status);
        Assert.Empty(_t.Stripe.RequestsTo(HttpMethod.Post, "/v1/refunds"));
    }

    [Fact]
    public async Task A_paid_booking_cannot_be_cancelled_as_pending()
    {
        _t.Stripe.MarkPaid(_session.Id);
        await _t.NewService().SyncPaymentAsync(_user, false, _t.GetPayments(_bookingId).Single().Id);

        var ex = await Assert.ThrowsAsync<PaymentException>(() => CancelPending());
        Assert.Equal(PaymentErrorKind.Conflict, ex.Kind);
    }

    [Fact]
    public async Task Cancelling_twice_is_a_conflict()
    {
        await CancelPending();

        var ex = await Assert.ThrowsAsync<PaymentException>(() => CancelPending());
        Assert.Equal(PaymentErrorKind.Conflict, ex.Kind);
    }

    [Fact]
    public async Task If_the_customer_paid_a_moment_ago_the_payment_is_reconciled_and_the_cancel_refused()
    {
        // The customer pays at Stripe, but our server hasn't heard yet.
        _t.Stripe.MarkPaid(_session.Id);

        var ex = await Assert.ThrowsAsync<PaymentException>(() => CancelPending());

        Assert.Equal(PaymentErrorKind.Conflict, ex.Kind);
        Assert.Contains("already been paid", ex.Message);
        Assert.Equal(PaymentStatus.Succeeded, _t.GetPayments(_bookingId).Single().Status);
        Assert.Equal(BookingStatus.Confirmed, _t.GetBooking(_bookingId).Status);
    }

    [Fact]
    public async Task Other_stripe_errors_leave_the_booking_pending_so_it_can_be_retried()
    {
        _t.Stripe.FailPathContaining = "/expire";

        var ex = await Assert.ThrowsAsync<PaymentException>(() => CancelPending());

        Assert.Equal(PaymentErrorKind.Upstream, ex.Kind);
        Assert.Equal(BookingStatus.PendingPayment, _t.GetBooking(_bookingId).Status);
        Assert.Equal(PaymentStatus.Pending, _t.GetPayments(_bookingId).Single().Status);

        _t.Stripe.FailPathContaining = null;
        await CancelPending();
        Assert.Equal(BookingStatus.Cancelled, _t.GetBooking(_bookingId).Status);
    }

    [Fact]
    public async Task Other_users_cannot_cancel_but_admins_can()
    {
        _t.SeedUser("stranger");

        var ex = await Assert.ThrowsAsync<PaymentException>(() => CancelPending("stranger"));
        Assert.Equal(PaymentErrorKind.NotFound, ex.Kind);

        await CancelPending("stranger", admin: true);
        Assert.Equal(BookingStatus.Cancelled, _t.GetBooking(_bookingId).Status);
    }
}
