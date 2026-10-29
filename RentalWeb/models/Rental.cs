
namespace RentalWebsite.Models;



public class Rental
{
    public String id { get; set; } = Guid.NewGuid().ToString();

    public String? imageUrl { get; set; } = "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80";
    public String? category { get; set; }
    public String? name { get; set; }
    public String? type { get; set; }
    public String? description { get; set; }
    public float pricePerDay { get; set; } = 100000.00f;
    public String? location { get; set; }
    public bool? visible { get; set; }
    public int? capacity { get; set; }
    public int? lengthFt { get; set; }
    public String? licence { get; set; }
    public List<String>? included { get; set; }

}

public record RentalInsertRequest(
    String? imageUrl,
    String? category,
    String? name,
    String? type,
    String? description,
    float pricePerDay,
    String? location,
    bool visible,
    int capacity,
    int lengthFt,
    String? licence,
    List<String>? included
);



