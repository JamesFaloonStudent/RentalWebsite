using RentalServerTests.Support;
using RentalWebsite.Models;
using RentalWebsite.Services;

namespace RentalServerTests.Unit;


// GetPaymentAsync / GetBookingPaymentsAsync: reads, ownership and admin access.
public sealed class PaymentReadTests : IDisposable
{
    private readonly StripeTestContext _t = new();
    private readonly string _owner;
    private readonly string _stranger;
    private readonly string _bookingId;
    private readonly string _paymentId;

    public PaymentReadTests()
    {
        _owner = _t.SeedUser("owner");
        _stranger = _t.SeedUser("stranger");
        var rental = _t.SeedRental();
        var (booking, payment) = _t.SeedPaidBooking(rental, _owner, daysUntilStart: 20, amountCents: 20000);
        _bookingId = booking.Id;
        _paymentId = payment.Id;
    }

    public void Dispose() => _t.Dispose();

    [Fact]
    public async Task Owner_can_read_their_payment()
    {
        var result = await _t.Service.GetPaymentAsync(_owner, false, _paymentId);

        Assert.Equal(_paymentId, result.Id);
        Assert.Equal(_bookingId, result.BookingId);
        Assert.Equal("Succeeded", result.Status);
        Assert.Equal(20000, result.AmountCents);
        Assert.Equal(0, result.AmountRefundedCents);
        Assert.Equal("cad", result.Currency);
    }

    [Fact]
    public async Task Another_user_gets_not_found_not_forbidden()
    {
        var ex = await Assert.ThrowsAsync<PaymentException>(() => _t.Service.GetPaymentAsync(_stranger, false, _paymentId));
        Assert.Equal(PaymentErrorKind.NotFound, ex.Kind);
    }

    [Fact]
    public async Task Admin_can_read_anyones_payment()
    {
        var result = await _t.Service.GetPaymentAsync("someone-else", true, _paymentId);
        Assert.Equal(_paymentId, result.Id);
    }

    [Fact]
    public async Task Unknown_payment_is_not_found()
    {
        var ex = await Assert.ThrowsAsync<PaymentException>(() => _t.Service.GetPaymentAsync(_owner, true, "missing"));
        Assert.Equal(PaymentErrorKind.NotFound, ex.Kind);
    }

    [Fact]
    public async Task Booking_payments_are_listed_oldest_first()
    {
        using (var db = _t.NewDb())
        {
            db.Payments.Add(new Payment
            {
                BookingId = _bookingId,
                StripeCheckoutSessionId = "cs_older_retry",
                AmountCents = 20000,
                Status = PaymentStatus.Canceled,
                CreatedAt = DateTime.UtcNow.AddDays(-2)
            });
            db.SaveChanges();
        }

        var result = await _t.Service.GetBookingPaymentsAsync(_owner, false, _bookingId);

        Assert.Equal(2, result.Count);
        Assert.Equal("Canceled", result[0].Status);
        Assert.Equal("Succeeded", result[1].Status);
    }

    [Fact]
    public async Task Booking_payments_are_hidden_from_other_users_but_not_admins()
    {
        var ex = await Assert.ThrowsAsync<PaymentException>(() => _t.Service.GetBookingPaymentsAsync(_stranger, false, _bookingId));
        Assert.Equal(PaymentErrorKind.NotFound, ex.Kind);

        Assert.Single(await _t.Service.GetBookingPaymentsAsync(_stranger, true, _bookingId));
    }

    [Fact]
    public async Task Unknown_booking_is_not_found()
    {
        var ex = await Assert.ThrowsAsync<PaymentException>(() => _t.Service.GetBookingPaymentsAsync(_owner, true, "missing"));
        Assert.Equal(PaymentErrorKind.NotFound, ex.Kind);
    }
}
