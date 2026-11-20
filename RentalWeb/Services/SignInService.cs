using Microsoft.AspNetCore.Identity;
using RentalWebsite.Models;

namespace RentalWebsite.Services;


// Google is the only way to sign in: there are no passwords. Identity stays the user store, with the
// Google account recorded as an external login (AspNetUserLogins) on the user.
public class SignInService(
    UserManager<User> users,
    IGoogleTokenVerifier google,
    JwtService jwt,
    IConfiguration config,
    ILogger<SignInService> logger)
{
    public const string GoogleProvider = "Google";
    public const string AdminRole = "Admin";
    public const string UserRole = "User";

    // Returns null when the Google token is invalid, so the controller can answer 401.
    public async Task<LoginResponse?> SignInWithGoogleAsync(string idToken)
    {
        var identity = await google.VerifyAsync(idToken);
        if (identity is null)
        {
            return null;
        }

        var user = await FindOrCreateUserAsync(identity);

        var role = IsAdminEmail(identity.Email) ? AdminRole : UserRole;
        await SetRoleAsync(user, role);

        return jwt.IssueToken(user, role);
    }

    private async Task<User> FindOrCreateUserAsync(GoogleIdentity identity)
    {
        var user = await users.FindByLoginAsync(GoogleProvider, identity.Subject);
        if (user is not null)
        {
            return user;
        }

        // Same person with an existing account (e.g. made by an admin): link, don't duplicate.
        // Safe because Google has verified this email address.
        user = await users.FindByEmailAsync(identity.Email);
        if (user is null)
        {
            user = new User { UserName = identity.Email, Email = identity.Email, EmailConfirmed = true };
            var created = await users.CreateAsync(user);
            if (!created.Succeeded)
            {
                // Two first sign-ins racing: the other request created the user a moment ago
                user = await users.FindByEmailAsync(identity.Email)
                    ?? throw new InvalidOperationException($"Could not create user: {Describe(created)}");
            }
        }

        var linked = await users.AddLoginAsync(user, new UserLoginInfo(GoogleProvider, identity.Subject, GoogleProvider));
        if (!linked.Succeeded)
        {
            logger.LogWarning("Could not link Google account to user {UserId}: {Errors}", user.Id, Describe(linked));
        }
        return user;
    }

    // Exactly one role per user, derived from ADMIN_EMAILS each sign-in, so removing an address
    // revokes admin the next time that person signs in.
    private async Task SetRoleAsync(User user, string role)
    {
        var current = await users.GetRolesAsync(user);

        var stale = current.Where(r => r != role).ToList();
        if (stale.Count > 0)
        {
            Ensure(await users.RemoveFromRolesAsync(user, stale));
        }
        if (!current.Contains(role))
        {
            Ensure(await users.AddToRoleAsync(user, role));
        }
    }

    private bool IsAdminEmail(string email) =>
        (config["ADMIN_EMAILS"] ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Contains(email, StringComparer.OrdinalIgnoreCase);

    private static void Ensure(IdentityResult result)
    {
        if (!result.Succeeded)
        {
            throw new InvalidOperationException($"Identity operation failed: {Describe(result)}");
        }
    }

    private static string Describe(IdentityResult result) =>
        string.Join("; ", result.Errors.Select(e => e.Description));
}
