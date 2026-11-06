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
    private static readonly string _adminUserId = RequireEnv("ADMIN_USER_ID");

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



        // Seed values must be constants: EF compares the model on every migration, so a
        // freshly generated hash, stamp or date would register as a pending change.
        builder.Entity<User>().HasData([
            new User
            {
                Id = _adminUserId,
                UserName = "james.faloon@bell.net",
                NormalizedUserName = "JAMES.FALOON@BELL.NET",
                Email = "james.faloon@bell.net",
                NormalizedEmail = "JAMES.FALOON@BELL.NET",
                EmailConfirmed = true,
                // Identity v3 hash of "password123"
                PasswordHash = "AQAAAAIAAYagAAAAEOgt9+QFPhPboQFqGRakYNvXGqHm9W9q8b/hqz+4uwpXC5if4iHa9KYXdWeQQSTfMA==",
                SecurityStamp = "44445391-1b15-4990-bff5-b2bc3f6d1a77",
                ConcurrencyStamp = "513f108b-5c1a-43f3-9706-386a6d257568",
                CreatedAt = new DateTime(2026, 10, 22, 0, 0, 0, DateTimeKind.Utc),
            }
        ]);


        builder.Entity<IdentityUserRole<string>>().HasData(
            new IdentityUserRole<string> { RoleId = _adminRoleId, UserId = _adminUserId });


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
