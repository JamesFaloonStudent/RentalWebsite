namespace RentalWebsite.Models;


public class Refund
{
    public string Id { get; set; } = Guid.NewGuid().ToString();

    public string PaymentId { get; set; } = null!;
    public Payment? Payment { get; set; }

    public string StripeRefundId { get; set; } = null!;
    public long AmountCents { get; set; }
    public string? Reason { get; set; }
    public string Status { get; set; } = null!;

    public string RequestedByUserId { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}


// AmountCents null means refund the full remaining amount.
public record RefundRequest(string PaymentId, long? AmountCents, string? Reason);
