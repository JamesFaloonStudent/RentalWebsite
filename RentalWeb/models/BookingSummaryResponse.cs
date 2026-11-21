namespace RentalWebsite.Models;


// What a customer sees about one of their bookings. Deliberately a flat read model:
// no entities and no Stripe ids leave the API.
public record BookingSummaryResponse(
    string BookingId,
    string RentalId,
    string? RentalName,
    string? Category,
    DateOnly StartDate,
    DateOnly EndDate,
    int Days,
    long UnitPriceCents,
    long TotalAmountCents,
    string Currency,
    string Status,
    DateTime ExpiresAt,
    DateTime CreatedAt,
    BookingPaymentSummary? Payment);


// The most recent payment attempt for the booking, if any.
public record BookingPaymentSummary(
    string Status,
    long AmountRefundedCents,
    string? CardBrand,
    string? Last4,
    string? ReceiptUrl);
