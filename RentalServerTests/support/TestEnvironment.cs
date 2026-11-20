using System.Runtime.CompilerServices;

namespace RentalServerTests.Support;


internal static class TestEnvironment
{
    // RentalDbContext reads these in static initialisers, so they must exist before it is first used.
    [ModuleInitializer]
    internal static void Init()
    {
        Environment.SetEnvironmentVariable("ADMIN_ROLE_ID", "test-admin-role");
        Environment.SetEnvironmentVariable("ADMIN_USER_ID", "test-seed-admin-user");
        // Read by AuthenticationSetup when the real JWT bearer pipeline is hosted (needs 32+ chars)
        Environment.SetEnvironmentVariable("JWT_KEY", RentalApiHost.JwtKey);
    }
}
