using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using RentalWebsite.Models;
namespace RentalWebsite.Database;


public class RentalDbContext : IdentityDbContext<User>
{
    public RentalDbContext(DbContextOptions<RentalDbContext> options)
        : base(options)
    { }


    public DbSet<Rental> Rentals { get; set; } = null!;
    public DbSet<Booking> Bookings { get; set; } = null!;
    public DbSet<Payment> Payments { get; set; } = null!;
    public DbSet<Refund> Refunds { get; set; } = null!;
    public DbSet<StripeWebhookEvent> StripeWebhookEvents { get; set; } = null!;


    // Fixed IDs so migrations stay stable
    private static readonly string _adminRoleId = RequireEnv("ADMIN_ROLE_ID");

    private static string RequireEnv(string name) =>
        Environment.GetEnvironmentVariable(name)
        ?? throw new InvalidOperationException($"{name} is not set.");


    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);


        builder.Entity<User>()
            .HasIndex(u => u.StripeCustomerId)
            .IsUnique();

        builder.Entity<Booking>(b =>
        {
            b.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
            b.Property(x => x.Currency).HasMaxLength(3);
            b.HasIndex(x => new { x.RentalId, x.StartDate, x.EndDate });
            b.HasOne(x => x.Rental).WithMany().HasForeignKey(x => x.RentalId).OnDelete(DeleteBehavior.Restrict);
            b.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Payment>(p =>
        {
            p.Property(x => x.Status).HasConversion<string>().HasMaxLength(32);
            p.Property(x => x.Currency).HasMaxLength(3);
            p.HasIndex(x => x.StripeCheckoutSessionId).IsUnique();
            p.HasIndex(x => x.StripePaymentIntentId).IsUnique();
            p.HasOne(x => x.Booking).WithMany(x => x.Payments).HasForeignKey(x => x.BookingId).OnDelete(DeleteBehavior.Restrict);
        });

        builder.Entity<Refund>(r =>
        {
            r.HasIndex(x => x.StripeRefundId).IsUnique();
            r.HasOne(x => x.Payment).WithMany(x => x.Refunds).HasForeignKey(x => x.PaymentId).OnDelete(DeleteBehavior.Restrict);
        });


        builder.Entity<IdentityRole>().HasData([
            new IdentityRole
            {
                Id = _adminRoleId,
                Name = "Admin",
                NormalizedName = "ADMIN",
                ConcurrencyStamp = "1"
            },
            new IdentityRole
            {
                Id = "2",
                Name = "User",
                NormalizedName = "USER",
                ConcurrencyStamp = "2"
            }
        ]);



        // No users are seeded: people sign in with Google (SignInService) and admins are chosen by
        // the ADMIN_EMAILS environment variable, so no credentials live in the repository.


        builder.Entity<Rental>().HasData(
            new Rental
            {
                id = "5b1f0c3e-7a64-4d2b-9e8a-3c6f1d2a4b70",
                imageUrl = null,
                category = "Boat",
                name = "Example Boat",
                type = "Sailboat",
                description = "This is an example sailboat for rent.",
                pricePerDay = 100000.00f,
                location = "Marina Bay",
                visible = true,
                capacity = 6,
                lengthFt = 30,
                licence = "AB123456",
                included = new List<string> { "Life Jackets", "Anchor", "GPS" }
            }
        );
    }


}
