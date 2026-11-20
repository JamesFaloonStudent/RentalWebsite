using RentalWebsite.Services;

namespace RentalServerTests.Support;


// Stands in for Google: only tokens registered with Accept() are valid, everything else is rejected
// like a forged or expired ID token.
public sealed class FakeGoogleTokenVerifier : IGoogleTokenVerifier
{
    private readonly Dictionary<string, GoogleIdentity> _accepted = [];

    public void Accept(string idToken, string subject, string email) =>
        _accepted[idToken] = new GoogleIdentity(subject, email);

    public Task<GoogleIdentity?> VerifyAsync(string idToken) =>
        Task.FromResult(_accepted.TryGetValue(idToken, out var identity) ? identity : null);
}
