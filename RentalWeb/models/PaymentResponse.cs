namespace RentalWebsite.Models;


public record PaymentResponse(
    string Id,
    string BookingId,
    string Status,
    long AmountCents,
    long AmountRefundedCents,
    string Currency,
    string? CardBrand,
    string? Last4,
    string? ReceiptUrl,
    DateTime CreatedAt,
    DateTime? PaidAt);


// What cancelling a paid booking would cost right now. FeeCents is kept by the
// business; RefundCents goes back to the customer.
public record CancellationQuote(
    string BookingId,
    long PaidCents,
    long FeeCents,
    long RefundCents,
    bool LateCancellation,
    int CancellationWindowDays,
    decimal FeePercent,
    string Currency);


public record CancelBookingResponse(
    string BookingId,
    string Status,
    long FeeCents,
    long RefundCents);
