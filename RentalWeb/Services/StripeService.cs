using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using RentalWebsite.Database;
using RentalWebsite.Models;
using Stripe;
using Stripe.Checkout;
using RefundEntity = RentalWebsite.Models.Refund;

namespace RentalWebsite.Services;


// All Stripe + payment/booking business logic. StripeController only authenticates and
// maps results to HTTP; amounts, status and fees are always derived here, never from the client.
public partial class StripeService(
    IStripeClient client,
    RentalDbContext db,
    IConfiguration config,
    IOptions<BookingOptions> options,
    ILogger<StripeService> logger)
{
    private const int MaxBookingDays = 365;

    private readonly BookingOptions _options = options.Value;

    // ---------------------------------------------------------------- checkout

    public async Task<CheckoutResponse> CreateCheckoutAsync(string userId, CreateCheckoutRequest request, CancellationToken ct = default)
    {
        // Fail on misconfiguration before any booking exists to hold the dates.
        var baseUrl = BaseUrl();

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        if (request.StartDate < today)
        {
            throw new PaymentException(PaymentErrorKind.Validation, "The start date cannot be in the past.");
        }

        var days = request.EndDate.DayNumber - request.StartDate.DayNumber;
        if (days < 1 || days > MaxBookingDays)
        {
            throw new PaymentException(PaymentErrorKind.Validation, $"A booking must be between 1 and {MaxBookingDays} days.");
        }

        var rental = await db.Rentals.FindAsync([request.RentalId], ct);
        if (rental is null || rental.visible != true)
        {
            throw new PaymentException(PaymentErrorKind.NotFound, "Rental not found.");
        }

        var user = await db.Users.FindAsync([userId], ct)
            ?? throw new PaymentException(PaymentErrorKind.NotFound, "User not found.");

        // Price is computed here from the stored rate; the client never supplies an amount.
        var unitPriceCents = (long)Math.Round((decimal)rental.pricePerDay * 100m, MidpointRounding.AwayFromZero);
        if (unitPriceCents <= 0)
        {
            throw new PaymentException(PaymentErrorKind.Validation, "This rental cannot be booked.");
        }

        var now = DateTime.UtcNow;
        var booking = new Booking
        {
            RentalId = rental.id,
            UserId = userId,
            StartDate = request.StartDate,
            EndDate = request.EndDate,
            Days = days,
            UnitPriceCents = unitPriceCents,
            TotalAmountCents = unitPriceCents * days,
            Status = BookingStatus.PendingPayment,
            ExpiresAt = now.AddMinutes(_options.CheckoutHoldMinutes),
            CreatedAt = now,
            UpdatedAt = now
        };

        // Dates are half-open [start, end). There is no DB constraint, so check and insert in one transaction.
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            var overlaps = await db.Bookings.AnyAsync(b =>
                b.RentalId == rental.id
                && b.StartDate < request.EndDate
                && b.EndDate > request.StartDate
                && (b.Status == BookingStatus.Confirmed
                    || (b.Status == BookingStatus.PendingPayment && b.ExpiresAt > now)), ct);
            if (overlaps)
            {
                throw new PaymentException(PaymentErrorKind.Conflict, "Those dates are not available.");
            }

            db.Bookings.Add(booking);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }

        try
        {
            var customerId = await EnsureCustomerAsync(user, ct);

            var sessionOptions = new SessionCreateOptions
            {
                Mode = "payment",
                Customer = customerId,
                ClientReferenceId = booking.Id,
                SuccessUrl = $"{baseUrl}/my-rentals?booking={booking.Id}&checkout=success",
                CancelUrl = $"{baseUrl}/listings/{Uri.EscapeDataString(rental.id)}/book?checkout=canceled",
                ExpiresAt = booking.ExpiresAt,
                LineItems =
                [
                    new SessionLineItemOptions
                    {
                        Quantity = 1,
                        PriceData = new SessionLineItemPriceDataOptions
                        {
                            Currency = booking.Currency,
                            UnitAmount = booking.TotalAmountCents,
                            ProductData = new SessionLineItemPriceDataProductDataOptions
                            {
                                Name = $"{rental.name} ({days} day{(days == 1 ? "" : "s")})"
                            }
                        }
                    }
                ],
                Metadata = new Dictionary<string, string> { ["bookingId"] = booking.Id },
                PaymentIntentData = new SessionPaymentIntentDataOptions
                {
                    Metadata = new Dictionary<string, string> { ["bookingId"] = booking.Id }
                }
            };

            var session = await new SessionService(client).CreateAsync(
                sessionOptions, new RequestOptions { IdempotencyKey = $"checkout-{booking.Id}" }, ct);

            db.Payments.Add(new Payment
            {
                BookingId = booking.Id,
                StripeCheckoutSessionId = session.Id,
                AmountCents = booking.TotalAmountCents,
                Currency = booking.Currency,
                Status = PaymentStatus.Pending
            });
            await db.SaveChangesAsync(ct);

            return new CheckoutResponse(booking.Id, session.Url);
        }
        catch (StripeException ex)
        {
            // Free the dates immediately instead of waiting for the hold to lapse.
            booking.Status = BookingStatus.Expired;
            booking.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(CancellationToken.None);
            throw Upstream(ex, "create checkout session");
        }
    }

    // ------------------------------------------------------------------- reads

    public async Task<PaymentResponse> GetPaymentAsync(string userId, bool isAdmin, string paymentId, CancellationToken ct = default)
    {
        var payment = await LoadPaymentAsync(userId, isAdmin, paymentId, ct);
        return ToResponse(payment);
    }

    public async Task<List<PaymentResponse>> GetBookingPaymentsAsync(string userId, bool isAdmin, string bookingId, CancellationToken ct = default)
    {
        var booking = await LoadBookingAsync(userId, isAdmin, bookingId, ct);
        return [.. booking.Payments.OrderBy(p => p.CreatedAt).Select(ToResponse)];
    }

    // -------------------------------------------------------------------- sync

    // Re-reads the checkout session from Stripe and updates the payment and booking.
    // Idempotent; also used by the webhook.
    public async Task<PaymentResponse> SyncPaymentAsync(string userId, bool isAdmin, string paymentId, CancellationToken ct = default)
    {
        var payment = await LoadPaymentAsync(userId, isAdmin, paymentId, ct);
        try
        {
            await ApplySessionAsync(payment, ct);
        }
        catch (StripeException ex)
        {
            throw Upstream(ex, "sync payment");
        }

        await db.SaveChangesAsync(ct);
        return ToResponse(payment);
    }

    // ----------------------------------------------------------------- webhook

    public async Task HandleWebhookAsync(string rawBody, string? signatureHeader, CancellationToken ct = default)
    {
        var secret = config["STRIPE_WEBHOOK_SECRET"];
        if (string.IsNullOrWhiteSpace(secret))
        {
            throw new InvalidOperationException("STRIPE_WEBHOOK_SECRET is not configured.");
        }

        if (string.IsNullOrWhiteSpace(signatureHeader))
        {
            throw new PaymentException(PaymentErrorKind.Validation, "Missing signature.");
        }

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(rawBody, signatureHeader, secret, throwOnApiVersionMismatch: false);
        }
        catch (StripeException)
        {
            throw new PaymentException(PaymentErrorKind.Validation, "Invalid signature.");
        }

        if (await db.StripeWebhookEvents.AnyAsync(e => e.Id == stripeEvent.Id, ct))
        {
            return;
        }

        try
        {
            await DispatchEventAsync(stripeEvent, ct);

            // Recorded together with the changes it caused, so a failed run is retried by Stripe.
            db.StripeWebhookEvents.Add(new StripeWebhookEvent { Id = stripeEvent.Id, Type = stripeEvent.Type });
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (db.StripeWebhookEvents.Local.Any(e => e.Id == stripeEvent.Id))
        {
            // Concurrent delivery of the same event already recorded it.
            LogDuplicateEvent(stripeEvent.Id);
        }
    }

    private async Task DispatchEventAsync(Event stripeEvent, CancellationToken ct)
    {
        Payment? payment = null;
        switch (stripeEvent.Data.Object)
        {
            case Session session:
                payment = await db.Payments.Include(p => p.Booking)
                    .FirstOrDefaultAsync(p => p.StripeCheckoutSessionId == session.Id, ct);
                break;

            case PaymentIntent intent when stripeEvent.Type == EventTypes.PaymentIntentPaymentFailed:
                if (intent.Metadata is not null && intent.Metadata.TryGetValue("bookingId", out var bookingId))
                {
                    payment = await db.Payments.Include(p => p.Booking)
                        .Where(p => p.BookingId == bookingId)
                        .OrderByDescending(p => p.CreatedAt)
                        .FirstOrDefaultAsync(ct);
                }
                break;

            case Charge charge when stripeEvent.Type == EventTypes.ChargeRefunded:
                payment = await db.Payments.Include(p => p.Booking)
                    .FirstOrDefaultAsync(p => p.StripePaymentIntentId == charge.PaymentIntentId, ct);
                if (payment is not null)
                {
                    ApplyRefundTotals(payment, charge.AmountRefunded);
                    return;
                }
                break;

            default:
                return;
        }

        if (payment is null)
        {
            LogUnmatchedEvent(stripeEvent.Type);
            return;
        }

        await ApplySessionAsync(payment, ct);
    }

    // ----------------------------------------------------------- cancellation

    // Cancel an unpaid booking: expire the Checkout session and release the dates.
    public async Task<CancelBookingResponse> CancelPendingPaymentAsync(string userId, bool isAdmin, string bookingId, CancellationToken ct = default)
    {
        var booking = await LoadBookingAsync(userId, isAdmin, bookingId, ct);
        if (booking.Status != BookingStatus.PendingPayment)
        {
            throw new PaymentException(PaymentErrorKind.Conflict, "Only an unpaid booking can be cancelled this way.");
        }

        foreach (var payment in booking.Payments.Where(p => p.Status == PaymentStatus.Pending))
        {
            try
            {
                await new SessionService(client).ExpireAsync(payment.StripeCheckoutSessionId, cancellationToken: ct);
                payment.Status = PaymentStatus.Canceled;
            }
            catch (StripeException ex)
            {
                // Most likely the customer paid in the meantime; reconcile before deciding.
                try
                {
                    await ApplySessionAsync(payment, ct);
                }
                catch (StripeException)
                {
                    throw Upstream(ex, "expire checkout session");
                }

                await db.SaveChangesAsync(ct);
                if (payment.Status == PaymentStatus.Succeeded)
                {
                    throw new PaymentException(PaymentErrorKind.Conflict, "This booking has already been paid.");
                }

                throw Upstream(ex, "expire checkout session");
            }
        }

        booking.Status = BookingStatus.Cancelled;
        booking.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);

        return new CancelBookingResponse(booking.Id, booking.Status.ToString(), 0, 0);
    }

    // Preview of the fee and refund, with no side effects.
    public async Task<CancellationQuote> GetCancellationQuoteAsync(string userId, bool isAdmin, string bookingId, CancellationToken ct = default)
    {
        var booking = await LoadBookingAsync(userId, isAdmin, bookingId, ct);
        var payment = GetCancellablePayment(booking);
        return BuildQuote(booking, payment);
    }

    // Cancel a paid booking: refund everything except the late-cancellation fee, if one applies.
    public async Task<CancelBookingResponse> CancelBookingAsync(string userId, bool isAdmin, string bookingId, CancellationToken ct = default)
    {
        var booking = await LoadBookingAsync(userId, isAdmin, bookingId, ct);
        var payment = GetCancellablePayment(booking);
        var quote = BuildQuote(booking, payment);

        RefundEntity? refundRow = null;
        if (quote.RefundCents > 0)
        {
            Stripe.Refund refund;
            try
            {
                refund = await new RefundService(client).CreateAsync(
                    new RefundCreateOptions
                    {
                        PaymentIntent = payment.StripePaymentIntentId,
                        Amount = quote.RefundCents,
                        Reason = "requested_by_customer",
                        Metadata = new Dictionary<string, string>
                        {
                            ["bookingId"] = booking.Id,
                            ["feeCents"] = quote.FeeCents.ToString(System.Globalization.CultureInfo.InvariantCulture)
                        }
                    },
                    new RequestOptions { IdempotencyKey = $"cancel-{booking.Id}-{quote.RefundCents}" },
                    ct);
            }
            catch (StripeException ex)
            {
                throw Upstream(ex, "create refund");
            }

            refundRow = new RefundEntity
            {
                PaymentId = payment.Id,
                StripeRefundId = refund.Id,
                AmountCents = quote.RefundCents,
                Reason = quote.LateCancellation ? "Late cancellation (fee applied)" : "Customer cancellation",
                Status = refund.Status,
                RequestedByUserId = userId
            };
            db.Refunds.Add(refundRow);
            ApplyRefundTotals(payment, payment.AmountRefundedCents + quote.RefundCents);
        }

        booking.Status = BookingStatus.Cancelled;
        booking.UpdatedAt = DateTime.UtcNow;

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (refundRow is not null)
        {
            // A concurrent identical request already recorded this refund (same Stripe refund id).
            throw new PaymentException(PaymentErrorKind.Conflict, "This booking has already been cancelled.");
        }

        return new CancelBookingResponse(booking.Id, booking.Status.ToString(), quote.FeeCents, quote.RefundCents);
    }

    // ----------------------------------------------------------------- helpers

    private CancellationQuote BuildQuote(Booking booking, Payment payment)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var daysUntilStart = booking.StartDate.DayNumber - today.DayNumber;
        if (daysUntilStart < 0)
        {
            throw new PaymentException(PaymentErrorKind.Conflict, "This rental has already started and cannot be cancelled.");
        }

        var late = daysUntilStart < _options.CancellationWindowDays;
        var fee = late
            ? (long)Math.Round(payment.AmountCents * _options.LateCancellationFeePercent / 100m, MidpointRounding.AwayFromZero)
            : 0;
        fee = Math.Min(fee, payment.AmountCents);

        var refund = Math.Max(0, payment.AmountCents - payment.AmountRefundedCents - fee);
        return new CancellationQuote(
            booking.Id, payment.AmountCents, fee, refund, late,
            _options.CancellationWindowDays, _options.LateCancellationFeePercent, payment.Currency);
    }

    private static Payment GetCancellablePayment(Booking booking)
    {
        if (booking.Status != BookingStatus.Confirmed)
        {
            throw new PaymentException(PaymentErrorKind.Conflict,
                booking.Status == BookingStatus.PendingPayment
                    ? "This booking has not been paid. Cancel it as an unpaid booking instead."
                    : "This booking has already been cancelled.");
        }

        var payment = booking.Payments.FirstOrDefault(p => p.Status == PaymentStatus.Succeeded);
        if (payment is null || string.IsNullOrEmpty(payment.StripePaymentIntentId))
        {
            throw new PaymentException(PaymentErrorKind.Conflict, "No completed payment was found for this booking.");
        }

        return payment;
    }

    // Pulls the session (with its payment intent and charge) from Stripe and applies it.
    // Never moves a payment backwards out of a paid or refunded state.
    private async Task ApplySessionAsync(Payment payment, CancellationToken ct)
    {
        var session = await new SessionService(client).GetAsync(
            payment.StripeCheckoutSessionId,
            new SessionGetOptions { Expand = ["payment_intent.latest_charge"] },
            cancellationToken: ct);

        var booking = payment.Booking
            ?? await db.Bookings.FindAsync([payment.BookingId], ct)
            ?? throw new InvalidOperationException("Payment has no booking.");

        var intent = session.PaymentIntent;
        payment.StripePaymentIntentId ??= intent?.Id ?? session.PaymentIntentId;

        if (intent?.LatestCharge is { } charge)
        {
            payment.StripeChargeId = charge.Id;
            payment.ReceiptUrl = charge.ReceiptUrl;
            payment.CardBrand = charge.PaymentMethodDetails?.Card?.Brand;
            payment.Last4 = charge.PaymentMethodDetails?.Card?.Last4;
            ApplyRefundTotals(payment, charge.AmountRefunded);
        }

        if (session.PaymentStatus == "paid" && payment.Status is PaymentStatus.Pending or PaymentStatus.Failed or PaymentStatus.Canceled)
        {
            payment.Status = PaymentStatus.Succeeded;
            payment.PaidAt ??= DateTime.UtcNow;
            payment.FailureCode = null;
            payment.FailureMessage = null;

            if (booking.Status == BookingStatus.PendingPayment)
            {
                booking.Status = BookingStatus.Confirmed;
                booking.UpdatedAt = DateTime.UtcNow;
            }
            else
            {
                // Paid after the booking was released: needs a manual refund.
                LogPaidInactiveBooking(payment.Id, booking.Id, booking.Status);
            }
        }
        else if (session.Status == "expired" && payment.Status == PaymentStatus.Pending)
        {
            payment.Status = PaymentStatus.Canceled;
            if (booking.Status == BookingStatus.PendingPayment)
            {
                booking.Status = BookingStatus.Expired;
                booking.UpdatedAt = DateTime.UtcNow;
            }
        }
        else if (payment.Status == PaymentStatus.Pending && intent?.LastPaymentError is { } error)
        {
            // The customer can retry within the session, so the payment stays Pending.
            payment.FailureCode = error.Code;
            payment.FailureMessage = error.Message;
        }
    }

    private static void ApplyRefundTotals(Payment payment, long totalRefundedCents)
    {
        if (totalRefundedCents <= 0 || payment.Status is PaymentStatus.Pending or PaymentStatus.Failed or PaymentStatus.Canceled)
        {
            return;
        }

        payment.AmountRefundedCents = Math.Min(totalRefundedCents, payment.AmountCents);
        payment.Status = payment.AmountRefundedCents >= payment.AmountCents
            ? PaymentStatus.Refunded
            : PaymentStatus.PartiallyRefunded;
    }

    private async Task<string> EnsureCustomerAsync(User user, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(user.StripeCustomerId))
        {
            return user.StripeCustomerId;
        }

        var customer = await new CustomerService(client).CreateAsync(
            new CustomerCreateOptions
            {
                Email = user.Email,
                Metadata = new Dictionary<string, string> { ["userId"] = user.Id }
            },
            new RequestOptions { IdempotencyKey = $"customer-{user.Id}" },
            ct);

        user.StripeCustomerId = customer.Id;
        await db.SaveChangesAsync(ct);
        return customer.Id;
    }

    private async Task<Payment> LoadPaymentAsync(string userId, bool isAdmin, string paymentId, CancellationToken ct)
    {
        var payment = await db.Payments.Include(p => p.Booking)
            .FirstOrDefaultAsync(p => p.Id == paymentId, ct);

        // Someone else's payment is reported as missing so ids can't be probed.
        if (payment?.Booking is null || (!isAdmin && payment.Booking.UserId != userId))
        {
            throw new PaymentException(PaymentErrorKind.NotFound, "Payment not found.");
        }

        return payment;
    }

    private async Task<Booking> LoadBookingAsync(string userId, bool isAdmin, string bookingId, CancellationToken ct)
    {
        var booking = await db.Bookings.Include(b => b.Payments)
            .FirstOrDefaultAsync(b => b.Id == bookingId, ct);

        if (booking is null || (!isAdmin && booking.UserId != userId))
        {
            throw new PaymentException(PaymentErrorKind.NotFound, "Booking not found.");
        }

        return booking;
    }

    private string BaseUrl()
    {
        var url = config["APP_BASE_URL"];
        if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url, UriKind.Absolute, out _))
        {
            throw new InvalidOperationException("APP_BASE_URL is not configured as an absolute URL.");
        }

        return url.TrimEnd('/');
    }

    private PaymentException Upstream(StripeException ex, string operation)
    {
        LogStripeFailure(ex, operation, ex.StripeError?.Message);
        return new PaymentException(PaymentErrorKind.Upstream, "The payment provider is unavailable. Please try again.");
    }

    [LoggerMessage(Level = LogLevel.Information, Message = "Duplicate Stripe webhook event {EventId} ignored.")]
    private partial void LogDuplicateEvent(string eventId);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Stripe event {EventType} did not match any payment.")]
    private partial void LogUnmatchedEvent(string eventType);

    [LoggerMessage(Level = LogLevel.Warning, Message = "Payment {PaymentId} succeeded for booking {BookingId} in status {Status}; manual refund needed.")]
    private partial void LogPaidInactiveBooking(string paymentId, string bookingId, BookingStatus status);

    [LoggerMessage(Level = LogLevel.Error, Message = "Stripe call failed while trying to {Operation}: {StripeMessage}")]
    private partial void LogStripeFailure(Exception ex, string operation, string? stripeMessage);

    private static PaymentResponse ToResponse(Payment p) => new(
        p.Id, p.BookingId, p.Status.ToString(), p.AmountCents, p.AmountRefundedCents, p.Currency,
        p.CardBrand, p.Last4, p.ReceiptUrl, p.CreatedAt, p.PaidAt);
}
