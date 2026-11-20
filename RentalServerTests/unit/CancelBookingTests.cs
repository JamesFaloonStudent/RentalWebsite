using RentalServerTests.Support;
using RentalWebsite.Models;
using RentalWebsite.Services;

namespace RentalServerTests.Unit;


// CancelBookingAsync: refund = paid - fee, recorded locally and sent to Stripe.
public sealed class CancelBookingTests : IDisposable
{
    private readonly StripeTestContext _t = new();
    private readonly string _user;
    private readonly string _rental;

    public CancelBookingTests()
    {
        _user = _t.SeedUser();
        _rental = _t.SeedRental();
    }

    public void Dispose() => _t.Dispose();

    private Task<CancelBookingResponse> Cancel(string bookingId, string? user = null, bool admin = false) =>
        _t.NewService().CancelBookingAsync(user ?? _user, admin, bookingId);

    [Fact]
    public async Task Early_cancellation_refunds_everything()
    {
        var (booking, payment) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: 14);

        var result = await Cancel(booking.Id);

        Assert.Equal(new CancelBookingResponse(booking.Id, "Cancelled", 0, 10000), result);
        Assert.Equal(BookingStatus.Cancelled, _t.GetBooking(booking.Id).Status);

        var saved = _t.GetPayment(payment.Id);
        Assert.Equal(PaymentStatus.Refunded, saved.Status);
        Assert.Equal(10000, saved.AmountRefundedCents);

        var refund = Assert.Single(_t.GetRefunds());
        Assert.Equal(payment.Id, refund.PaymentId);
        Assert.Equal(10000, refund.AmountCents);
        Assert.Equal(_user, refund.RequestedByUserId);
        Assert.Equal("succeeded", refund.Status);
        Assert.StartsWith("re_", refund.StripeRefundId);
    }

    [Fact]
    public async Task Late_cancellation_keeps_the_fee_and_refunds_the_rest()
    {
        var (booking, payment) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: 3);

        var result = await Cancel(booking.Id);

        Assert.Equal(2500, result.FeeCents);
        Assert.Equal(7500, result.RefundCents);
        Assert.Equal(BookingStatus.Cancelled, _t.GetBooking(booking.Id).Status);

        var saved = _t.GetPayment(payment.Id);
        Assert.Equal(PaymentStatus.PartiallyRefunded, saved.Status);
        Assert.Equal(7500, saved.AmountRefundedCents);
        Assert.Equal(7500, Assert.Single(_t.GetRefunds()).AmountCents);
        Assert.Contains("fee", _t.GetRefunds()[0].Reason, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Sends_the_right_refund_request_to_stripe()
    {
        var (booking, payment) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: 3);

        await Cancel(booking.Id);

        var request = _t.Stripe.RequestsTo(HttpMethod.Post, "/v1/refunds").Single();
        Assert.Equal(payment.StripePaymentIntentId, request.Form["payment_intent"]);
        Assert.Equal("7500", request.Form["amount"]);
        Assert.Equal("requested_by_customer", request.Form["reason"]);
        Assert.Equal(booking.Id, request.Form["metadata[bookingId]"]);
        Assert.Equal("2500", request.Form["metadata[feeCents]"]);
        Assert.Equal($"cancel-{booking.Id}-7500", request.IdempotencyKey);
    }

    [Fact]
    public async Task When_the_fee_is_the_whole_amount_no_refund_is_issued_but_the_booking_is_cancelled()
    {
        using var t = new StripeTestContext(o => o.LateCancellationFeePercent = 100);
        var user = t.SeedUser();
        var (booking, payment) = t.SeedPaidBooking(t.SeedRental(), user, daysUntilStart: 2);

        var result = await t.NewService().CancelBookingAsync(user, false, booking.Id);

        Assert.Equal(10000, result.FeeCents);
        Assert.Equal(0, result.RefundCents);
        Assert.Empty(t.Stripe.RequestsTo(HttpMethod.Post, "/v1/refunds"));
        Assert.Empty(t.GetRefunds());
        Assert.Equal(BookingStatus.Cancelled, t.GetBooking(booking.Id).Status);
        Assert.Equal(PaymentStatus.Succeeded, t.GetPayment(payment.Id).Status); // nothing was returned
    }

    [Fact]
    public async Task Stripe_failure_leaves_the_booking_and_payment_untouched()
    {
        var (booking, payment) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: 14);
        _t.Stripe.FailPathContaining = "/v1/refunds";

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Cancel(booking.Id));

        Assert.Equal(PaymentErrorKind.Upstream, ex.Kind);
        Assert.Equal(BookingStatus.Confirmed, _t.GetBooking(booking.Id).Status);
        Assert.Equal(PaymentStatus.Succeeded, _t.GetPayment(payment.Id).Status);
        Assert.Empty(_t.GetRefunds());

        // ...and the customer can simply try again.
        _t.Stripe.FailPathContaining = null;
        Assert.Equal(10000, (await Cancel(booking.Id)).RefundCents);
    }

    [Fact]
    public async Task Cancelling_twice_is_a_conflict_and_refunds_only_once()
    {
        var (booking, _) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: 14);
        await Cancel(booking.Id);

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Cancel(booking.Id));

        Assert.Equal(PaymentErrorKind.Conflict, ex.Kind);
        Assert.Single(_t.Stripe.RequestsTo(HttpMethod.Post, "/v1/refunds"));
        Assert.Single(_t.GetRefunds());
    }

    [Fact]
    public async Task Unpaid_booking_cannot_be_cancelled_here()
    {
        var booking = _t.SeedBooking(_rental, _user, StripeTestContext.Today.AddDays(10), StripeTestContext.Today.AddDays(12), BookingStatus.PendingPayment);

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Cancel(booking.Id));
        Assert.Equal(PaymentErrorKind.Conflict, ex.Kind);
    }

    [Fact]
    public async Task A_rental_that_already_started_cannot_be_cancelled()
    {
        var (booking, _) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: -2);

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Cancel(booking.Id));

        Assert.Equal(PaymentErrorKind.Conflict, ex.Kind);
        Assert.Equal(BookingStatus.Confirmed, _t.GetBooking(booking.Id).Status);
    }

    [Fact]
    public async Task Another_user_cannot_cancel_and_nothing_happens()
    {
        var (booking, _) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: 14);
        _t.SeedUser("stranger");

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Cancel(booking.Id, "stranger"));

        Assert.Equal(PaymentErrorKind.NotFound, ex.Kind);
        Assert.Equal(BookingStatus.Confirmed, _t.GetBooking(booking.Id).Status);
        Assert.Empty(_t.Stripe.RequestsTo(HttpMethod.Post, "/v1/refunds"));
    }

    [Fact]
    public async Task An_admin_can_cancel_and_is_recorded_as_the_requester()
    {
        var (booking, _) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: 14);
        _t.SeedUser("admin-1");

        await Cancel(booking.Id, "admin-1", admin: true);

        Assert.Equal("admin-1", Assert.Single(_t.GetRefunds()).RequestedByUserId);
    }
}
