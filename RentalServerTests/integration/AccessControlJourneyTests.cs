using RentalServerTests.Support;
using RentalWebsite.Models;
using RentalWebsite.Services;

namespace RentalServerTests.Integration;


// Across a whole booking, who may see and change what.
public sealed class AccessControlJourneyTests : ApiHarness
{
    private string _bookingId = "";
    private string _paymentId = "";

    private async Task BookAndPay()
    {
        var alice = await StartCheckout(Alice, 30, 2);
        _bookingId = alice.BookingId;
        _paymentId = PaymentIdOf(_bookingId);
        await PayViaWebhook(_bookingId);
    }

    [Fact]
    public async Task Another_customer_cannot_see_sync_quote_or_cancel_alices_booking()
    {
        await BookAndPay();

        Assert.Equal(404, StatusOf(await GetPayment(Bob, _paymentId)));
        Assert.Equal(404, StatusOf(await Sync(Bob, _paymentId)));
        Assert.Equal(404, StatusOf(await Quote(Bob, _bookingId)));
        Assert.Equal(404, StatusOf(await Cancel(Bob, _bookingId)));
        Assert.Equal(404, StatusOf(await CancelPending(Bob, _bookingId)));
        Assert.Equal(404, StatusOf(await T.NewController(Bob).GetBookingPayments(_bookingId, default)));

        // None of it changed anything.
        Assert.Equal(BookingStatus.Confirmed, T.GetBooking(_bookingId).Status);
        Assert.Empty(T.Stripe.RequestsTo(HttpMethod.Post, "/v1/refunds"));
    }

    [Fact]
    public async Task Not_found_looks_identical_for_missing_and_for_someone_elses_ids()
    {
        await BookAndPay();

        var someoneElses = await GetPayment(Bob, _paymentId);
        var missing = await GetPayment(Bob, "does-not-exist");

        Assert.Equal(StatusOf(missing), StatusOf(someoneElses));
        Assert.Equal(
            ((Microsoft.AspNetCore.Mvc.NotFoundObjectResult)missing).Value!.ToString(),
            ((Microsoft.AspNetCore.Mvc.NotFoundObjectResult)someoneElses).Value!.ToString());
    }

    [Fact]
    public async Task An_admin_can_review_and_cancel_on_the_customers_behalf()
    {
        await BookAndPay();
        T.SeedUser("staff");

        Assert.Equal(200, StatusOf(await GetPayment("staff", _paymentId, admin: true)));
        Assert.Equal(200, StatusOf(await Quote("staff", _bookingId, admin: true)));
        Assert.Equal(200, StatusOf(await Cancel("staff", _bookingId, admin: true)));

        Assert.Equal(BookingStatus.Cancelled, T.GetBooking(_bookingId).Status);
        Assert.Equal("staff", T.GetRefunds().Single().RequestedByUserId);
    }

    [Fact]
    public async Task The_owner_still_has_access_after_an_admin_acts()
    {
        await BookAndPay();
        T.SeedUser("staff");
        await Cancel("staff", _bookingId, admin: true);

        var payment = Ok<PaymentResponse>(await GetPayment(Alice, _paymentId));
        Assert.Equal("Refunded", payment.Status);
    }

    [Fact]
    public async Task A_customers_booking_list_never_includes_someone_elses_booking()
    {
        await BookAndPay();

        var bobsList = await new BookingService(T.NewDb()).ListMineAsync(Bob, default);
        var alicesList = await new BookingService(T.NewDb()).ListMineAsync(Alice, default);

        Assert.Empty(bobsList);
        var mine = Assert.Single(alicesList);
        Assert.Equal(_bookingId, mine.BookingId);
        Assert.Equal("Confirmed", mine.Status);

        // Reading it directly by id is just as closed to Bob, and open to an admin.
        await Assert.ThrowsAsync<PaymentException>(() => new BookingService(T.NewDb()).GetAsync(Bob, false, _bookingId, default));
        Assert.Equal(_bookingId, (await new BookingService(T.NewDb()).GetAsync("staff", true, _bookingId, default)).BookingId);
    }

    [Fact]
    public async Task Forged_webhooks_cannot_confirm_a_booking()
    {
        var alice = await StartCheckout(Alice, 30, 2);
        var session = T.Stripe.SessionForBooking(alice.BookingId);
        T.Stripe.MarkPaid(session.Id);

        var forged = WebhookEvents.Create("checkout.session.completed", FakeStripeHandler.SessionJson(session), secret: "whsec_guess");

        Assert.Equal(400, StatusOf(await Webhook(forged)));
        Assert.Equal(BookingStatus.PendingPayment, T.GetBooking(alice.BookingId).Status);
    }

    [Fact]
    public async Task Only_the_webhook_works_without_a_user_identity_and_it_needs_a_valid_signature()
    {
        // The webhook controller has no user at all; a bad signature is the only thing standing between
        // the internet and the payment tables.
        Assert.Equal(400, StatusOf(await Webhook(new WebhookEvents.Signed("evt_x", "{}", "t=1,v1=00"))));
    }
}
