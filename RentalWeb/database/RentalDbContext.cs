using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RentalWebsite.Models;


namespace RentalWebsite.Database;


public class RentalDbContext : IdentityDbContext<User>
{
    public RentalDbContext(DbContextOptions<RentalDbContext> options)
        : base(options)
    {
    }


     protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);


        // Seed values must be constants: EF compares the model on every migration, so a
        // freshly generated hash, stamp or date would register as a pending change.
        builder.Entity<User>().HasData([
            new User
            {
                Id = "664fce0e-b13c-4721-aee9-137a4f72f7bb",
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

       


    }


}
