using Microsoft.AspNetCore.Identity;


namespace RentalWebsite.Models;

public class User : IdentityUser
{
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

}


public record LoginRequest(string Email, string Password);


public record LoginResponse(string Email, string AccessToken, int ExpiresIn);

