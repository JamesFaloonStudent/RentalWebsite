using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RentalWeb.Migrations
{
    /// <inheritdoc />
    public partial class test : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: "664fce0e-b13c-4721-aee9-137a4f72f7bb",
                columns: new[] { "Email", "NormalizedEmail", "NormalizedUserName", "UserName" },
                values: new object[] { "test@example.com", "TEST@EXAMPLE.COM", "TEST@EXAMPLE.COM", "test@example.com" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.UpdateData(
                table: "AspNetUsers",
                keyColumn: "Id",
                keyValue: "664fce0e-b13c-4721-aee9-137a4f72f7bb",
                columns: new[] { "Email", "NormalizedEmail", "NormalizedUserName", "UserName" },
                values: new object[] { "james.faloon@bell.net", "JAMES.FALOON@BELL.NET", "JAMES.FALOON@BELL.NET", "james.faloon@bell.net" });
        }
    }
}
