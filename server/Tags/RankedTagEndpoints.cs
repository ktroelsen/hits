using Hits.Api.Admin;
using Hits.Api.Data;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Tags;

// Tags with numbers ("top 100" → placement, "billboard uger" → weeks at #1). Reading is
// public (the placement game uses it), changes need the admin key. Giving a song a
// number also gives it the tag, and taking it off the collection removes both, so the
// tag and the numbers never disagree about which songs are in. See Models/RankedTag.cs.
public static class RankedTagEndpoints
{
    public record RankedTagRequest(string? Tag, string? Description, string? ValuePrefix, string? ValueSuffix);
    public record ValueRequest(int Value);
    public record ImportRequest(string? Text, bool DryRun);
    // Catalog editor: numbers for one song, by tag (null clears the number).
    public record SongValuesRequest(Dictionary<string, int?>? Values);

    public static void MapRankedTagEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/ranked-tags");

        // Every ranked tag with the numbers of the songs that have the tag.
        group.MapGet("/", async (AppDbContext db) =>
        {
            var tags = await db.RankedTags.AsNoTracking().OrderBy(t => t.Tag).ToListAsync();
            var values = await db.SongTagValues.AsNoTracking().ToListAsync();
            var songTags = (await db.Songs.AsNoTracking().Select(s => new { s.Id, s.Tags }).ToListAsync())
                .ToDictionary(s => s.Id, s => s.Tags);
            return Results.Ok(tags.Select(t => ToResponse(t, values
                .Where(v => v.Tag == t.Tag && songTags.TryGetValue(v.SongId, out var st) && st.Contains(t.Tag)))));
        });

        group.MapPost("/", async (RankedTagRequest body, AppDbContext db) =>
        {
            var tag = AdminEndpoints.NormalizeTags([body.Tag]).FirstOrDefault();
            if (tag is null) return Results.BadRequest(new { error = "tag er påkrævet." });
            if (await db.RankedTags.AnyAsync(t => t.Tag == tag))
                return Results.Conflict(new { error = $"Tagget '{tag}' har allerede tal." });
            var ranked = new RankedTag { Tag = tag, CreatedAt = DateTime.UtcNow };
            Apply(ranked, body);
            db.RankedTags.Add(ranked);
            // A brand-new collection starts inactive, so it can be built up before players can pick it.
            if (await TagEndpoints.IsNewTagAsync(db, tag)) await TagEndpoints.SetActiveAsync(db, tag, false);
            await db.SaveChangesAsync();
            return Results.Ok(ToResponse(ranked, []));
        }).AddEndpointFilter(AdminEndpoints.RequireAdminKey);

        group.MapPut("/{tag}", async (string tag, RankedTagRequest body, AppDbContext db) =>
        {
            var ranked = await db.RankedTags.FindAsync(tag);
            if (ranked is null) return Results.NotFound();
            Apply(ranked, body);
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        }).AddEndpointFilter(AdminEndpoints.RequireAdminKey);

        // Removes the numbers; the songs keep the tag.
        group.MapDelete("/{tag}", async (string tag, AppDbContext db) =>
        {
            var deleted = await db.RankedTags.Where(t => t.Tag == tag).ExecuteDeleteAsync();
            return deleted > 0 ? Results.NoContent() : Results.NotFound();
        }).AddEndpointFilter(AdminEndpoints.RequireAdminKey);

        // Sets a song's number (and gives it the tag).
        group.MapPut("/{tag}/values/{songId}", async (string tag, string songId, ValueRequest body, AppDbContext db) =>
        {
            if (!await db.RankedTags.AnyAsync(t => t.Tag == tag)) return Results.NotFound();
            var song = await db.Songs.FindAsync(songId);
            if (song is null) return Results.NotFound();
            await SetValueAsync(db, tag, song, body.Value);
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        }).AddEndpointFilter(AdminEndpoints.RequireAdminKey);

        // Takes a song off the collection: removes its number and the tag.
        group.MapDelete("/{tag}/values/{songId}", async (string tag, string songId, AppDbContext db) =>
        {
            var song = await db.Songs.FindAsync(songId);
            if (song is null) return Results.NotFound();
            if (await db.SongTagValues.FindAsync(tag, songId) is { } value) db.SongTagValues.Remove(value);
            song.Tags = song.Tags.Where(t => t != tag).ToList();
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).AddEndpointFilter(AdminEndpoints.RequireAdminKey);

        // Bulk import: one song per line, "number;artist;title" (tab also works). Lines are
        // matched against the catalog like candidates are (AdminEndpoints.MatchKey); matched
        // songs get the tag and the number, other songs are left alone.
        group.MapPost("/{tag}/import", async (string tag, ImportRequest body, AppDbContext db) =>
        {
            if (!await db.RankedTags.AnyAsync(t => t.Tag == tag)) return Results.NotFound();
            var catalog = await db.Songs.ToListAsync(); // tracked: matched songs get the tag

            var matched = new List<object>();
            var unmatched = new List<object>();
            var lineNo = 0;
            foreach (var raw in (body.Text ?? "").Split('\n'))
            {
                lineNo++;
                var line = raw.Trim();
                if (line == "") continue;
                var parts = line.Split(line.Contains('\t') ? '\t' : ';', 3, StringSplitOptions.TrimEntries);
                if (parts.Length < 3 || !int.TryParse(parts[0].TrimStart('#'), out var value))
                {
                    unmatched.Add(new { line = lineNo, text = line, reason = "Forventer: tal;kunstner;titel" });
                    continue;
                }
                var song = AdminEndpoints.FindInCatalogLoose(catalog, parts[1], parts[2]);
                if (song is null)
                {
                    unmatched.Add(new { line = lineNo, text = line, reason = "Ikke fundet i kataloget" });
                    continue;
                }
                matched.Add(new { line = lineNo, value, songId = song.Id, song.Artist, song.Title, song.Year });
                if (!body.DryRun) await SetValueAsync(db, tag, song, value);
            }
            if (!body.DryRun) await db.SaveChangesAsync();
            return Results.Ok(new { matched, unmatched });
        }).AddEndpointFilter(AdminEndpoints.RequireAdminKey);

        // Catalog editor: sets or clears one song's numbers. Tags themselves are saved by
        // PUT /api/songs/{id}; a number for a tag the song lacks adds the tag.
        group.MapPost("/song/{songId}", async (string songId, SongValuesRequest body, AppDbContext db) =>
        {
            var song = await db.Songs.FindAsync(songId);
            if (song is null) return Results.NotFound();
            var ranked = (await db.RankedTags.Select(t => t.Tag).ToListAsync()).ToHashSet();
            foreach (var (tag, value) in body.Values ?? new())
            {
                if (!ranked.Contains(tag)) continue;
                if (value is int v) await SetValueAsync(db, tag, song, v);
                else if (await db.SongTagValues.FindAsync(tag, songId) is { } existing) db.SongTagValues.Remove(existing);
            }
            await db.SaveChangesAsync();
            return Results.Ok(new { ok = true });
        }).AddEndpointFilter(AdminEndpoints.RequireAdminKey);
    }

    // Gives a song a number in a ranked tag (adding the tag if missing). Does nothing for
    // tags without numbers. The caller saves the changes; `song` must be tracked.
    internal static async Task SetValueAsync(AppDbContext db, string tag, Song song, int value)
    {
        if (!await db.RankedTags.AnyAsync(t => t.Tag == tag)) return;
        if (!song.Tags.Contains(tag)) song.Tags = AdminEndpoints.NormalizeTags(song.Tags.Append(tag));
        var entry = await db.SongTagValues.FindAsync(tag, song.Id);
        if (entry is null) db.SongTagValues.Add(new SongTagValue { Tag = tag, SongId = song.Id, Value = value });
        else entry.Value = value;
    }

    static void Apply(RankedTag t, RankedTagRequest body)
    {
        if (body.Description is not null) t.Description = AdminEndpoints.Blank(body.Description);
        if (body.ValuePrefix is not null) t.ValuePrefix = body.ValuePrefix;
        if (body.ValueSuffix is not null) t.ValueSuffix = body.ValueSuffix;
    }

    static object ToResponse(RankedTag t, IEnumerable<SongTagValue> values) => new
    {
        t.Tag,
        t.Description,
        t.ValuePrefix,
        t.ValueSuffix,
        values = values.OrderBy(v => v.Value).Select(v => new { v.SongId, v.Value }),
    };
}
