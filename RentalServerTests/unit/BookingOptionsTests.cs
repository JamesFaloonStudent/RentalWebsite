using System.ComponentModel.DataAnnotations;
using RentalWebsite.Models;

namespace RentalServerTests.Unit;


// BookingOptions is validated at startup (ValidateOnStart), so bad config stops the app instead of mis-pricing fees.
public class BookingOptionsTests
{
    private static bool IsValid(BookingOptions options) =>
        Validator.TryValidateObject(options, new ValidationContext(options), [], validateAllProperties: true);

    [Fact]
    public void Defaults_match_the_documented_policy()
    {
        var options = new BookingOptions();

        Assert.Equal(31, options.CheckoutHoldMinutes);
        Assert.Equal(7, options.CancellationWindowDays);
        Assert.Equal(25m, options.LateCancellationFeePercent);
        Assert.True(IsValid(options));
    }

    [Fact]
    public void Section_name_matches_appsettings()
    {
        Assert.Equal("Booking", BookingOptions.SectionName);
    }

    [Theory]
    [InlineData(30)]   // Stripe requires sessions to last at least 30 minutes
    [InlineData(1441)] // more than a day
    public void Rejects_hold_times_stripe_cannot_honour(int minutes)
    {
        Assert.False(IsValid(new BookingOptions { CheckoutHoldMinutes = minutes }));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(366)]
    public void Rejects_out_of_range_window(int days)
    {
        Assert.False(IsValid(new BookingOptions { CancellationWindowDays = days }));
    }

    [Theory]
    [InlineData(-0.1)]
    [InlineData(100.1)]
    public void Rejects_fee_percentages_outside_0_to_100(double percent)
    {
        Assert.False(IsValid(new BookingOptions { LateCancellationFeePercent = (decimal)percent }));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(100)]
    public void Accepts_the_boundary_percentages(double percent)
    {
        Assert.True(IsValid(new BookingOptions { LateCancellationFeePercent = (decimal)percent }));
    }
}
