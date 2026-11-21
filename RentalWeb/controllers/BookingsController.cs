using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalWebsite.Services;


namespace RentalWebsite.Controllers;


// Read-only view of bookings for the signed-in customer. Cancelling and paying stay in StripeController.
[ApiController]
[Authorize]
[Route("api/[controller]")]
public class BookingsController(BookingService bookingService) : ControllerBase
{
    private string UserId => User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
    private bool IsAdmin => User.IsInRole("Admin");

    [HttpGet]
    public async Task<IActionResult> GetMine(CancellationToken ct) =>
        Ok(await bookingService.ListMineAsync(UserId, ct));

    [HttpGet("{id}")]
    public async Task<IActionResult> Get(string id, CancellationToken ct)
    {
        try
        {
            return Ok(await bookingService.GetAsync(UserId, IsAdmin, id, ct));
        }
        catch (PaymentException ex) when (ex.Kind == PaymentErrorKind.NotFound)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
