using RentalWebsite.Models;

namespace RentalWebsite.Services;


// The one place that decides who may see a booking: its owner, or an admin.
public static class BookingAccess
{
    public static IQueryable<Booking> VisibleTo(this IQueryable<Booking> bookings, string userId, bool isAdmin) =>
        isAdmin ? bookings : bookings.Where(b => b.UserId == userId);
}
