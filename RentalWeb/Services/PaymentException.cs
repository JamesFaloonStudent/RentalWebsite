namespace RentalWebsite.Services;


public enum PaymentErrorKind
{
    Validation,
    NotFound,
    Conflict,
    Upstream
}


// Expected, client-safe failures. The message is returned to the caller, so it must
// never contain Stripe error details, ids of other users' data, or secrets.
public class PaymentException(PaymentErrorKind kind, string message) : Exception(message)
{
    public PaymentErrorKind Kind { get; } = kind;
}
