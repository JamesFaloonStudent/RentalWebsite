using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RentalWebsite.Services;
using RentalWebsite.Models;




namespace RentalWebsite.Controllers;


[ApiController]
[Route("api/[controller]")]
public class RentalController : ControllerBase
{

    private readonly RentalService _rentalService;


    public RentalController(RentalService rentalService)
    {
        _rentalService = rentalService;
    }


    [HttpGet]
    public async Task<ActionResult<List<Rental>>> GetAllRentals()
    {
        try
        {
            var rentals = await _rentalService.GetAllRentals();
            return Ok(rentals);
        }
        catch (Exception ex)
        {
            // Log the exception (you can use a logging framework like Serilog, NLog, etc.)
            Console.WriteLine($"Error retrieving rentals: {ex.Message}");
            return StatusCode(500, "An error occurred while retrieving rentals.");
        }
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Rental>> GetRentalById(string id)
    {
        try
        {
            var rental = await _rentalService.GetRentalById(id);
            if (rental == null)
            {
                return NotFound();
            }
            return Ok(rental);
        }
        catch (Exception ex)
        {
            // Log the exception (you can use a logging framework like Serilog, NLog, etc.)
            Console.WriteLine($"Error retrieving rental by ID: {ex.Message}");
            return StatusCode(500, "An error occurred while retrieving the rental.");
        }
    }


    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<Rental>> CreateRental(RentalInsertRequest rental)
    {
        try
        {
            var createdRental = await _rentalService.CreateRental(rental);
            return CreatedAtAction(nameof(GetRentalById), new { id = createdRental.id }, createdRental);
        }
        catch (Exception ex)
        {
            // Log the exception (you can use a logging framework like Serilog, NLog, etc.)
            Console.WriteLine($"Error creating rental: {ex.Message}");
            return StatusCode(500, "An error occurred while creating the rental.");
        }
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<Rental>> UpdateRental(string id, RentalInsertRequest rental)
    {
        try
        {
            var updated = await _rentalService.UpdateRental(id, rental);
            if (updated == null)
            {
                return NotFound();
            }
            return Ok(updated);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error updating rental: {ex.Message}");
            return StatusCode(500, "An error occurred while updating the rental.");
        }
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<bool>> DeleteRental(string id)
    {
        try
        {
            var result = await _rentalService.DeleteRental(id);
            if (!result)
            {
                return NotFound();
            }
            return Ok(result);
        }
        catch (DbUpdateException)
        {
            // Bookings still reference this rental (foreign key is Restrict)
            return Conflict("This rental has bookings and can't be deleted. Hide it instead.");
        }
        catch (Exception ex)
        {
            // Log the exception (you can use a logging framework like Serilog, NLog, etc.)
            Console.WriteLine($"Error deleting rental: {ex.Message}");
            return StatusCode(500, "An error occurred while deleting the rental.");
        }
    }


}
