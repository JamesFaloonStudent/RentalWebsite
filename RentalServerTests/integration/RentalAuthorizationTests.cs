using System.Net;
using System.Net.Http.Json;
using RentalServerTests.Support;
using RentalWebsite.Models;

namespace RentalServerTests.Integration;


// Admin-only rental management over real HTTP: POST and DELETE need an Admin token, GET stays public.
public sealed class RentalAuthorizationTests : IAsyncLifetime
{
    private RentalApiHost _host = null!;

    public async Task InitializeAsync() => _host = await RentalApiHost.StartAsync();

    public async Task DisposeAsync() => await _host.DisposeAsync();

    private static RentalInsertRequest NewRental() =>
        new(null, "boats", "Test Boat", "Pontoon", "A boat", 100f, "Harbor", true, 6, 20, null, null);

    private Task<HttpResponseMessage> Send(HttpMethod method, string url, string? token, object? body = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (token != null)
        {
            request.Headers.Authorization = RentalApiHost.Bearer(token);
        }
        if (body != null)
        {
            request.Content = JsonContent.Create(body);
        }
        return _host.Client.SendAsync(request);
    }

    private static string AdminToken => RentalApiHost.TokenFor("admin-1", "Admin");
    private static string UserToken => RentalApiHost.TokenFor("user-1", "User");

    // ---- POST ----

    [Fact]
    public async Task Post_without_a_token_returns_401()
    {
        var response = await Send(HttpMethod.Post, "/api/rental", null, NewRental());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Post_with_a_garbage_token_returns_401()
    {
        var response = await Send(HttpMethod.Post, "/api/rental", "not-a-jwt", NewRental());

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Post_as_a_non_admin_returns_403()
    {
        var response = await Send(HttpMethod.Post, "/api/rental", UserToken, NewRental());

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Post_as_an_admin_creates_the_rental()
    {
        var response = await Send(HttpMethod.Post, "/api/rental", AdminToken, NewRental());

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<Rental>();
        Assert.NotNull(created);
        Assert.True(_host.RentalExists(created.id));
    }

    // ---- DELETE ----

    [Fact]
    public async Task Delete_without_a_token_returns_401_and_keeps_the_rental()
    {
        _host.SeedRental("boat-1");

        var response = await Send(HttpMethod.Delete, "/api/rental/boat-1", null);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.True(_host.RentalExists("boat-1"));
    }

    [Fact]
    public async Task Delete_as_a_non_admin_returns_403_and_keeps_the_rental()
    {
        _host.SeedRental("boat-1");

        var response = await Send(HttpMethod.Delete, "/api/rental/boat-1", UserToken);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.True(_host.RentalExists("boat-1"));
    }

    [Fact]
    public async Task Delete_as_an_admin_returns_200_and_removes_the_rental()
    {
        _host.SeedRental("boat-1");

        var response = await Send(HttpMethod.Delete, "/api/rental/boat-1", AdminToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(_host.RentalExists("boat-1"));
    }

    [Fact]
    public async Task Delete_of_a_missing_rental_as_an_admin_returns_404()
    {
        var response = await Send(HttpMethod.Delete, "/api/rental/nope", AdminToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    // ---- GET stays public ----

    [Fact]
    public async Task Get_endpoints_work_without_a_token()
    {
        _host.SeedRental("boat-1");

        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, "/api/rental", null)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await Send(HttpMethod.Get, "/api/rental/boat-1", null)).StatusCode);
    }
}
