using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RentalWeb.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSeededAdmin : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "AspNetUserRoles",
                keyColumns: new[] { "RoleId", "UserId" },
                keyValues: new object[] { "00000000-0000-0000-0000-000000000001", "664fce0e-b13c-4721-aee9-137a4f72f7bb" });

            migrationBuilder.DeleteData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: "664fce0e-b13c-4721-aee9-137a4f72f7bb");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "AspNetUsers",
                columns: new[] { "Id", "AccessFailedCount", "ConcurrencyStamp", "CreatedAt", "Email", "EmailConfirmed", "LockoutEnabled", "LockoutEnd", "NormalizedEmail", "NormalizedUserName", "PasswordHash", "PhoneNumber", "PhoneNumberConfirmed", "SecurityStamp", "StripeCustomerId", "TwoFactorEnabled", "UserName" },
                values: new object[] { "664fce0e-b13c-4721-aee9-137a4f72f7bb", 0, "513f108b-5c1a-43f3-9706-386a6d257568", new DateTime(2026, 10, 22, 0, 0, 0, 0, DateTimeKind.Utc), "test@example.com", true, false, null, "TEST@EXAMPLE.COM", "TEST@EXAMPLE.COM", "AQAAAAIAAYagAAAAEOgt9+QFPhPboQFqGRakYNvXGqHm9W9q8b/hqz+4uwpXC5if4iHa9KYXdWeQQSTfMA==", null, false, "44445391-1b15-4990-bff5-b2bc3f6d1a77", null, false, "test@example.com" });

            migrationBuilder.InsertData(
                table: "AspNetUserRoles",
                columns: new[] { "RoleId", "UserId" },
                values: new object[] { "00000000-0000-0000-0000-000000000001", "664fce0e-b13c-4721-aee9-137a4f72f7bb" });
        }
    }
}
