using Hits.Api.Admin;
using Hits.Api.Data;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Tags;

// Every tag in the catalog with its settings (active/inactive, has numbers). Reading is
// public (games hide inactive tags); changing needs the admin key. See Models/TagSetting.cs.
public static class TagEndpoints
{
    public record TagUpdateRequest(bool Active);

    public static void MapTagEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/tags");

        group.MapGet("/", async (AppDbContext db) =>
        {
            var songs = await db.Songs.AsNoTracking().Select(s => new { s.Active, s.Tags }).ToListAsync();
            var inactive = await InactiveTagsAsync(db);
            var ranked = (await db.RankedTags.Select(t => t.Tag).ToListAsync()).ToHashSet();
            // Tags with numbers but no songs yet (just created) are listed too.
            var names = songs.SelectMany(s => s.Tags).Concat(ranked).Distinct().Order(StringComparer.Ordinal);
            return Results.Ok(names.Select(tag => new
            {
                tag,
                active = !inactive.Contains(tag),
                hasNumbers = ranked.Contains(tag),
                songs = songs.Count(s => s.Tags.Contains(tag)),
                activeSongs = songs.Count(s => s.Active && s.Tags.Contains(tag)),
            }));
        });

        group.MapPut("/{tag}", async (string tag, TagUpdateRequest body, AppDbContext db) =>
        {
            var name = AdminEndpoints.NormalizeTags([tag]).FirstOrDefault();
            if (name is null) return Results.BadRequest(new { error = "tag mangler." });
            await SetActiveAsync(db, name, body.Active);
            await db.SaveChangesAsync();
            return Results.Ok(new { tag = name, active = body.Active });
        }).AddEndpointFilter(AdminEndpoints.RequireAdminKey);
    }

    public static async Task<HashSet<string>> InactiveTagsAsync(AppDbContext db) =>
        (await db.TagSettings.Where(t => !t.Active).Select(t => t.Tag).ToListAsync()).ToHashSet();

    // The caller saves the changes.
    internal static async Task SetActiveAsync(AppDbContext db, string tag, bool active)
    {
        var setting = await db.TagSettings.FindAsync(tag);
        if (setting is null) db.TagSettings.Add(setting = new TagSetting { Tag = tag });
        setting.Active = active;
        setting.UpdatedAt = DateTime.UtcNow;
    }

    // True when no song has the tag yet — a new collection, which starts inactive so it
    // can be built up before players can pick it.
    internal static async Task<bool> IsNewTagAsync(AppDbContext db, string tag) =>
        !(await db.Songs.AsNoTracking().Select(s => s.Tags).ToListAsync()).Any(t => t.Contains(tag));
}
