using Hits.Api.Admin;
using Hits.Api.Ai;
using Hits.Api.Catalog;
using Hits.Api.Data;
using Hits.Api.Tags;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Spotify;

// /admin → Spotify: paste a public playlist link, Claude finds each song's release year,
// the admin reviews the rows and imports them as a tag (a collection games can pick).
// Existing songs get the tag; new songs and a new tag start inactive, like the AI import.
public static class SpotifyEndpoints
{
    public record PreviewRequest(string? Url);
    public record ApplyRequest(string? Tag, List<SongImport.Row>? Items);

    public static void MapSpotifyEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/admin/spotify").AddEndpointFilter(AdminEndpoints.RequireAdminKey);

        // Reads the playlist and starts the year lookup; the page polls GET /job/{id}.
        group.MapPost("/preview", async (PreviewRequest body, SpotifyPlaylist spotify, AiResearch research, CancellationToken ct) =>
        {
            if (SpotifyPlaylist.ParsePlaylistId(body.Url) is not { } id)
                return Results.BadRequest(new { error = "Indsæt et link til en Spotify-playliste (open.spotify.com/playlist/…)." });
            SpotifyPlaylist.Playlist playlist;
            try { playlist = await spotify.FetchAsync(id, ct); }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
            catch (Exception ex) when (ex is InvalidOperationException or HttpRequestException or TaskCanceledException)
            {
                return Results.Json(new { error = ex.Message }, statusCode: 502);
            }
            if (playlist.Tracks.Count == 0) return Results.BadRequest(new { error = "Playlisten har ingen sange." });
            var job = research.StartYears(playlist);
            return Results.Ok(new { id = job.Id });
        });

        group.MapGet("/job/{id}", async (string id, AiResearch research, AppDbContext db) =>
        {
            if (research.Get(id) is not { Playlist: { } playlist } job) return Results.NotFound();
            var tag = AdminEndpoints.NormalizeTags([playlist.Name]).FirstOrDefault() ?? "spotify";
            object? rows = null;
            var tagExists = false;
            if (job.Status != AiResearch.JobStatus.Running)
            {
                var catalog = await db.Songs.AsNoTracking().ToListAsync();
                tagExists = catalog.Any(s => s.Tags.Contains(tag));
                var years = (job.Years ?? []).GroupBy(y => y.Index).ToDictionary(g => g.Key, g => g.First());
                rows = playlist.Tracks.Select((t, i) =>
                {
                    var y = years.GetValueOrDefault(i);
                    var match = AdminEndpoints.FindInCatalogLoose(catalog, t.Artist, t.Title);
                    return new
                    {
                        t.Title,
                        t.Artist,
                        year = y?.Year ?? 0,
                        category = y?.Category ?? "international",
                        uncertain = y is null || y.Uncertain,
                        note = y?.Note ?? "",
                        existing = match is null ? null : new { match.Id, match.Title, match.Artist, match.Year, match.Active, match.Tags },
                    };
                }).ToList();
            }
            return Results.Ok(new
            {
                job.Id,
                status = job.Status.ToString().ToLowerInvariant(),
                job.Error,
                seconds = (int)((job.FinishedAt ?? DateTime.UtcNow) - job.StartedAt).TotalSeconds,
                job.Searches,
                job.InputTokens,
                job.OutputTokens,
                aiConfigured = research.IsConfigured,
                name = playlist.Name,
                tag,
                tagExists,
                trackCount = playlist.Tracks.Count,
                truncated = playlist.Truncated,
                rows,
            });
        });

        // Imports the reviewed rows: every song gets the tag; new songs are created inactive.
        group.MapPost("/apply", async (ApplyRequest body, AppDbContext db, PreviewRefresher previews) =>
        {
            var tag = AdminEndpoints.NormalizeTags([body.Tag]).FirstOrDefault();
            if (tag is null) return Results.BadRequest(new { error = "tag er påkrævet." });
            // A brand-new collection starts inactive until the admin has listened it through.
            var newTag = await TagEndpoints.IsNewTagAsync(db, tag) && await db.RankedTags.FindAsync(tag) is null;
            if (newTag) await TagEndpoints.SetActiveAsync(db, tag, false);

            var catalog = await db.Songs.ToListAsync(); // tracked: songs get the tag
            int updated = 0, skipped = 0;
            var createdIds = new List<string>();
            foreach (var row in body.Items ?? [])
            {
                if (SongImport.FindOrCreate(db, catalog, row, out var created) is not { } song) { skipped++; continue; }
                if (created) createdIds.Add(song.Id);
                else updated++;
                song.Tags = AdminEndpoints.NormalizeTags(song.Tags.Append(tag));
            }
            await db.SaveChangesAsync();

            // Preview + cover for the new songs (iTunes), in the background.
            previews.RefreshSongsInBackground(createdIds);

            return Results.Ok(new { tag, updated, created = createdIds.Count, skipped, inactive = newTag });
        });
    }
}
