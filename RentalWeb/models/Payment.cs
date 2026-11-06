namespace RentalWebsite.Models;


public enum PaymentStatus
{
    Pending,
    Succeeded,
    Failed,
    Canceled,
    Refunded,
    PartiallyRefunded
}


// Card data never reaches this server (Stripe Checkout); only Stripe ids and
// non-sensitive display details (brand, last4) are stored.
public class Payment
{
    public string Id { get; set; } = Guid.NewGuid().ToString();

    public string BookingId { get; set; } = null!;
    public Booking? Booking { get; set; }

    public string StripeCheckoutSessionId { get; set; } = null!;
    public string? StripePaymentIntentId { get; set; }
    public string? StripeChargeId { get; set; }

    public long AmountCents { get; set; }
    public long AmountRefundedCents { get; set; }
    public string Currency { get; set; } = "cad";

    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;

    public string? CardBrand { get; set; }
    public string? Last4 { get; set; }
    public string? ReceiptUrl { get; set; }
    public string? FailureCode { get; set; }
    public string? FailureMessage { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? PaidAt { get; set; }

    public List<Refund> Refunds { get; set; } = [];
}
