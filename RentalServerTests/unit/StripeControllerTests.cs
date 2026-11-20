using System.Reflection;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalServerTests.Support;
using RentalWebsite.Controllers;
using RentalWebsite.Models;

namespace RentalServerTests.Unit;


// The controller is a thin router: identity in, service call, PaymentException -> HTTP status out.
public sealed class StripeControllerTests : IDisposable
{
    private readonly StripeTestContext _t = new();
    private readonly string _user;
    private readonly string _rental;

    public StripeControllerTests()
    {
        _user = _t.SeedUser();
        _rental = _t.SeedRental();
    }

    public void Dispose() => _t.Dispose();

    private static DateOnly InDays(int n) => StripeTestContext.Today.AddDays(n);

    // ---- security attributes ----

    [Fact]
    public void Controller_requires_authentication_by_default()
    {
        Assert.NotNull(typeof(StripeController).GetCustomAttribute<AuthorizeAttribute>());
    }

    [Fact]
    public void Only_the_webhook_is_anonymous()
    {
        var anonymous = typeof(StripeController)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly)
            .Where(m => m.GetCustomAttribute<AllowAnonymousAttribute>() is not null)
            .Select(m => m.Name)
            .ToList();

        Assert.Equal(["Webhook"], anonymous);
    }

    // ---- success and error mapping ----

    [Fact]
    public async Task Checkout_returns_200_with_the_stripe_url()
    {
        var result = await _t.NewController(_user).CreateCheckout(new CreateCheckoutRequest(_rental, InDays(1), InDays(3)), default);

        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<CheckoutResponse>(ok.Value);
        Assert.StartsWith("https://checkout.stripe.test/", body.Url);
    }

    [Fact]
    public async Task Checkout_uses_the_callers_identity_from_the_token()
    {
        var other = _t.SeedUser("other");
        var result = await _t.NewController(other).CreateCheckout(new CreateCheckoutRequest(_rental, InDays(1), InDays(3)), default);

        var bookingId = ((CheckoutResponse)((OkObjectResult)result).Value!).BookingId;
        Assert.Equal(other, _t.GetBooking(bookingId).UserId);
    }

    [Fact]
    public async Task Validation_errors_map_to_400_with_a_message()
    {
        var result = await _t.NewController(_user).CreateCheckout(new CreateCheckoutRequest(_rental, InDays(-5), InDays(3)), default);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Contains("message", bad.Value!.ToString());
    }

    [Fact]
    public async Task Missing_things_map_to_404()
    {
        var result = await _t.NewController(_user).GetPayment("missing", default);
        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task Conflicts_map_to_409()
    {
        var booking = _t.SeedBooking(_rental, _user, InDays(10), InDays(12), BookingStatus.PendingPayment);

        var result = await _t.NewController(_user).CancelBooking(booking.Id, default);

        Assert.IsType<ConflictObjectResult>(result);
    }

    [Fact]
    public async Task Stripe_outages_map_to_502_without_leaking_details()
    {
        _t.Stripe.FailPathContaining = "/v1/checkout/sessions";

        var result = await _t.NewController(_user).CreateCheckout(new CreateCheckoutRequest(_rental, InDays(1), InDays(3)), default);

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(502, obj.StatusCode);
        Assert.DoesNotContain("Simulated", obj.Value!.ToString());
    }

    [Fact]
    public async Task Unexpected_errors_map_to_a_generic_500()
    {
        _t.Settings.Remove("APP_BASE_URL"); // configuration error -> InvalidOperationException

        var result = await _t.NewController(_user, service: _t.NewService())
            .CreateCheckout(new CreateCheckoutRequest(_rental, InDays(1), InDays(3)), default);

        var obj = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, obj.StatusCode);
        Assert.DoesNotContain("APP_BASE_URL", obj.Value!.ToString());
    }

    // ---- admin flag ----

    [Fact]
    public async Task Admin_role_claim_lets_a_caller_read_other_peoples_payments()
    {
        var (_, payment) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: 20);
        _t.SeedUser("someone");

        Assert.IsType<NotFoundObjectResult>(await _t.NewController("someone").GetPayment(payment.Id, default));
        Assert.IsType<OkObjectResult>(await _t.NewController("someone", isAdmin: true).GetPayment(payment.Id, default));
    }

    // ---- remaining routes delegate to the service ----

    [Fact]
    public async Task Read_sync_quote_and_cancel_routes_return_200_for_the_owner()
    {
        var (booking, payment) = _t.SeedPaidBooking(_rental, _user, daysUntilStart: 20);
        var controller = _t.NewController(_user);

        Assert.IsType<OkObjectResult>(await controller.GetBookingPayments(booking.Id, default));
        Assert.IsType<OkObjectResult>(await controller.CancelQuote(booking.Id, default));
        Assert.IsType<OkObjectResult>(await controller.SyncPayment(payment.Id, default));
        Assert.IsType<OkObjectResult>(await controller.CancelBooking(booking.Id, default));
    }

    [Fact]
    public async Task Cancel_pending_route_returns_200()
    {
        var checkout = await _t.NewService().CreateCheckoutAsync(_user, new CreateCheckoutRequest(_rental, InDays(1), InDays(3)));

        Assert.IsType<OkObjectResult>(await _t.NewController(_user).CancelPending(checkout.BookingId, default));
    }

    // ---- webhook ----

    [Fact]
    public async Task Webhook_reads_the_raw_body_and_signature_header()
    {
        var checkout = await _t.NewService().CreateCheckoutAsync(_user, new CreateCheckoutRequest(_rental, InDays(1), InDays(3)));
        var session = _t.Stripe.SessionForBooking(checkout.BookingId);
        _t.Stripe.MarkPaid(session.Id);
        var evt = WebhookEvents.CheckoutCompleted(session);

        var controller = _t.NewController("ignored");
        controller.ControllerContext.HttpContext.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes(evt.Payload));
        controller.ControllerContext.HttpContext.Request.Headers["Stripe-Signature"] = evt.Header;

        var result = await controller.Webhook(default);

        Assert.IsType<OkResult>(result);
        Assert.Equal(BookingStatus.Confirmed, _t.GetBooking(checkout.BookingId).Status);
    }

    [Fact]
    public async Task Webhook_with_a_bad_signature_returns_400()
    {
        var controller = _t.NewController("ignored");
        controller.ControllerContext.HttpContext.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{}"));
        controller.ControllerContext.HttpContext.Request.Headers["Stripe-Signature"] = "t=1,v1=deadbeef";

        Assert.IsType<BadRequestObjectResult>(await controller.Webhook(default));
    }

    [Fact]
    public async Task Webhook_without_a_signature_header_returns_400()
    {
        var controller = _t.NewController("ignored");
        controller.ControllerContext.HttpContext.Request.Body = new MemoryStream(Encoding.UTF8.GetBytes("{}"));

        Assert.IsType<BadRequestObjectResult>(await controller.Webhook(default));
    }
}
