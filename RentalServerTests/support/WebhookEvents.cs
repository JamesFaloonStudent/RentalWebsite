using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace RentalServerTests.Support;


// Builds Stripe webhook payloads and signs them exactly as Stripe does (HMAC-SHA256 over "t.payload").
public static class WebhookEvents
{
    public sealed record Signed(string EventId, string Payload, string Header);

    public static Signed CheckoutCompleted(FakeSession session, string? eventId = null) =>
        Create("checkout.session.completed", FakeStripeHandler.SessionJson(session), eventId);

    public static Signed CheckoutExpired(FakeSession session, string? eventId = null) =>
        Create("checkout.session.expired", FakeStripeHandler.SessionJson(session), eventId);

    public static Signed PaymentFailed(string paymentIntentId, string bookingId, string? eventId = null) =>
        Create("payment_intent.payment_failed", JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["id"] = paymentIntentId,
            ["object"] = "payment_intent",
            ["metadata"] = new Dictionary<string, string> { ["bookingId"] = bookingId }
        }), eventId);

    public static Signed ChargeRefunded(string paymentIntentId, long amountRefunded, string? eventId = null) =>
        Create("charge.refunded", JsonSerializer.Serialize(new Dictionary<string, object?>
        {
            ["id"] = "ch_event",
            ["object"] = "charge",
            ["payment_intent"] = paymentIntentId,
            ["amount_refunded"] = amountRefunded
        }), eventId);

    public static Signed Unrelated(string? eventId = null) =>
        Create("customer.created", """{"id":"cus_other","object":"customer"}""", eventId);

    public static Signed Create(string type, string objectJson, string? eventId = null, string secret = StripeTestContext.WebhookSecret)
    {
        eventId ??= $"evt_{Guid.NewGuid():N}";
        var created = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var payload =
            "{\"id\":\"" + eventId + "\",\"object\":\"event\",\"api_version\":\"2020-08-27\",\"created\":" + created
            + ",\"type\":\"" + type + "\",\"data\":{\"object\":" + objectJson + "}}";
        return new Signed(eventId, payload, Sign(payload, secret));
    }

    public static string Sign(string payload, string secret)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var hash = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes($"{timestamp}.{payload}"));
        return $"t={timestamp},v1={Convert.ToHexStringLower(hash)}";
    }
}
