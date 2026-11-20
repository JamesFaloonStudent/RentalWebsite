using RentalServerTests.Support;
using RentalWebsite.Models;
using RentalWebsite.Services;
using Stripe;

namespace RentalServerTests.Unit;


// HandleWebhookAsync + Dispatch: signature check, dedupe, and each supported event type.
public sealed class WebhookTests : IDisposable
{
    private readonly StripeTestContext _t = new();
    private readonly string _user;
    private readonly string _bookingId;
    private readonly string _paymentId;
    private readonly FakeSession _session;

    public WebhookTests()
    {
        _user = _t.SeedUser();
        var rental = _t.SeedRental();
        _bookingId = _t.NewService().CreateCheckoutAsync(
            _user, new CreateCheckoutRequest(rental, StripeTestContext.Today.AddDays(10), StripeTestContext.Today.AddDays(12))).Result.BookingId;
        _paymentId = _t.GetPayments(_bookingId).Single().Id;
        _session = _t.Stripe.SessionForBooking(_bookingId);
    }

    public void Dispose() => _t.Dispose();

    private Task Deliver(WebhookEvents.Signed evt) =>
        _t.NewService().HandleWebhookAsync(evt.Payload, evt.Header);

    // ---- authenticity ----

    [Fact]
    public async Task Missing_webhook_secret_is_a_server_misconfiguration()
    {
        _t.Settings.Remove("STRIPE_WEBHOOK_SECRET");
        var evt = WebhookEvents.CheckoutCompleted(_session);

        await Assert.ThrowsAsync<InvalidOperationException>(() => Deliver(evt));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task Missing_signature_is_rejected(string? header)
    {
        var evt = WebhookEvents.CheckoutCompleted(_session);

        var ex = await Assert.ThrowsAsync<PaymentException>(() => _t.NewService().HandleWebhookAsync(evt.Payload, header));
        Assert.Equal(PaymentErrorKind.Validation, ex.Kind);
    }

    [Fact]
    public async Task Signature_made_with_the_wrong_secret_is_rejected_and_nothing_changes()
    {
        _t.Stripe.MarkPaid(_session.Id);
        var forged = WebhookEvents.Create("checkout.session.completed", FakeStripeHandler.SessionJson(_session), secret: "whsec_attacker");

        var ex = await Assert.ThrowsAsync<PaymentException>(() => Deliver(forged));

        Assert.Equal(PaymentErrorKind.Validation, ex.Kind);
        Assert.Equal(PaymentStatus.Pending, _t.GetPayment(_paymentId).Status);
        Assert.False(_t.WebhookEventRecorded(forged.EventId));
    }

    [Fact]
    public async Task Tampered_payload_is_rejected()
    {
        _t.Stripe.MarkPaid(_session.Id);
        var evt = WebhookEvents.CheckoutCompleted(_session);
        var tampered = evt.Payload.Replace("checkout.session.completed", "checkout.session.expired");

        var ex = await Assert.ThrowsAsync<PaymentException>(() => _t.NewService().HandleWebhookAsync(tampered, evt.Header));
        Assert.Equal(PaymentErrorKind.Validation, ex.Kind);
    }

    // ---- event handling ----

    [Fact]
    public async Task Checkout_completed_confirms_the_booking_and_records_the_event()
    {
        _t.Stripe.MarkPaid(_session.Id);
        var evt = WebhookEvents.CheckoutCompleted(_session);

        await Deliver(evt);

        Assert.Equal(PaymentStatus.Succeeded, _t.GetPayment(_paymentId).Status);
        Assert.Equal(BookingStatus.Confirmed, _t.GetBooking(_bookingId).Status);
        Assert.True(_t.WebhookEventRecorded(evt.EventId));
    }

    [Fact]
    public async Task The_webhook_trusts_stripes_api_not_the_event_body_for_payment_status()
    {
        // The event claims the session completed, but Stripe says it is still unpaid.
        var evt = WebhookEvents.CheckoutCompleted(_session);

        await Deliver(evt);

        Assert.Equal(PaymentStatus.Pending, _t.GetPayment(_paymentId).Status);
        Assert.Equal(BookingStatus.PendingPayment, _t.GetBooking(_bookingId).Status);
    }

    [Fact]
    public async Task Checkout_expired_releases_the_booking()
    {
        _t.Stripe.MarkExpired(_session.Id);

        await Deliver(WebhookEvents.CheckoutExpired(_session));

        Assert.Equal(PaymentStatus.Canceled, _t.GetPayment(_paymentId).Status);
        Assert.Equal(BookingStatus.Expired, _t.GetBooking(_bookingId).Status);
    }

    [Fact]
    public async Task Payment_failed_records_the_decline_reason()
    {
        _t.Stripe.MarkFailedAttempt(_session.Id, "insufficient_funds", "Your card has insufficient funds.");

        await Deliver(WebhookEvents.PaymentFailed(_session.PaymentIntentId!, _bookingId));

        var payment = _t.GetPayment(_paymentId);
        Assert.Equal(PaymentStatus.Pending, payment.Status);
        Assert.Equal("insufficient_funds", payment.FailureCode);
    }

    [Fact]
    public async Task Charge_refunded_updates_the_refund_totals()
    {
        _t.Stripe.MarkPaid(_session.Id);
        await Deliver(WebhookEvents.CheckoutCompleted(_session));

        await Deliver(WebhookEvents.ChargeRefunded(_session.PaymentIntentId!, 4000));
        var partial = _t.GetPayment(_paymentId);
        Assert.Equal(PaymentStatus.PartiallyRefunded, partial.Status);
        Assert.Equal(4000, partial.AmountRefundedCents);

        await Deliver(WebhookEvents.ChargeRefunded(_session.PaymentIntentId!, _session.AmountCents));
        Assert.Equal(PaymentStatus.Refunded, _t.GetPayment(_paymentId).Status);
    }

    [Fact]
    public async Task Unrelated_event_types_are_acknowledged_and_recorded()
    {
        var evt = WebhookEvents.Unrelated();

        await Deliver(evt);

        Assert.True(_t.WebhookEventRecorded(evt.EventId));
        Assert.Equal(PaymentStatus.Pending, _t.GetPayment(_paymentId).Status);
    }

    [Fact]
    public async Task Event_for_an_unknown_session_is_acknowledged_without_error()
    {
        var stranger = new FakeSession { Id = "cs_unknown", BookingId = "nope", AmountCents = 1 };
        var evt = WebhookEvents.CheckoutCompleted(stranger);

        await Deliver(evt);

        Assert.True(_t.WebhookEventRecorded(evt.EventId));
    }

    // ---- idempotency and retries ----

    [Fact]
    public async Task A_redelivered_event_is_ignored_without_calling_stripe_again()
    {
        _t.Stripe.MarkPaid(_session.Id);
        var evt = WebhookEvents.CheckoutCompleted(_session);

        await Deliver(evt);
        var callsAfterFirst = _t.Stripe.Requests.Count;
        await Deliver(evt);

        Assert.Equal(callsAfterFirst, _t.Stripe.Requests.Count);
        using var db = _t.NewDb();
        Assert.Single(db.StripeWebhookEvents.Where(e => e.Id == evt.EventId));
    }

    [Fact]
    public async Task A_failed_run_is_not_recorded_so_stripes_retry_is_processed()
    {
        _t.Stripe.MarkPaid(_session.Id);
        var evt = WebhookEvents.CheckoutCompleted(_session);

        _t.Stripe.FailPathContaining = "/v1/checkout/sessions/";
        await Assert.ThrowsAsync<StripeException>(() => Deliver(evt)); // surfaces as 500 so Stripe retries

        Assert.False(_t.WebhookEventRecorded(evt.EventId));
        Assert.Equal(PaymentStatus.Pending, _t.GetPayment(_paymentId).Status);

        _t.Stripe.FailPathContaining = null;
        await Deliver(evt); // Stripe's retry

        Assert.True(_t.WebhookEventRecorded(evt.EventId));
        Assert.Equal(PaymentStatus.Succeeded, _t.GetPayment(_paymentId).Status);
    }
}
