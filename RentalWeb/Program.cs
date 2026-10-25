using Microsoft.EntityFrameworkCore;
using RentalWebsite.Database;
using DotNetEnv;
using RentalWebsite.Security;
using RentalWebsite.Services;




// Load the .env file from the working directory or the nearest parent directory that has one
Env.NoClobber().TraversePath().Load();



var builder = WebApplication.CreateBuilder(args);





// Database Configuration 
builder.Services.AddDbContext<RentalDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("DefaultConnection")));

// Identity Configuration
builder.Services.ConfigureIdentityServices();

builder.Services.AddJwtBearer();

builder.Services.AddScoped<JwtService>();

builder.Services.AddControllers();




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
