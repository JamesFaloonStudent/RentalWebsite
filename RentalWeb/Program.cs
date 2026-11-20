using Microsoft.EntityFrameworkCore;
using RentalWebsite.Database;
using DotNetEnv;
using RentalWebsite.Models;
using RentalWebsite.Security;
using RentalWebsite.Services;
using Stripe;








// Load the .env file from the working directory or the nearest parent directory that has one
Env.NoClobber().TraversePath().Load();







var builder = WebApplication.CreateBuilder(args);




var useMock = builder.Configuration.GetValue<bool>("STRIPE_MOCK");

var client = useMock
    ? new StripeClient(apiKey: "sk_test_123", apiBase: "http://localhost:12111")
    : new StripeClient(apiKey: builder.Configuration["STRIPE_SECRET_KEY"]);

builder.Services.AddSingleton<IStripeClient>(client);


// Database Configuration 
builder.Services.AddDbContext<RentalDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Identity Configuration
builder.Services.ConfigureIdentityServices();

builder.Services.AddJwtBearer();

builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<IGoogleTokenVerifier, GoogleTokenVerifier>();
builder.Services.AddScoped<SignInService>();
builder.Services.AddScoped<RentalService>();

builder.Services.AddOptions<BookingOptions>()
    .Bind(builder.Configuration.GetSection(BookingOptions.SectionName))
    .ValidateDataAnnotations()
    .ValidateOnStart();
builder.Services.AddScoped<StripeService>();

builder.Services.AddControllers();




// Sign-in can't work without the Google client id, so fail at startup outside development
if (!builder.Environment.IsDevelopment() && string.IsNullOrWhiteSpace(builder.Configuration["GOOGLE_CLIENT_ID"]))
{
    throw new InvalidOperationException("GOOGLE_CLIENT_ID environment variable is not set.");
}

var app = builder.Build();

// DbContext is scoped, so it must be resolved from a scope rather than the root provider
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<RentalDbContext>();
    db.Database.Migrate();
}


app.MapGet("/", () => "Hello World!");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();




app.Run();
