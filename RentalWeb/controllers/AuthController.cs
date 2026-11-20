using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RentalWebsite.Models;
using RentalWebsite.Services;


namespace RentalWebsite.Controllers;


[ApiController]
[Route("api/[controller]")]
public class AuthController(SignInService signIn, ILogger<AuthController> logger) : ControllerBase
{
    // Exchanges a Google ID token for this app's access token. Creates the user on first sign-in.
    [AllowAnonymous]
    [HttpPost("google")]
    public async Task<ActionResult<LoginResponse>> SignInWithGoogle(GoogleSignInRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.IdToken))
        {
            return Unauthorized(new { message = "Google sign-in failed. Try again." });
        }

        try
        {
            var response = await signIn.SignInWithGoogleAsync(request.IdToken);
            if (response is null)
            {
                return Unauthorized(new { message = "Google sign-in failed. Try again." });
            }
            return Ok(response);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogError(ex, "Unhandled error during Google sign-in");
            return StatusCode(StatusCodes.Status500InternalServerError, new { message = "An unexpected error occurred." });
        }
    }
}
