using Hits.Api.Data;
using Microsoft.AspNetCore.SignalR;

namespace Hits.Api.Gameplay;

// Realtime channel for the online game. Clients call JoinGame(code) to subscribe to
// a game's group; the server then pushes the full state (event "state") to that group
// whenever anything changes — see GameBroadcaster. Replaces client polling (Fase 3).
public class GameHub : Hub
{
    private readonly AppDbContext _db;

    public GameHub(AppDbContext db) => _db = db;

    public async Task JoinGame(string code)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, code);
        // Send the current snapshot straight to the caller so it renders immediately.
        var state = await GameStateBuilder.BuildAsync(_db, code);
        if (state is not null)
            await Clients.Caller.SendAsync("state", state);
    }

    public Task LeaveGame(string code) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, code);
}

// Pushes the latest state to everyone watching a game. Endpoints call this after any
// mutation (join/start/answer/reveal/next).
public class GameBroadcaster
{
    private readonly IHubContext<GameHub> _hub;

    public GameBroadcaster(IHubContext<GameHub> hub) => _hub = hub;

    public async Task BroadcastAsync(AppDbContext db, string code)
    {
        var state = await GameStateBuilder.BuildAsync(db, code);
        if (state is not null)
            await _hub.Clients.Group(code).SendAsync("state", state);
    }
}
