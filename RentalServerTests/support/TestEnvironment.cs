using System.Runtime.CompilerServices;

namespace RentalServerTests.Support;


internal static class TestEnvironment
{
    // RentalDbContext reads this in a static initialiser, so it must exist before it is first used.
    [ModuleInitializer]
    internal static void Init()
    {
        Environment.SetEnvironmentVariable("ADMIN_ROLE_ID", "test-admin-role");
        // Read by AuthenticationSetup when the real JWT bearer pipeline is hosted (needs 32+ chars)
        Environment.SetEnvironmentVariable("JWT_KEY", RentalApiHost.JwtKey);
    }
}
