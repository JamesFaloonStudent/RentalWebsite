using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using RentalServerTests.Support;
using RentalWebsite.Services;

namespace RentalServerTests.Unit;


public sealed class GoogleSignInTests : IDisposable
{
    private readonly SignInTestContext _t = new();

    public void Dispose() => _t.Dispose();

    private static string RoleIn(string accessToken) =>
        new JsonWebTokenHandler().ReadJsonWebToken(accessToken)
            .Claims.Single(c => c.Type == System.Security.Claims.ClaimTypes.Role || c.Type == "role").Value;

    // ---- first sign-in ----

    [Fact]
    public async Task First_sign_in_creates_a_confirmed_user_linked_to_the_google_account()
    {
        _t.Google.Accept("tok", "google-sub-1", "alice@example.test");

        var response = await _t.SignIn("tok");

        Assert.NotNull(response);
        Assert.Equal("alice@example.test", response.Email);
        Assert.True(response.ExpiresIn > 0);

        await _t.Query(async (db, users) =>
        {
            var user = await db.Users.SingleAsync();
            Assert.Equal("alice@example.test", user.Email);
            Assert.True(user.EmailConfirmed);
            Assert.Null(user.PasswordHash); // there are no passwords
            var login = Assert.Single(await users.GetLoginsAsync(user));
            Assert.Equal("Google", login.LoginProvider);
            Assert.Equal("google-sub-1", login.ProviderKey);
            return 0;
        });
    }

    [Fact]
    public async Task Second_sign_in_reuses_the_same_user()
    {
        _t.Google.Accept("tok", "google-sub-1", "alice@example.test");

        var first = await _t.SignIn("tok");
        var second = await _t.SignIn("tok");

        Assert.NotNull(first);
        Assert.NotNull(second);
        await _t.Query(async (db, _) =>
        {
            Assert.Equal(1, await db.Users.CountAsync());
            Assert.Equal(1, await db.Set<IdentityUserLogin<string>>().CountAsync());
            return 0;
        });
    }

    [Fact]
    public async Task An_existing_user_with_the_same_email_is_linked_not_duplicated()
    {
        await _t.SeedUser("alice@example.test");
        _t.Google.Accept("tok", "google-sub-1", "Alice@Example.test");

        Assert.NotNull(await _t.SignIn("tok"));

        await _t.Query(async (db, users) =>
        {
            var user = await db.Users.SingleAsync();
            Assert.Single(await users.GetLoginsAsync(user));
            return 0;
        });
    }

    // ---- rejected tokens ----

    [Fact]
    public async Task An_unknown_or_forged_token_is_rejected_and_creates_nothing()
    {
        Assert.Null(await _t.SignIn("forged"));

        await _t.Query(async (db, _) =>
        {
            Assert.Equal(0, await db.Users.CountAsync());
            return 0;
        });
    }

    // ---- roles ----

    [Fact]
    public async Task Emails_in_ADMIN_EMAILS_get_the_Admin_role_and_everyone_else_gets_User()
    {
        _t.Config["ADMIN_EMAILS"] = "boss@example.test, Other@example.test";
        _t.Google.Accept("admin-tok", "sub-admin", "BOSS@example.test"); // case-insensitive
        _t.Google.Accept("user-tok", "sub-user", "customer@example.test");

        var admin = await _t.SignIn("admin-tok");
        var customer = await _t.SignIn("user-tok");

        Assert.Equal("Admin", RoleIn(admin!.AccessToken));
        Assert.Equal("User", RoleIn(customer!.AccessToken));
        await _t.Query(async (db, users) =>
        {
            var adminUser = await db.Users.SingleAsync(u => u.Email == "BOSS@example.test");
            Assert.Equal(["Admin"], await users.GetRolesAsync(adminUser));
            var customerUser = await db.Users.SingleAsync(u => u.Email == "customer@example.test");
            Assert.Equal(["User"], await users.GetRolesAsync(customerUser));
            return 0;
        });
    }

    [Fact]
    public async Task Removing_an_email_from_ADMIN_EMAILS_revokes_admin_on_the_next_sign_in()
    {
        _t.Google.Accept("tok", "sub-1", "boss@example.test");
        _t.Config["ADMIN_EMAILS"] = "boss@example.test";
        Assert.Equal("Admin", RoleIn((await _t.SignIn("tok"))!.AccessToken));

        _t.Config["ADMIN_EMAILS"] = "";
        var after = await _t.SignIn("tok");

        Assert.Equal("User", RoleIn(after!.AccessToken));
        await _t.Query(async (db, users) =>
        {
            Assert.Equal(["User"], await users.GetRolesAsync(await db.Users.SingleAsync()));
            return 0;
        });
    }

    [Fact]
    public async Task No_ADMIN_EMAILS_means_nobody_is_admin()
    {
        _t.Google.Accept("tok", "sub-1", "boss@example.test");

        Assert.Equal("User", RoleIn((await _t.SignIn("tok"))!.AccessToken));
    }
}
