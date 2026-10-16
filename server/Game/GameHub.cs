using Hits.Api.Data;
using Microsoft.AspNetCore.SignalR;

namespace Hits.Api.Gameplay;

// Realtime channel for the online game. Clients call JoinGame(code) to subscribe to
// a game's group; the server then pushes the full state (event "state") to that group
// whenever anything changes — see GameBroadcaster. Replaces client polling (Fase 3).
// Game codes are only unique within a song library, so groups are named per library.
public class GameHub : Hub
{
    private readonly IServiceScopeFactory _scopes;
    private readonly LibraryRegistry _libraries;

    public GameHub(IServiceScopeFactory scopes, LibraryRegistry libraries)
    {
        _scopes = scopes;
        _libraries = libraries;
    }

    internal static string GroupName(Library library, string code) => $"{library.Id}:{code}";

    // The library the connection was opened in (its negotiate request carried the cookie).
    // Read from the connection, since hub calls don't run inside a request with long polling.
    private Library ConnectionLibrary => _libraries.FromRequest(Context.GetHttpContext());

    public async Task JoinGame(string code)
    {
        var library = ConnectionLibrary;
        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(library, code));
        // Send the current snapshot straight to the caller so it renders immediately.
        using var scope = _scopes.CreateLibraryScope(library);
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var state = await GameStateBuilder.BuildAsync(db, code);
        if (state is not null)
            await Clients.Caller.SendAsync("state", state);
    }

    public Task LeaveGame(string code) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(ConnectionLibrary, code));
}

// Pushes the latest state to everyone watching a game. Endpoints call this after any
// mutation (join/start/answer/reveal/next).
public class GameBroadcaster
{
    private readonly IHubContext<GameHub> _hub;
    private readonly LibraryContext _library;

    public GameBroadcaster(IHubContext<GameHub> hub, LibraryContext library)
    {
        _hub = hub;
        _library = library;
    }

    public async Task BroadcastAsync(AppDbContext db, string code)
    {
        var state = await GameStateBuilder.BuildAsync(db, code);
        if (state is not null)
            await _hub.Clients.Group(GameHub.GroupName(_library.Current, code)).SendAsync("state", state);
    }
}
