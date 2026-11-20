using RentalServerTests.Support;
using RentalWebsite.Models;

namespace RentalServerTests.Integration;


// End-to-end journeys: checkout -> Stripe -> webhook/sync -> quote -> cancel, with every layer real
// except Stripe's servers.
public sealed class BookingLifecycleTests : ApiHarness
{
    [Fact]
    public async Task Happy_path_book_pay_then_cancel_early_for_a_full_refund()
    {
        // 1. Alice books 3 nights starting in 30 days.
        var checkout = await StartCheckout(Alice, startInDays: 30, nights: 3);
        Assert.Equal(BookingStatus.PendingPayment, T.GetBooking(checkout.BookingId).Status);
        var paymentId = PaymentIdOf(checkout.BookingId);

        // 2. She pays on Stripe's page; Stripe tells us by webhook.
        var session = await PayViaWebhook(checkout.BookingId);

        var payment = Ok<PaymentResponse>(await GetPayment(Alice, paymentId));
        Assert.Equal("Succeeded", payment.Status);
        Assert.Equal(30000, payment.AmountCents);
        Assert.Equal("4242", payment.Last4);
        Assert.Equal(BookingStatus.Confirmed, T.GetBooking(checkout.BookingId).Status);

        // 3. The UI asks what cancelling would cost: nothing, it's 30 days away.
        var quote = Ok<CancellationQuote>(await Quote(Alice, checkout.BookingId));
        Assert.False(quote.LateCancellation);
        Assert.Equal(0, quote.FeeCents);
        Assert.Equal(30000, quote.RefundCents);

        // 4. She confirms. The refund goes to Stripe and everything is recorded.
        var cancelled = Ok<CancelBookingResponse>(await Cancel(Alice, checkout.BookingId));
        Assert.Equal(30000, cancelled.RefundCents);
        Assert.Equal(30000, T.Stripe.Sessions[session.Id].AmountRefunded);
        Assert.Equal(BookingStatus.Cancelled, T.GetBooking(checkout.BookingId).Status);
        Assert.Equal(PaymentStatus.Refunded, T.GetPayment(paymentId).Status);
        Assert.Single(T.GetRefunds());
    }

    [Fact]
    public async Task Late_cancellation_quote_and_cancel_agree_and_stripe_receives_the_net_amount()
    {
        var checkout = await StartCheckout(Alice, startInDays: 3, nights: 2); // inside the 7-day window
        var session = await PayViaWebhook(checkout.BookingId);

        var quote = Ok<CancellationQuote>(await Quote(Alice, checkout.BookingId));
        Assert.True(quote.LateCancellation);
        Assert.Equal(5000, quote.FeeCents);   // 25 % of 20 000
        Assert.Equal(15000, quote.RefundCents);

        var cancelled = Ok<CancelBookingResponse>(await Cancel(Alice, checkout.BookingId));

        Assert.Equal(quote.FeeCents, cancelled.FeeCents);
        Assert.Equal(quote.RefundCents, cancelled.RefundCents);
        Assert.Equal(15000, T.Stripe.Sessions[session.Id].AmountRefunded);

        var payment = T.GetPayments(checkout.BookingId).Single();
        Assert.Equal(PaymentStatus.PartiallyRefunded, payment.Status);
        Assert.Equal(15000, payment.AmountRefundedCents);
    }

    [Fact]
    public async Task The_fee_rule_changes_at_the_seven_day_boundary()
    {
        var early = await StartCheckout(Alice, startInDays: 7, nights: 1);
        await PayViaWebhook(early.BookingId);
        var late = await StartCheckout(Bob, startInDays: 6, nights: 1);
        await PayViaWebhook(late.BookingId);

        Assert.Equal(0, Ok<CancellationQuote>(await Quote(Alice, early.BookingId)).FeeCents);
        Assert.Equal(2500, Ok<CancellationQuote>(await Quote(Bob, late.BookingId)).FeeCents);
    }

    [Fact]
    public async Task Customer_returns_before_the_webhook_and_the_frontend_syncs_instead()
    {
        var checkout = await StartCheckout(Alice, 30, 2);
        var paymentId = PaymentIdOf(checkout.BookingId);
        T.Stripe.MarkPaid(T.Stripe.SessionForBooking(checkout.BookingId).Id);

        // Still pending locally: the webhook hasn't arrived.
        Assert.Equal(BookingStatus.PendingPayment, T.GetBooking(checkout.BookingId).Status);

        var synced = Ok<PaymentResponse>(await Sync(Alice, paymentId));
        Assert.Equal("Succeeded", synced.Status);
        Assert.Equal(BookingStatus.Confirmed, T.GetBooking(checkout.BookingId).Status);

        // The webhook finally shows up: harmless, and the state is unchanged.
        var session = T.Stripe.SessionForBooking(checkout.BookingId);
        Assert.Equal(200, StatusOf(await Webhook(WebhookEvents.CheckoutCompleted(session))));
        Assert.Equal(synced.PaidAt, Ok<PaymentResponse>(await GetPayment(Alice, paymentId)).PaidAt);
    }

    [Fact]
    public async Task Webhook_then_sync_then_webhook_again_all_converge_on_the_same_state()
    {
        var checkout = await StartCheckout(Alice, 30, 1);
        var paymentId = PaymentIdOf(checkout.BookingId);
        var session = await PayViaWebhook(checkout.BookingId);
        var first = Ok<PaymentResponse>(await GetPayment(Alice, paymentId));

        await Sync(Alice, paymentId);
        await Webhook(WebhookEvents.CheckoutCompleted(session)); // a different event id for the same session

        var last = Ok<PaymentResponse>(await GetPayment(Alice, paymentId));
        Assert.Equal(first, last);
        Assert.Single(T.GetPayments(checkout.BookingId));
    }

    [Fact]
    public async Task Declined_card_then_successful_retry_in_the_same_session()
    {
        var checkout = await StartCheckout(Alice, 30, 1);
        var paymentId = PaymentIdOf(checkout.BookingId);
        var session = T.Stripe.SessionForBooking(checkout.BookingId);

        T.Stripe.MarkFailedAttempt(session.Id, "card_declined", "Your card was declined.");
        Assert.Equal(200, StatusOf(await Webhook(WebhookEvents.PaymentFailed(session.PaymentIntentId!, checkout.BookingId))));
        Assert.Equal("card_declined", T.GetPayment(paymentId).FailureCode);
        Assert.Equal(BookingStatus.PendingPayment, T.GetBooking(checkout.BookingId).Status); // dates still held

        await PayViaWebhook(checkout.BookingId);

        var payment = T.GetPayment(paymentId);
        Assert.Equal(PaymentStatus.Succeeded, payment.Status);
        Assert.Null(payment.FailureCode);
        Assert.Equal(BookingStatus.Confirmed, T.GetBooking(checkout.BookingId).Status);
    }

    [Fact]
    public async Task The_price_is_locked_in_when_booking_even_if_the_rental_price_changes_later()
    {
        var checkout = await StartCheckout(Alice, 3, 2); // 20 000 at 100.00/night
        await PayViaWebhook(checkout.BookingId);

        using (var db = T.NewDb())
        {
            db.Rentals.Single(r => r.id == Rental).pricePerDay = 500f;
            db.SaveChanges();
        }

        var quote = Ok<CancellationQuote>(await Quote(Alice, checkout.BookingId));
        Assert.Equal(20000, quote.PaidCents);
        Assert.Equal(15000, quote.RefundCents);
    }

    [Fact]
    public async Task Stripes_own_charge_refunded_webhook_after_our_refund_changes_nothing()
    {
        var checkout = await StartCheckout(Alice, 3, 2);
        var session = await PayViaWebhook(checkout.BookingId);
        await Cancel(Alice, checkout.BookingId); // refunds 15 000 of 20 000

        var before = T.GetPayments(checkout.BookingId).Single();
        Assert.Equal(200, StatusOf(await Webhook(WebhookEvents.ChargeRefunded(session.PaymentIntentId!, 15000))));

        var after = T.GetPayments(checkout.BookingId).Single();
        Assert.Equal(before.AmountRefundedCents, after.AmountRefundedCents);
        Assert.Equal(PaymentStatus.PartiallyRefunded, after.Status);
        Assert.Equal(BookingStatus.Cancelled, T.GetBooking(checkout.BookingId).Status);
        Assert.Single(T.GetRefunds());
    }
}
