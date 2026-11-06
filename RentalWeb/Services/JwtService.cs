using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Identity;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using RentalWebsite.Models;


namespace RentalWebsite.Services;


public class JwtService
{
    private readonly UserManager<User> _userManager;

    private readonly IConfiguration _configuration;




    public JwtService(UserManager<User> userManager, IConfiguration configuration)
    {
        _userManager = userManager;
        _configuration = configuration;
    }




    // Returns null when the email or password is wrong so the controller can respond 401.
    public async Task<LoginResponse?> Authenticate(LoginRequest request)
    {
        if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Password))
        {
            return null;
        }

        var userAccount = await _userManager.FindByEmailAsync(request.Email);
        if (userAccount == null || !await _userManager.CheckPasswordAsync(userAccount, request.Password))
        {
            return null;
        }

        var role = await _userManager.GetRolesAsync(userAccount);






       
        var issuer = _configuration["JWTConfig:Issuer"];
        var audience = _configuration["JWTConfig:Audience"];
        var tokenValidityInMinutes = _configuration.GetValue<int>("JWTConfig:TokenValidityInMinutes");
        var key = Environment.GetEnvironmentVariable("JWT_KEY") ?? throw new InvalidOperationException("JWT_KEY environment variable is not set.");

        var tokenExpirationStamp = DateTime.UtcNow.AddMinutes(tokenValidityInMinutes);
        var email = userAccount.Email ?? request.Email;

        // TODO : figure out with SecurityTokenDescriptor is the docs are not clear 
        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(
            [
                new Claim(ClaimTypes.NameIdentifier, userAccount.Id),
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.Role, role.FirstOrDefault() ?? "User")
            ]),
            Expires = tokenExpirationStamp,
            Issuer = issuer,
            Audience = audience,
            SigningCredentials = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256Signature)
        };



        
        var tokenHandler = new JsonWebTokenHandler();
        var accessToken = tokenHandler.CreateToken(tokenDescriptor);


        return new LoginResponse(email, accessToken, (int)tokenExpirationStamp.Subtract(DateTime.UtcNow).TotalSeconds);
    }
}
