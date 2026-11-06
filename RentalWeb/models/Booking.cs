namespace RentalWebsite.Models;


public enum BookingStatus
{
    PendingPayment,
    Confirmed,
    Cancelled,
    Expired,
    Refunded
}


public class Booking
{
    public string Id { get; set; } = Guid.NewGuid().ToString();

    public string RentalId { get; set; } = null!;
    public Rental? Rental { get; set; }

    public string UserId { get; set; } = null!;
    public User? User { get; set; }

    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public int Days { get; set; }

    // Snapshot of the price at booking time, in minor units (cents), so later
    // changes to Rental.pricePerDay never alter an existing booking.
    public long UnitPriceCents { get; set; }
    public long TotalAmountCents { get; set; }
    public string Currency { get; set; } = "cad";

    public BookingStatus Status { get; set; } = BookingStatus.PendingPayment;

    // An unpaid booking stops blocking its dates after this time.
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<Payment> Payments { get; set; } = [];
}


public record CreateCheckoutRequest(string RentalId, DateOnly StartDate, DateOnly EndDate);

public record CheckoutResponse(string BookingId, string Url);
