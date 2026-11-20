using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalWebsite.Models;
using RentalWebsite.Services;


namespace RentalWebsite.Controllers;


// Thin router: authenticates, extracts the caller, delegates to StripeService, maps results to HTTP.
[ApiController]
[Authorize]
[Route("api/[controller]")]
public partial class StripeController(StripeService stripeService, ILogger<StripeController> logger) : ControllerBase
{
    private const int MaxWebhookBytes = 1_048_576;

    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
    private bool IsAdmin => User.IsInRole("Admin");

    [HttpPost("checkout")]
    public Task<IActionResult> CreateCheckout([FromBody] CreateCheckoutRequest request, CancellationToken ct) =>
        RunAsync(async () => Ok(await stripeService.CreateCheckoutAsync(UserId, request, ct)));

    [HttpGet("payments/{id}")]
    public Task<IActionResult> GetPayment(string id, CancellationToken ct) =>
        RunAsync(async () => Ok(await stripeService.GetPaymentAsync(UserId, IsAdmin, id, ct)));

    [HttpGet("bookings/{id}/payments")]
    public Task<IActionResult> GetBookingPayments(string id, CancellationToken ct) =>
        RunAsync(async () => Ok(await stripeService.GetBookingPaymentsAsync(UserId, IsAdmin, id, ct)));

    [HttpPost("payments/{id}/sync")]
    public Task<IActionResult> SyncPayment(string id, CancellationToken ct) =>
        RunAsync(async () => Ok(await stripeService.SyncPaymentAsync(UserId, IsAdmin, id, ct)));

    [HttpPost("bookings/{id}/cancel-pending")]
    public Task<IActionResult> CancelPending(string id, CancellationToken ct) =>
        RunAsync(async () => Ok(await stripeService.CancelPendingPaymentAsync(UserId, IsAdmin, id, ct)));

    [HttpGet("bookings/{id}/cancel-quote")]
    public Task<IActionResult> CancelQuote(string id, CancellationToken ct) =>
        RunAsync(async () => Ok(await stripeService.GetCancellationQuoteAsync(UserId, IsAdmin, id, ct)));

    [HttpPost("bookings/{id}/cancel")]
    public Task<IActionResult> CancelBooking(string id, CancellationToken ct) =>
        RunAsync(async () => Ok(await stripeService.CancelBookingAsync(UserId, IsAdmin, id, ct)));

    // Called by Stripe, not a browser: no JWT. Authenticity comes from the signature check in the service.
    [AllowAnonymous]
    [HttpPost("webhook")]
    [RequestSizeLimit(MaxWebhookBytes)]
    public Task<IActionResult> Webhook(CancellationToken ct) =>
        RunAsync(async () =>
        {
            using var reader = new StreamReader(Request.Body);
            var body = await reader.ReadToEndAsync(ct);
            await stripeService.HandleWebhookAsync(body, Request.Headers["Stripe-Signature"], ct);
            return Ok();
        });

    private async Task<IActionResult> RunAsync(Func<Task<IActionResult>> action)
    {
        try
        {
            return await action();
        }
        catch (PaymentException ex)
        {
            return ex.Kind switch
            {
                PaymentErrorKind.Validation => BadRequest(new { message = ex.Message }),
                PaymentErrorKind.NotFound => NotFound(new { message = ex.Message }),
                PaymentErrorKind.Conflict => Conflict(new { message = ex.Message }),
                _ => StatusCode(StatusCodes.Status502BadGateway, new { message = ex.Message })
            };
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            LogUnhandled(ex, Request.Path.Value);
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An unexpected error occurred." });
        }
    }

    [LoggerMessage(Level = LogLevel.Error, Message = "Unhandled error in {Path}")]
    private partial void LogUnhandled(Exception ex, string? path);
}
