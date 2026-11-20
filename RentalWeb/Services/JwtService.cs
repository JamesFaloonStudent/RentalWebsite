using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using RentalWebsite.Models;


namespace RentalWebsite.Services;


// Issues the app's own access tokens. Sign-in itself (Google) is handled by SignInService.
public class JwtService
{
    private readonly IConfiguration _configuration;

    public JwtService(IConfiguration configuration)
    {
        _configuration = configuration;
    }


    public LoginResponse IssueToken(User user, string role)
    {
        var issuer = _configuration["JWTConfig:Issuer"];
        var audience = _configuration["JWTConfig:Audience"];
        var tokenValidityInMinutes = _configuration.GetValue<int>("JWTConfig:TokenValidityInMinutes");
        var key = Environment.GetEnvironmentVariable("JWT_KEY") ?? throw new InvalidOperationException("JWT_KEY environment variable is not set.");

        var tokenExpirationStamp = DateTime.UtcNow.AddMinutes(tokenValidityInMinutes);
        var email = user.Email ?? throw new InvalidOperationException("Users must have an email address.");

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, user.Id),
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.Role, role)
            ]),
            Expires = tokenExpirationStamp,
            Issuer = issuer,
            Audience = audience,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256Signature)
        };

        var accessToken = new JsonWebTokenHandler().CreateToken(tokenDescriptor);

        return new LoginResponse(email, accessToken, (int)tokenExpirationStamp.Subtract(DateTime.UtcNow).TotalSeconds);
    }
}
