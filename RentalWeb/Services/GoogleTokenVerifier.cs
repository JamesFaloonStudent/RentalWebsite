using Google.Apis.Auth;

namespace RentalWebsite.Services;


// The verified facts about a Google account: its stable id (sub) and its verified email address.
public record GoogleIdentity(string Subject, string Email);


public interface IGoogleTokenVerifier
{
    // Returns null for any token that isn't a valid, unexpired Google ID token issued for this app
    // whose email Google has verified.
    Task<GoogleIdentity?> VerifyAsync(string idToken);
}


public class GoogleTokenVerifier(IConfiguration config) : IGoogleTokenVerifier
{
    public async Task<GoogleIdentity?> VerifyAsync(string idToken)
    {
        var clientId = config["GOOGLE_CLIENT_ID"]
            ?? throw new InvalidOperationException("GOOGLE_CLIENT_ID environment variable is not set.");

        try
        {
            // Checks Google's signature, issuer, expiry and that the token was issued for our client id
            var payload = await GoogleJsonWebSignature.ValidateAsync(
                idToken, new GoogleJsonWebSignature.ValidationSettings { Audience = [clientId] });

            if (!payload.EmailVerified || string.IsNullOrWhiteSpace(payload.Email))
            {
                return null;
            }
            return new GoogleIdentity(payload.Subject, payload.Email);
        }
        catch (InvalidJwtException)
        {
            return null;
        }
    }
}
