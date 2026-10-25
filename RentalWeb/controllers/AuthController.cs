using Microsoft.AspNetCore.Mvc;
using RentalWebsite.Models;
using RentalWebsite.Services; 
using Microsoft.AspNetCore.Authorization;


namespace RentalWebsite.Controllers;


[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly JwtService _jwtService;

    public AuthController(JwtService jwtService) => _jwtService = jwtService;


    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var response = await _jwtService.Authenticate(request);
        if (response is null)
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        return Ok(response);
       
    }
}