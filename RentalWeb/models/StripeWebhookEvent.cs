namespace RentalWebsite.Models;


// Stripe retries webhooks; recording each event id makes handling idempotent.
public class StripeWebhookEvent
{
    public string Id { get; set; } = null!;
    public string Type { get; set; } = null!;
    public DateTime ProcessedAt { get; set; } = DateTime.UtcNow;
}
