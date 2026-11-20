using System.Net;
using System.Text;
using System.Text.Json;
using System.Web;

namespace RentalServerTests.Support;


public sealed record RecordedRequest(HttpMethod Method, string Path, Dictionary<string, string> Form, string? IdempotencyKey);


public sealed class FakeSession
{
    public string Id { get; init; } = "";
    public string Url { get; init; } = "";
    public string? Customer { get; init; }
    public long AmountCents { get; init; }
    public string BookingId { get; init; } = "";
    public string Status { get; set; } = "open";
    public string PaymentStatus { get; set; } = "unpaid";
    public string? PaymentIntentId { get; set; }
    public string? ChargeId { get; set; }
    public string CardBrand { get; set; } = "visa";
    public string Last4 { get; set; } = "4242";
    public long AmountRefunded { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
}


// A small stateful stand-in for api.stripe.com. Plugged into a real StripeClient through
// SystemNetHttpClient, so the Stripe.net serialisation code is exercised for real.
public sealed class FakeStripeHandler : HttpMessageHandler
{
    private int _sequence;
    private readonly Dictionary<string, string> _responsesByIdempotencyKey = [];

    public List<RecordedRequest> Requests { get; } = [];
    public Dictionary<string, FakeSession> Sessions { get; } = [];

    // Any request whose path contains this text gets a Stripe-style 400 error.
    public string? FailPathContaining { get; set; }

    // Any request whose path contains this text fails like an unreachable server (connection refused).
    public string? UnreachablePathContaining { get; set; }

    public IEnumerable<RecordedRequest> RequestsTo(HttpMethod method, string pathContains) =>
        Requests.Where(r => r.Method == method && r.Path.Contains(pathContains, StringComparison.Ordinal));

    public FakeSession SessionForBooking(string bookingId) => Sessions.Values.Single(s => s.BookingId == bookingId);

    // ---- test controls: things that happen at Stripe, outside our server ----

    public FakeSession MarkPaid(string sessionId, string brand = "visa", string last4 = "4242")
    {
        var s = Sessions[sessionId];
        s.Status = "complete";
        s.PaymentStatus = "paid";
        s.PaymentIntentId ??= $"pi_{Interlocked.Increment(ref _sequence)}";
        s.ChargeId ??= $"ch_{Interlocked.Increment(ref _sequence)}";
        s.CardBrand = brand;
        s.Last4 = last4;
        s.ErrorCode = null;
        s.ErrorMessage = null;
        return s;
    }

    public FakeSession MarkFailedAttempt(string sessionId, string code = "card_declined", string message = "Your card was declined.")
    {
        var s = Sessions[sessionId];
        s.PaymentIntentId ??= $"pi_{Interlocked.Increment(ref _sequence)}";
        s.ErrorCode = code;
        s.ErrorMessage = message;
        return s;
    }

    public FakeSession MarkExpired(string sessionId)
    {
        var s = Sessions[sessionId];
        s.Status = "expired";
        return s;
    }

    // ---- request handling ----

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var body = request.Content is null ? "" : await request.Content.ReadAsStringAsync(cancellationToken);
        var form = Parse(body);
        var path = request.RequestUri!.AbsolutePath;
        string? key = request.Headers.TryGetValues("Idempotency-Key", out var values) ? values.First() : null;
        Requests.Add(new RecordedRequest(request.Method, path, form, key));

        if (UnreachablePathContaining is not null && path.Contains(UnreachablePathContaining, StringComparison.Ordinal))
        {
            throw new HttpRequestException("Connection refused");
        }

        if (FailPathContaining is not null && path.Contains(FailPathContaining, StringComparison.Ordinal))
        {
            return Error("Simulated Stripe failure.");
        }

        // Stripe replays the original response for a repeated idempotency key.
        if (key is not null && _responsesByIdempotencyKey.TryGetValue(key, out var replay))
        {
            return Json(replay);
        }

        var response = Route(request.Method, path, form);
        if (key is not null && response.IsSuccessStatusCode)
        {
            _responsesByIdempotencyKey[key] = await response.Content.ReadAsStringAsync(cancellationToken);
        }

        return response;
    }

    private HttpResponseMessage Route(HttpMethod method, string path, Dictionary<string, string> form)
    {
        if (method == HttpMethod.Post && path == "/v1/customers")
        {
            return Json(Serialize(new Dictionary<string, object?>
            {
                ["id"] = $"cus_{Interlocked.Increment(ref _sequence)}",
                ["object"] = "customer",
                ["email"] = form.GetValueOrDefault("email")
            }));
        }

        if (method == HttpMethod.Post && path == "/v1/checkout/sessions")
        {
            var id = $"cs_test_{Interlocked.Increment(ref _sequence)}";
            var session = new FakeSession
            {
                Id = id,
                Url = $"https://checkout.stripe.test/pay/{id}",
                Customer = form.GetValueOrDefault("customer"),
                AmountCents = long.Parse(form["line_items[0][price_data][unit_amount]"]),
                BookingId = form["metadata[bookingId]"]
            };
            Sessions[id] = session;
            return Json(SessionJson(session));
        }

        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);

        // /v1/checkout/sessions/{id}
        if (method == HttpMethod.Get && segments is ["v1", "checkout", "sessions", var getId] && Sessions.TryGetValue(getId, out var found))
        {
            return Json(SessionJson(found));
        }

        // /v1/checkout/sessions/{id}/expire
        if (method == HttpMethod.Post && segments is ["v1", "checkout", "sessions", var expireId, "expire"] && Sessions.TryGetValue(expireId, out var toExpire))
        {
            if (toExpire.Status != "open")
            {
                return Error("Only Checkout Sessions with a status of `open` can be expired.");
            }

            toExpire.Status = "expired";
            return Json(SessionJson(toExpire));
        }

        if (method == HttpMethod.Post && path == "/v1/refunds")
        {
            var intent = form["payment_intent"];
            var amount = long.Parse(form["amount"]);
            var session = Sessions.Values.FirstOrDefault(s => s.PaymentIntentId == intent);
            if (session is null || amount > session.AmountCents - session.AmountRefunded)
            {
                return Error("Refund amount is invalid.");
            }

            session.AmountRefunded += amount;
            return Json(Serialize(new Dictionary<string, object?>
            {
                ["id"] = $"re_{Interlocked.Increment(ref _sequence)}",
                ["object"] = "refund",
                ["amount"] = amount,
                ["currency"] = "cad",
                ["status"] = "succeeded",
                ["payment_intent"] = intent
            }));
        }

        return Error($"Unrecognized request URL: {method} {path}");
    }

    // ---- JSON builders (also used by tests to build webhook payloads) ----

    public static string SessionJson(FakeSession s)
    {
        object? intent = null;
        if (s.PaymentIntentId is not null)
        {
            object? charge = null;
            if (s.ChargeId is not null)
            {
                charge = new Dictionary<string, object?>
                {
                    ["id"] = s.ChargeId,
                    ["object"] = "charge",
                    ["amount"] = s.AmountCents,
                    ["amount_refunded"] = s.AmountRefunded,
                    ["payment_intent"] = s.PaymentIntentId,
                    ["receipt_url"] = $"https://pay.stripe.test/receipts/{s.ChargeId}",
                    ["payment_method_details"] = new Dictionary<string, object?>
                    {
                        ["type"] = "card",
                        ["card"] = new Dictionary<string, object?> { ["brand"] = s.CardBrand, ["last4"] = s.Last4 }
                    }
                };
            }

            intent = new Dictionary<string, object?>
            {
                ["id"] = s.PaymentIntentId,
                ["object"] = "payment_intent",
                ["status"] = s.PaymentStatus == "paid" ? "succeeded" : "requires_payment_method",
                ["metadata"] = new Dictionary<string, string> { ["bookingId"] = s.BookingId },
                ["latest_charge"] = charge,
                ["last_payment_error"] = s.ErrorCode is null
                    ? null
                    : new Dictionary<string, object?> { ["type"] = "card_error", ["code"] = s.ErrorCode, ["message"] = s.ErrorMessage }
            };
        }

        return Serialize(new Dictionary<string, object?>
        {
            ["id"] = s.Id,
            ["object"] = "checkout.session",
            ["url"] = s.Url,
            ["customer"] = s.Customer,
            ["client_reference_id"] = s.BookingId,
            ["amount_total"] = s.AmountCents,
            ["currency"] = "cad",
            ["status"] = s.Status,
            ["payment_status"] = s.PaymentStatus,
            ["payment_intent"] = intent,
            ["metadata"] = new Dictionary<string, string> { ["bookingId"] = s.BookingId }
        });
    }

    private static string Serialize(object value) => JsonSerializer.Serialize(value);

    private static HttpResponseMessage Json(string json) =>
        new(HttpStatusCode.OK) { Content = new StringContent(json, Encoding.UTF8, "application/json") };

    private static HttpResponseMessage Error(string message) =>
        new(HttpStatusCode.BadRequest)
        {
            Content = new StringContent(
                Serialize(new { error = new { type = "invalid_request_error", message } }),
                Encoding.UTF8, "application/json")
        };

    private static Dictionary<string, string> Parse(string body)
    {
        var result = new Dictionary<string, string>();
        var parsed = HttpUtility.ParseQueryString(body);
        foreach (var key in parsed.AllKeys)
        {
            if (key is not null)
            {
                result[key] = parsed[key] ?? "";
            }
        }

        return result;
    }
}
