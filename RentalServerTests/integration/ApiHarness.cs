using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Infrastructure;
using RentalServerTests.Support;
using RentalWebsite.Models;

namespace RentalServerTests.Integration;


// Drives the API the way the frontend and Stripe do: every call is a new "request" (new controller,
// service and DbContext) against the same database and the same fake Stripe.
public abstract class ApiHarness : IDisposable
{
    protected StripeTestContext T { get; } = new();
    protected string Rental { get; }
    protected string Alice { get; }
    protected string Bob { get; }

    protected ApiHarness()
    {
        Rental = T.SeedRental("boat-1", pricePerDay: 100f); // 10 000 cents per night
        Alice = T.SeedUser("alice");
        Bob = T.SeedUser("bob");
    }

    public void Dispose()
    {
        T.Dispose();
        GC.SuppressFinalize(this);
    }

    protected static DateOnly InDays(int n) => StripeTestContext.Today.AddDays(n);

    // ---- API calls ----

    protected Task<IActionResult> Checkout(string user, int startInDays, int nights, string? rental = null) =>
        T.NewController(user).CreateCheckout(new CreateCheckoutRequest(rental ?? Rental, InDays(startInDays), InDays(startInDays + nights)), default);

    protected Task<IActionResult> Sync(string user, string paymentId, bool admin = false) =>
        T.NewController(user, admin).SyncPayment(paymentId, default);

    protected Task<IActionResult> GetPayment(string user, string paymentId, bool admin = false) =>
        T.NewController(user, admin).GetPayment(paymentId, default);

    protected Task<IActionResult> Quote(string user, string bookingId, bool admin = false) =>
        T.NewController(user, admin).CancelQuote(bookingId, default);

    protected Task<IActionResult> Cancel(string user, string bookingId, bool admin = false) =>
        T.NewController(user, admin).CancelBooking(bookingId, default);

    protected Task<IActionResult> CancelPending(string user, string bookingId, bool admin = false) =>
        T.NewController(user, admin).CancelPending(bookingId, default);

    protected Task<IActionResult> Webhook(WebhookEvents.Signed evt)
    {
        var controller = T.NewController("stripe-has-no-user");
        controller.ControllerContext.HttpContext.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(evt.Payload));
        controller.ControllerContext.HttpContext.Request.Headers["Stripe-Signature"] = evt.Header;
        return controller.Webhook(default);
    }

    // ---- result helpers ----

    protected static int StatusOf(IActionResult result) =>
        (result as IStatusCodeActionResult)?.StatusCode ?? throw new InvalidOperationException($"{result.GetType().Name} has no status code");

    protected static TBody Ok<TBody>(IActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        return Assert.IsType<TBody>(ok.Value);
    }

    // ---- shortcuts for common steps ----

    protected async Task<CheckoutResponse> StartCheckout(string user, int startInDays, int nights) =>
        Ok<CheckoutResponse>(await Checkout(user, startInDays, nights));

    // Customer completes payment at Stripe and Stripe's webhook arrives.
    protected async Task<FakeSession> PayViaWebhook(string bookingId)
    {
        var session = T.Stripe.SessionForBooking(bookingId);
        T.Stripe.MarkPaid(session.Id);
        Assert.Equal(200, StatusOf(await Webhook(WebhookEvents.CheckoutCompleted(session))));
        return session;
    }

    protected string PaymentIdOf(string bookingId) => T.GetPayments(bookingId).Last().Id;
}
