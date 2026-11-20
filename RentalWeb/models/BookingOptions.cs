using System.ComponentModel.DataAnnotations;

namespace RentalWebsite.Models;


// Non-secret business rules, bound from the "Booking" section of appsettings.json.
public class BookingOptions
{
    public const string SectionName = "Booking";

    // How long an unpaid booking holds its dates (Stripe Checkout sessions last at least 30 minutes).
    [Range(31, 1440)]
    public int CheckoutHoldMinutes { get; set; } = 31;

    // Cancelling fewer than this many days before StartDate incurs the late-cancellation fee.
    [Range(0, 365)]
    public int CancellationWindowDays { get; set; } = 7;

    // Fee kept on a late cancellation, as a percentage of the amount paid.
    [Range(typeof(decimal), "0", "100")] // the (int, int) overload would round -0.4 or 100.4 into range
    public decimal LateCancellationFeePercent { get; set; } = 25;
}
