using System.Text.Json;
using Hits.Api.Data;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Gameplay;

// Per-browser song order so consecutive games don't repeat songs. The hits_session
// cookie points at a PlaySession row holding a shuffled order of the whole catalog and
// the ids played so far. Games draw unplayed songs in that order; songs skipped (e.g.
// a year already on the timeline) stay unplayed and come up again in the next pass.
// When every song has been played, the order is reshuffled. Idle sessions are deleted
// by PlaySessionCleanupService.
public static class PlaySessionStore
{
    public const string CookieName = "hits_session";
    public static readonly TimeSpan IdleLifetime = TimeSpan.FromHours(2);

    public static void MapPlaySessionEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/session");

        group.MapGet("/order", async (HttpContext http, AppDbContext db) =>
        {
            var session = await GetOrCreateAsync(http, db);
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(session));
        });

        group.MapPost("/played", async (MarkPlayedRequest req, HttpContext http, AppDbContext db) =>
        {
            var session = await GetOrCreateAsync(http, db);
            MarkPlayed(session, req.SongIds ?? new());
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(session));
        });
    }

    // Loads the caller's session (creating it and setting the cookie if missing or
    // expired), synced with the current catalog. The caller saves the changes.
    public static async Task<PlaySession> GetOrCreateAsync(HttpContext http, AppDbContext db)
    {
        var now = DateTime.UtcNow;
        var catalogIds = await db.Songs.Select(s => s.Id).ToListAsync();

        PlaySession? session = null;
        if (http.Request.Cookies.TryGetValue(CookieName, out var id) && !string.IsNullOrEmpty(id))
        {
            session = await db.PlaySessions.FindAsync(id);
            if (session is not null && session.LastSeenAt < now - IdleLifetime)
            {
                db.PlaySessions.Remove(session); // not yet cleaned up — start over
                session = null;
            }
        }

        if (session is null)
        {
            Shuffle(catalogIds);
            session = new PlaySession
            {
                Id = Guid.NewGuid().ToString("n"),
                OrderJson = JsonSerializer.Serialize(catalogIds),
                PlayedJson = "[]",
                CreatedAt = now,
            };
            db.PlaySessions.Add(session);
            http.Response.Cookies.Append(CookieName, session.Id, new CookieOptions
            {
                HttpOnly = true,
                SameSite = SameSiteMode.Lax,
                Secure = http.Request.IsHttps,
                IsEssential = true,
            });
        }
        else
        {
            SyncWithCatalog(session, catalogIds);
        }

        session.LastSeenAt = now;
        return session;
    }

    // Marks songs as played. Once every song in the order is played, reshuffles.
    public static void MarkPlayed(PlaySession session, IEnumerable<string> songIds)
    {
        var order = Read(session.OrderJson);
        var played = Read(session.PlayedJson).ToHashSet();
        var inOrder = order.ToHashSet();
        played.UnionWith(songIds.Where(inOrder.Contains));

        if (played.Count >= order.Count)
        {
            Shuffle(order);
            session.OrderJson = JsonSerializer.Serialize(order);
            played.Clear();
        }
        session.PlayedJson = JsonSerializer.Serialize(played);
        session.LastSeenAt = DateTime.UtcNow;
    }

    // Song ids to draw from: unplayed in session order, then played ones (so a deck
    // never runs dry just because the pass is nearly done).
    public static List<string> DeckOrder(PlaySession session)
    {
        var played = Read(session.PlayedJson).ToHashSet();
        return Read(session.OrderJson).OrderBy(played.Contains).ToList(); // stable sort
    }

    internal static void Shuffle<T>(IList<T> list)
    {
        var rng = Random.Shared;
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = rng.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
    }

    // Drops deleted songs and appends newly added ones (shuffled) at the end.
    private static void SyncWithCatalog(PlaySession session, List<string> catalogIds)
    {
        var catalog = catalogIds.ToHashSet();
        var order = Read(session.OrderJson);
        var known = order.ToHashSet();
        var added = catalogIds.Where(id => !known.Contains(id)).ToList();
        if (added.Count == 0 && order.All(catalog.Contains)) return;

        Shuffle(added);
        order = order.Where(catalog.Contains).Concat(added).ToList();
        session.OrderJson = JsonSerializer.Serialize(order);
        session.PlayedJson = JsonSerializer.Serialize(Read(session.PlayedJson).Where(catalog.Contains));
    }

    private static List<string> Read(string json) =>
        JsonSerializer.Deserialize<List<string>>(json) ?? new();

    private static object ToResponse(PlaySession session) =>
        new { order = Read(session.OrderJson), played = Read(session.PlayedJson) };

    public record MarkPlayedRequest(List<string>? SongIds);
}
