using System.Net.Http.Headers;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using RentalWebsite.Controllers;
using RentalWebsite.Database;
using RentalWebsite.Models;
using RentalWebsite.Security;
using RentalWebsite.Services;

namespace RentalServerTests.Support;


// A real Kestrel host on a random local port running the production JWT bearer setup and the
// RentalController, so [Authorize] is enforced exactly as it is in the app (401/403 come from the
// pipeline, which calling the controller directly would skip). Backed by an in-memory SQLite DB.
public sealed class RentalApiHost : IAsyncDisposable
{
    public const string JwtKey = "test-jwt-signing-key-at-least-32-characters-long";

    // AuthenticationSetup hard-codes these, so tokens must carry the same values
    private const string Issuer = "http://localhost:8080";
    private const string Audience = "http://localhost:8080";

    // Signing in with this Google email gets the Admin role
    public const string AdminEmail = "boss@example.test";

    private readonly SqliteConnection _connection;
    private readonly WebApplication _app;

    private RentalApiHost(SqliteConnection connection, WebApplication app, HttpClient client, FakeGoogleTokenVerifier google)
    {
        _connection = connection;
        _app = app;
        Client = client;
        Google = google;
    }

    public HttpClient Client { get; }

    // Tokens registered here are accepted by POST /api/auth/google
    public FakeGoogleTokenVerifier Google { get; }

    public static async Task<RentalApiHost> StartAsync()
    {
        var connection = new SqliteConnection("DataSource=:memory:");
        connection.Open();

        var builder = WebApplication.CreateBuilder();
        builder.Configuration["JWTConfig:Issuer"] = Issuer;
        builder.Configuration["JWTConfig:Audience"] = Audience;
        builder.Configuration["JWTConfig:TokenValidityInMinutes"] = "5";
        builder.Configuration["ADMIN_EMAILS"] = AdminEmail;
        builder.WebHost.UseUrls("http://127.0.0.1:0");
        builder.Logging.ClearProviders();

        builder.Services.AddDbContext<RentalDbContext>(options => options.UseSqlite(connection));
        builder.Services.ConfigureIdentityServices();
        builder.Services.AddJwtBearer();
        var google = new FakeGoogleTokenVerifier();
        builder.Services.AddSingleton<IGoogleTokenVerifier>(google);
        builder.Services.AddScoped<JwtService>();
        builder.Services.AddScoped<SignInService>();
        builder.Services.AddScoped<RentalService>();
        builder.Services.AddControllers().AddApplicationPart(typeof(RentalController).Assembly);

        var app = builder.Build();
        using (var scope = app.Services.CreateScope())
        {
            scope.ServiceProvider.GetRequiredService<RentalDbContext>().Database.EnsureCreated();
        }

        app.UseAuthentication();
        app.UseAuthorization();
        app.MapControllers();
        await app.StartAsync();

        var client = new HttpClient { BaseAddress = new Uri(app.Urls.First()) };
        return new RentalApiHost(connection, app, client, google);
    }

    public void SeedRental(string id)
    {
        using var scope = _app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RentalDbContext>();
        db.Rentals.Add(new Rental { id = id, name = "Test Boat", visible = true });
        db.SaveChanges();
    }

    public bool RentalExists(string id)
    {
        using var scope = _app.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<RentalDbContext>().Rentals.Any(r => r.id == id);
    }

    public string? RentalName(string id)
    {
        using var scope = _app.Services.CreateScope();
        return scope.ServiceProvider.GetRequiredService<RentalDbContext>().Rentals.AsNoTracking().Single(r => r.id == id).name;
    }

    // Signed the same way JwtService signs login tokens
    public static string TokenFor(string userId, string role)
    {
        var descriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, userId),
                new Claim(ClaimTypes.Role, role)
            ]),
            Expires = DateTime.UtcNow.AddMinutes(5),
            Issuer = Issuer,
            Audience = Audience,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtKey)), SecurityAlgorithms.HmacSha256Signature)
        };
        return new JsonWebTokenHandler().CreateToken(descriptor);
    }

    public static AuthenticationHeaderValue Bearer(string token) => new("Bearer", token);

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await _app.DisposeAsync();
        await _connection.DisposeAsync();
    }
}
