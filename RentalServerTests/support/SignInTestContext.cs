using Microsoft.AspNetCore.Identity;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RentalWebsite.Database;
using RentalWebsite.Models;
using RentalWebsite.Security;
using RentalWebsite.Services;

namespace RentalServerTests.Support;


// Real Identity (UserManager over in-memory SQLite) plus a fake Google, so sign-in is tested end to end
// except for Google's own signature check. Every call uses a fresh scope, like one HTTP request.
public sealed class SignInTestContext : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly ServiceProvider _provider;

    public SignInTestContext()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        Config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["JWTConfig:Issuer"] = "http://localhost:8080",
            ["JWTConfig:Audience"] = "http://localhost:8080",
            ["JWTConfig:TokenValidityInMinutes"] = "60",
        }).Build();

        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(Config);
        services.AddDbContext<RentalDbContext>(options => options.UseSqlite(_connection));
        services.ConfigureIdentityServices();
        services.AddSingleton<IGoogleTokenVerifier>(Google);
        services.AddScoped<JwtService>();
        services.AddScoped<SignInService>();
        _provider = services.BuildServiceProvider();

        using var scope = _provider.CreateScope();
        scope.ServiceProvider.GetRequiredService<RentalDbContext>().Database.EnsureCreated();
    }

    public FakeGoogleTokenVerifier Google { get; } = new();

    // Change ADMIN_EMAILS between sign-ins via Config["ADMIN_EMAILS"]
    public IConfigurationRoot Config { get; }

    public Task<LoginResponse?> SignIn(string idToken)
    {
        var scope = _provider.CreateScope();
        return scope.ServiceProvider.GetRequiredService<SignInService>().SignInWithGoogleAsync(idToken);
    }

    // Runs a read against a fresh scope's DbContext / UserManager
    public async Task<T> Query<T>(Func<RentalDbContext, UserManager<User>, Task<T>> read)
    {
        using var scope = _provider.CreateScope();
        return await read(
            scope.ServiceProvider.GetRequiredService<RentalDbContext>(),
            scope.ServiceProvider.GetRequiredService<UserManager<User>>());
    }

    // A user that already exists without any Google link (e.g. created before Google sign-in)
    public async Task SeedUser(string email)
    {
        using var scope = _provider.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
        var result = await users.CreateAsync(new User { UserName = email, Email = email });
        Assert.True(result.Succeeded);
    }

    public void Dispose()
    {
        _provider.Dispose();
        _connection.Dispose();
    }
}
