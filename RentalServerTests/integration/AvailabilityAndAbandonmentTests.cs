using RentalServerTests.Support;
using RentalWebsite.Models;

namespace RentalServerTests.Integration;


// How bookings hold, release and re-offer dates as payments succeed, fail, expire or are cancelled.
public sealed class AvailabilityAndAbandonmentTests : ApiHarness
{
    [Fact]
    public async Task An_unpaid_booking_holds_the_dates_so_a_second_customer_is_turned_away()
    {
        await StartCheckout(Alice, 20, 3);

        Assert.Equal(409, StatusOf(await Checkout(Bob, 21, 3)));
    }

    [Fact]
    public async Task Cancelling_the_unpaid_booking_frees_the_dates_for_the_next_customer()
    {
        var alice = await StartCheckout(Alice, 20, 3);
        Assert.Equal(409, StatusOf(await Checkout(Bob, 20, 3)));

        var cancelled = Ok<CancelBookingResponse>(await CancelPending(Alice, alice.BookingId));

        Assert.Equal("Cancelled", cancelled.Status);
        Assert.Equal("expired", T.Stripe.SessionForBooking(alice.BookingId).Status); // can no longer be paid
        Assert.Equal(200, StatusOf(await Checkout(Bob, 20, 3)));
    }

    [Fact]
    public async Task Abandoned_checkout_expires_at_stripe_and_the_webhook_frees_the_dates()
    {
        var alice = await StartCheckout(Alice, 20, 3);
        var session = T.Stripe.MarkExpired(T.Stripe.SessionForBooking(alice.BookingId).Id);

        Assert.Equal(200, StatusOf(await Webhook(WebhookEvents.CheckoutExpired(session))));

        Assert.Equal(BookingStatus.Expired, T.GetBooking(alice.BookingId).Status);
        Assert.Equal(PaymentStatus.Canceled, T.GetPayments(alice.BookingId).Single().Status);
        Assert.Equal(200, StatusOf(await Checkout(Bob, 20, 3)));
    }

    [Fact]
    public async Task A_lapsed_hold_frees_the_dates_even_if_no_webhook_ever_arrives()
    {
        var alice = await StartCheckout(Alice, 20, 3);
        using (var db = T.NewDb())
        {
            db.Bookings.Single(b => b.Id == alice.BookingId).ExpiresAt = DateTime.UtcNow.AddMinutes(-1);
            db.SaveChanges();
        }

        Assert.Equal(200, StatusOf(await Checkout(Bob, 20, 3)));
    }

    [Fact]
    public async Task A_paid_booking_blocks_the_dates_until_it_is_cancelled()
    {
        var alice = await StartCheckout(Alice, 30, 3);
        await PayViaWebhook(alice.BookingId);

        Assert.Equal(409, StatusOf(await Checkout(Bob, 30, 3)));

        await Cancel(Alice, alice.BookingId);

        Assert.Equal(200, StatusOf(await Checkout(Bob, 30, 3)));
    }

    [Fact]
    public async Task Back_to_back_bookings_on_the_same_rental_are_allowed()
    {
        await StartCheckout(Alice, 20, 3);                // nights 20, 21, 22
        Assert.Equal(200, StatusOf(await Checkout(Bob, 23, 2))); // starts the day Alice leaves
    }

    [Fact]
    public async Task The_same_customer_can_rebook_the_same_dates_after_cancelling()
    {
        var first = await StartCheckout(Alice, 20, 3);
        await CancelPending(Alice, first.BookingId);

        var second = await StartCheckout(Alice, 20, 3);

        Assert.NotEqual(first.BookingId, second.BookingId);
        Assert.Equal(BookingStatus.Cancelled, T.GetBooking(first.BookingId).Status);
        Assert.Equal(BookingStatus.PendingPayment, T.GetBooking(second.BookingId).Status);
    }

    [Fact]
    public async Task Paying_at_the_last_moment_beats_a_cancel_request()
    {
        var alice = await StartCheckout(Alice, 20, 3);
        T.Stripe.MarkPaid(T.Stripe.SessionForBooking(alice.BookingId).Id); // paid; webhook not yet delivered

        Assert.Equal(409, StatusOf(await CancelPending(Alice, alice.BookingId)));

        // The booking is confirmed (reconciled during the cancel attempt) and Bob still can't take the dates.
        Assert.Equal(BookingStatus.Confirmed, T.GetBooking(alice.BookingId).Status);
        Assert.Equal(409, StatusOf(await Checkout(Bob, 20, 3)));
    }

    [Fact]
    public async Task Stripe_outage_during_checkout_does_not_leave_the_dates_stuck()
    {
        T.Stripe.FailPathContaining = "/v1/checkout/sessions";
        Assert.Equal(502, StatusOf(await Checkout(Alice, 20, 3)));

        T.Stripe.FailPathContaining = null;
        Assert.Equal(200, StatusOf(await Checkout(Alice, 20, 3)));
    }

    [Fact]
    public async Task Webhook_delivery_failure_is_retried_until_it_succeeds()
    {
        var alice = await StartCheckout(Alice, 30, 1);
        var session = T.Stripe.SessionForBooking(alice.BookingId);
        T.Stripe.MarkPaid(session.Id);
        var evt = WebhookEvents.CheckoutCompleted(session);

        T.Stripe.FailPathContaining = "/v1/checkout/sessions/";
        Assert.Equal(500, StatusOf(await Webhook(evt)));   // Stripe sees 500 and will retry
        Assert.Equal(BookingStatus.PendingPayment, T.GetBooking(alice.BookingId).Status);

        T.Stripe.FailPathContaining = null;
        Assert.Equal(200, StatusOf(await Webhook(evt)));   // the retry
        Assert.Equal(BookingStatus.Confirmed, T.GetBooking(alice.BookingId).Status);

        Assert.Equal(200, StatusOf(await Webhook(evt)));   // an extra retry after success is a no-op
    }
}
