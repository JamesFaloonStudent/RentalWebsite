using RentalWebsite.Database;
using RentalWebsite.Models;
using Microsoft.EntityFrameworkCore;




namespace RentalWebsite.Services;


public class RentalService
{

    private readonly RentalDbContext _dbContext;


    public RentalService(RentalDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<List<Rental>> GetAllRentals()
    {
        try
        {
            return await _dbContext.Rentals.ToListAsync();
        }
        catch (Exception ex)
        {
            // Log the exception (you can use a logging framework like Serilog, NLog, etc.)
            Console.WriteLine($"Error retrieving rentals: {ex.Message}");
            throw; // Rethrow the exception to be handled by the caller

        }
    }


    public async Task<Rental?> GetRentalById(string id)
    {
        try
        {
            return await _dbContext.Rentals.FindAsync(id);
        }
        catch (Exception ex)
        {
            // Log the exception (you can use a logging framework like Serilog, NLog, etc.)
            Console.WriteLine($"Error retrieving rental by ID: {ex.Message}");
            throw; // Rethrow the exception to be handled by the caller
        }
    }



    public async Task<Rental> CreateRental(RentalInsertRequest rental)
    {
        try
        {
            Guid newId = Guid.NewGuid();

            var newRental = new Rental
            {
                id = newId.ToString(),
                name = rental.name,
                category = rental.category,
                type = rental.type,
                description = rental.description,
                pricePerDay = rental.pricePerDay,
                location = rental.location,
                visible = rental.visible,
                capacity = rental.capacity,
                lengthFt = rental.lengthFt,
                licence = rental.licence,
                included = rental.included,
                imageUrl = rental.imageUrl
            };
            _dbContext.Rentals.Add(newRental);
            await _dbContext.SaveChangesAsync();
            return newRental;

        }
        catch (Exception ex)
        {
            // Log the exception (you can use a logging framework like Serilog, NLog, etc.)
            Console.WriteLine($"Error creating rental: {ex.Message}");
            throw; // Rethrow the exception to be handled by the caller
        }
    }

    // Returns null when the rental doesn't exist
    public async Task<Rental?> UpdateRental(string id, RentalInsertRequest changes)
    {
        var rental = await _dbContext.Rentals.FindAsync(id);
        if (rental == null)
        {
            return null;
        }

        rental.name = changes.name;
        rental.category = changes.category;
        rental.type = changes.type;
        rental.description = changes.description;
        rental.pricePerDay = changes.pricePerDay;
        rental.location = changes.location;
        rental.visible = changes.visible;
        rental.capacity = changes.capacity;
        rental.lengthFt = changes.lengthFt;
        rental.licence = changes.licence;
        rental.included = changes.included;
        if (changes.imageUrl != null)
        {
            rental.imageUrl = changes.imageUrl;
        }

        await _dbContext.SaveChangesAsync();
        return rental;
    }

    public async Task<bool> DeleteRental(string id)
    {
        try
        {
            var rental = await _dbContext.Rentals.FindAsync(id);
            if (rental == null)
            {
                return false; // Rental not found
            }

            _dbContext.Rentals.Remove(rental);
            await _dbContext.SaveChangesAsync();
            return true; // Rental deleted successfully
        }
        catch (Exception ex)
        {
            // Log the exception (you can use a logging framework like Serilog, NLog, etc.)
            Console.WriteLine($"Error deleting rental: {ex.Message}");
            throw; // Rethrow the exception to be handled by the caller
        }
    }

}