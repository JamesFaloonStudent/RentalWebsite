using Microsoft.EntityFrameworkCore;
using RentalWebsite.Database;
using RentalWebsite.Models;

namespace RentalWebsite.Services;


// Read side of bookings: what a customer sees on their My rentals page.
public class BookingService(RentalDbContext db)
{
    public const int MaxResults = 100;

    // Always the caller's own bookings, even for admins: this is a personal list, not a management view.
    public async Task<List<BookingSummaryResponse>> ListMineAsync(string userId, CancellationToken ct)
    {
        // Order and cap on the entity query: EF can't translate ordering over the projected record.
        return await Summaries(
                db.Bookings.AsNoTracking()
                    .VisibleTo(userId, isAdmin: false)
                    .OrderByDescending(b => b.CreatedAt)
                    .Take(MaxResults))
            .ToListAsync(ct);
    }

    public async Task<BookingSummaryResponse> GetAsync(string userId, bool isAdmin, string bookingId, CancellationToken ct)
    {
        var booking = await Summaries(
                db.Bookings.AsNoTracking().VisibleTo(userId, isAdmin).Where(b => b.Id == bookingId))
            .FirstOrDefaultAsync(ct);

        // Someone else's booking is reported as missing so ids can't be probed.
        return booking ?? throw new PaymentException(PaymentErrorKind.NotFound, "Booking not found.");
    }

    private static IQueryable<BookingSummaryResponse> Summaries(IQueryable<Booking> bookings) =>
        bookings.Select(b => new BookingSummaryResponse(
            b.Id,
            b.RentalId,
            b.Rental!.name,
            b.Rental.category,
            b.StartDate,
            b.EndDate,
            b.Days,
            b.UnitPriceCents,
            b.TotalAmountCents,
            b.Currency,
            b.Status.ToString(),
            b.ExpiresAt,
            b.CreatedAt,
            b.Payments
                .OrderByDescending(p => p.CreatedAt)
                .Select(p => new BookingPaymentSummary(
                    p.Status.ToString(), p.AmountRefundedCents, p.CardBrand, p.Last4, p.ReceiptUrl))
                .FirstOrDefault()));
}
