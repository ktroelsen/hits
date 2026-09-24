using System.Text.Json;
using Hits.Api.Data;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Admin;

// Bulk export/import of the song catalog as JSON, so songs can be enriched outside the
// app (fun facts, tags …) and written back. Used by scripts/songs.ps1 and /admin → Katalog.
// Both endpoints sit behind the admin key (mapped in AdminEndpoints).
public static class SongTransfer
{
    // Fields a caller may set on import. `decade` is always derived from `year`.
    static readonly string[] StringFields = ["genre", "funFact", "previewUrl", "artworkUrl", "customPreviewUrl"];

    // GET /api/admin/songs/export — every filter is optional and they combine. Songs are
    // ordered by Id (ordinal) so `after` is a stable cursor for walking the catalog in
    // batches; `missing=tags` is the stateless alternative (enriched songs drop out).
    public static async Task<IResult> ExportAsync(
        AppDbContext db,
        string? ids, string? missing, string? tag, string? category, string? decade,
        bool? active, bool? hasTags, int? limit, string? after)
    {
        IEnumerable<Song> songs = await db.Songs.AsNoTracking().ToListAsync();

        if (!string.IsNullOrWhiteSpace(ids))
        {
            var set = ids.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet();
            songs = songs.Where(s => set.Contains(s.Id));
        }
        if (!string.IsNullOrWhiteSpace(missing))
        {
            Func<Song, bool>? isMissing = missing.Trim().ToLowerInvariant() switch
            {
                "tags" => s => s.Tags.Count == 0,
                "funfact" => s => string.IsNullOrWhiteSpace(s.FunFact),
                "genre" => s => string.IsNullOrWhiteSpace(s.Genre),
                _ => null,
            };
            if (isMissing is null)
                return Results.BadRequest(new { error = "missing skal være tags, funFact eller genre." });
            songs = songs.Where(isMissing);
        }
        if (!string.IsNullOrWhiteSpace(tag))
        {
            var t = AdminEndpoints.Norm(tag);
            songs = songs.Where(s => s.Tags.Contains(t));
        }
        if (hasTags is bool ht) songs = songs.Where(s => (s.Tags.Count > 0) == ht);
        if (!string.IsNullOrWhiteSpace(category)) songs = songs.Where(s => s.Category == category);
        if (!string.IsNullOrWhiteSpace(decade)) songs = songs.Where(s => s.Decade == decade);
        if (active is bool a) songs = songs.Where(s => s.Active == a);

        var matching = songs.OrderBy(s => s.Id, StringComparer.Ordinal).ToList();
        var page = string.IsNullOrEmpty(after)
            ? matching
            : matching.Where(s => string.CompareOrdinal(s.Id, after) > 0).ToList();
        var remaining = page.Count;
        if (limit is > 0) page = page.Take(limit.Value).ToList();

        return Results.Json(new
        {
            exportedAt = DateTime.UtcNow,
            total = matching.Count,
            count = page.Count,
            nextAfter = remaining > page.Count ? page[^1].Id : null,
            songs = page.Select(s => new
            {
                s.Id, s.Title, s.Artist, s.Year, s.Category, s.Genre, s.FunFact, s.Tags,
                s.Active, s.PreviewUrl, s.ArtworkUrl, s.CustomPreviewUrl,
            }),
        }, ExportJson);
    }

    // Indented with æøå unescaped: the export is meant to be read and edited by people (and Claude).
    static readonly JsonSerializerOptions ExportJson = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public record ImportError(int Index, string Message);
    public record ImportChange(string Id, string Title, string Artist, bool Created, List<string> Fields);

    // POST /api/admin/songs/import?dryRun=true — body is `{ "songs": [...] }` (an export
    // file) or a bare array. Only the fields present on an entry are changed, so a file
    // holding just `id` + `tags` is enough. Entries match on id, then artist+title; no
    // match creates a new song. Songs absent from the file are never touched. Nothing is
    // saved if any entry is invalid, and everything else is saved in one transaction.
    // tagMode=add makes `tags` additive (existing tags are kept); `addTags`/`removeTags`
    // on an entry work in either mode.
    public static async Task<IResult> ImportAsync(HttpRequest request, AppDbContext db, bool? dryRun, string? tagMode)
    {
        if (tagMode is not (null or "" or "replace" or "add"))
            return Results.BadRequest(new { error = "tagMode skal være replace eller add." });
        var addOnly = tagMode == "add";
        JsonDocument doc;
        try { doc = await JsonDocument.ParseAsync(request.Body); }
        catch (JsonException e) { return Results.BadRequest(new { error = $"Ugyldig JSON: {e.Message}" }); }

        using (doc)
        {
            var root = doc.RootElement;
            if (root.ValueKind == JsonValueKind.Object && TryGet(root, "songs", out var inner)) root = inner;
            if (root.ValueKind != JsonValueKind.Array)
                return Results.BadRequest(new { error = "Forventede et array af sange eller { \"songs\": [...] }." });

            var catalog = await db.Songs.ToListAsync(); // tracked, so edits below are saved
            var byId = catalog.ToDictionary(s => s.Id);
            var errors = new List<ImportError>();
            var changes = new List<ImportChange>();
            var unchanged = 0;

            var index = -1;
            foreach (var item in root.EnumerateArray())
            {
                index++;
                if (item.ValueKind != JsonValueKind.Object)
                {
                    errors.Add(new(index, "Posten er ikke et objekt."));
                    continue;
                }

                var id = TryGet(item, "id", out var idEl) && idEl.ValueKind == JsonValueKind.String ? idEl.GetString() : null;
                var song = id is not null && byId.TryGetValue(id, out var byIdMatch) ? byIdMatch : null;
                if (song is null
                    && TryGetString(item, "artist", out var mArtist) && TryGetString(item, "title", out var mTitle)
                    && mArtist is not null && mTitle is not null)
                {
                    var (na, nt) = (AdminEndpoints.Norm(mArtist), AdminEndpoints.Norm(mTitle));
                    song = catalog.FirstOrDefault(s => AdminEndpoints.Norm(s.Artist) == na && AdminEndpoints.Norm(s.Title) == nt);
                }

                var created = song is null;
                // Edit a copy so an invalid entry never leaves a half-applied song behind.
                var draft = song is null
                    ? new Song { Id = Guid.NewGuid().ToString("n"), Title = "", Artist = "", Category = "international" }
                    : Copy(song);
                var fields = new List<string>();
                var error = Apply(item, draft, fields, addOnly);
                if (error is null && created && (draft.Title == "" || draft.Artist == "" || draft.Year == 0))
                    error = id is null ? "Ny sang kræver title, artist og year." : $"Ukendt id '{id}' — en ny sang kræver title, artist og year.";
                if (error is not null)
                {
                    errors.Add(new(index, error));
                    continue;
                }

                if (created)
                {
                    draft.Decade = AdminEndpoints.DecadeForYear(draft.Year);
                    db.Songs.Add(draft);
                    catalog.Add(draft); // later entries in the same file dedupe against it
                    byId[draft.Id] = draft;
                }
                else if (fields.Count > 0)
                {
                    db.Entry(song!).CurrentValues.SetValues(draft);
                    song!.Tags = draft.Tags;
                }
                if (fields.Count == 0) unchanged++;
                else changes.Add(new(draft.Id, draft.Title, draft.Artist, created, fields));
            }

            var save = dryRun != true && errors.Count == 0;
            if (save) await db.SaveChangesAsync();
            var report = new ImportReport(
                dryRun == true, save,
                changes.Count(c => c.Created), changes.Count(c => !c.Created), unchanged,
                errors, changes);
            return dryRun != true && errors.Count > 0 ? Results.BadRequest(report) : Results.Ok(report);
        }
    }

    public record ImportReport(
        bool DryRun, bool Saved, int Created, int Updated, int Unchanged,
        List<ImportError> Errors, List<ImportChange> Changes);

    static Song Copy(Song s) => new()
    {
        Id = s.Id, Title = s.Title, Artist = s.Artist, Year = s.Year, Category = s.Category,
        Decade = s.Decade, Genre = s.Genre, FunFact = s.FunFact, CustomPreviewUrl = s.CustomPreviewUrl,
        PreviewUrl = s.PreviewUrl, ArtworkUrl = s.ArtworkUrl, Active = s.Active, Tags = [.. s.Tags],
    };

    // Applies every known field present on `item` to `song`, recording the names of the
    // fields whose value actually changed. Returns an error message for invalid values.
    static string? Apply(JsonElement item, Song song, List<string> changed, bool addOnly)
    {
        foreach (var name in new[] { "title", "artist" })
        {
            if (!TryGetString(item, name, out var value)) { if (Has(item, name)) return $"{name} skal være tekst."; continue; }
            var v = AdminEndpoints.Blank(value);
            if (v is null) return $"{name} må ikke være tom.";
            var current = name == "title" ? song.Title : song.Artist;
            if (current == v) continue;
            if (name == "title") song.Title = v; else song.Artist = v;
            changed.Add(name);
        }

        if (TryGet(item, "year", out var yearEl))
        {
            if (yearEl.ValueKind != JsonValueKind.Number || !yearEl.TryGetInt32(out var year) || year < 1900 || year > 2100)
                return "year skal være et årstal.";
            if (song.Year != year)
            {
                song.Year = year;
                song.Decade = AdminEndpoints.DecadeForYear(year);
                changed.Add("year");
            }
        }

        if (TryGet(item, "category", out var catEl))
        {
            var cat = catEl.ValueKind == JsonValueKind.String ? catEl.GetString() : null;
            if (cat is not ("danish" or "international")) return "category skal være danish eller international.";
            if (song.Category != cat) { song.Category = cat; changed.Add("category"); }
        }

        foreach (var name in StringFields)
        {
            if (!TryGet(item, name, out var el)) continue;
            if (el.ValueKind is not (JsonValueKind.String or JsonValueKind.Null)) return $"{name} skal være tekst eller null.";
            var v = AdminEndpoints.Blank(el.GetString());
            var prop = typeof(Song).GetProperty(char.ToUpperInvariant(name[0]) + name[1..])!;
            if ((string?)prop.GetValue(song) == v) continue;
            prop.SetValue(song, v);
            changed.Add(name);
        }

        // `tags` replaces the list (or adds to it with tagMode=add); `addTags` / `removeTags`
        // always add / remove, so a file can tweak tags without knowing the existing ones.
        var newTags = song.Tags;
        foreach (var (name, mode) in new[] { ("tags", addOnly ? 'a' : 'r'), ("addTags", 'a'), ("removeTags", 'd') })
        {
            if (!TryGet(item, name, out var el)) continue;
            if (el.ValueKind is not (JsonValueKind.Array or JsonValueKind.Null)
                || (el.ValueKind == JsonValueKind.Array && el.EnumerateArray().Any(t => t.ValueKind != JsonValueKind.String)))
                return $"{name} skal være et array af tekster.";
            var given = AdminEndpoints.NormalizeTags(
                el.ValueKind == JsonValueKind.Array ? el.EnumerateArray().Select(t => t.GetString()) : []);
            newTags = mode switch
            {
                'r' => given,
                'a' => AdminEndpoints.NormalizeTags(newTags.Concat(given)),
                _ => newTags.Except(given).ToList(),
            };
        }
        if (!newTags.SequenceEqual(song.Tags)) { song.Tags = newTags; changed.Add("tags"); }

        if (TryGet(item, "active", out var activeEl))
        {
            if (activeEl.ValueKind is not (JsonValueKind.True or JsonValueKind.False)) return "active skal være true eller false.";
            var a = activeEl.GetBoolean();
            if (song.Active != a) { song.Active = a; changed.Add("active"); }
        }

        return null;
    }

    // Case-insensitive property lookup, matching how the rest of the API reads JSON.
    static bool TryGet(JsonElement obj, string name, out JsonElement value)
    {
        foreach (var p in obj.EnumerateObject())
            if (string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase)) { value = p.Value; return true; }
        value = default;
        return false;
    }

    static bool Has(JsonElement obj, string name) => TryGet(obj, name, out _);

    static bool TryGetString(JsonElement obj, string name, out string? value)
    {
        value = TryGet(obj, name, out var el) && el.ValueKind == JsonValueKind.String ? el.GetString() : null;
        return value is not null;
    }
}
