using Microsoft.AspNetCore.Identity;


namespace RentalWebsite.Models;

public class User : IdentityUser
{
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? StripeCustomerId { get; set; }

}


// The Google ID token (a JWT) from the "Sign in with Google" button
public record GoogleSignInRequest(string IdToken);


public record LoginResponse(string Email, string AccessToken, int ExpiresIn);

