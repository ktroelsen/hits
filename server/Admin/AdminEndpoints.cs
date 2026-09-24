using System.Text.Json;
using Hits.Api.Catalog;
using Hits.Api.Data;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Admin;

// Server-side /admin curation API. Replaces the old Vite dev-only plugin so /admin works
// on the deployed site too. Protected by an admin key (config "Admin:Key", env Admin__Key)
// sent as the X-Admin-Key header. Without a configured key, admin is open in Development
// and disabled everywhere else.
public static class AdminEndpoints
{
    public const string KeyHeader = "X-Admin-Key";

    record Candidate(string Id, string Title, string Artist, int Year, string Category, string? Note);

    public record ApproveRequest(
        string? CandidateId, string? Title, string? Artist, int? Year, string? Category,
        string? Genre, string? FunFact, string? PreviewUrl, string? ArtworkUrl);

    public record RejectRequest(string? CandidateId);

    static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true, WriteIndented = true };
    static readonly SemaphoreSlim StatusLock = new(1, 1);

    // Endpoint filter that enforces the admin key. Reused for catalog write endpoints.
    public static IEndpointFilter RequireAdminKey { get; } = new AdminKeyFilter();

    sealed class AdminKeyFilter : IEndpointFilter
    {
        public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
        {
            var http = ctx.HttpContext;
            var key = http.RequestServices.GetRequiredService<IConfiguration>()["Admin:Key"];
            if (string.IsNullOrEmpty(key))
            {
                if (http.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment())
                    return await next(ctx);
                return Results.Json(new { error = "Admin er ikke konfigureret på serveren (sæt Admin__Key)." }, statusCode: 503);
            }
            var given = http.Request.Headers[KeyHeader].ToString();
            if (!System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(
                    System.Text.Encoding.UTF8.GetBytes(given), System.Text.Encoding.UTF8.GetBytes(key)))
                return Results.Json(new { error = "Forkert eller manglende admin-nøgle." }, statusCode: 401);
            return await next(ctx);
        }
    }

    public static void MapAdminEndpoints(this WebApplication app)
    {
        var admin = app.MapGroup("/api/admin").AddEndpointFilter(RequireAdminKey);

        admin.MapGet("/state", async (AppDbContext db, IWebHostEnvironment env) =>
        {
            var catalog = await db.Songs.AsNoTracking().ToListAsync();
            var status = await LoadStatusAsync(env);
            var candidates = LoadCandidates(env);
            var pending = candidates
                .Where(c => !status.ContainsKey(c.Id) && !CatalogHas(catalog, c.Artist, c.Title))
                .ToList();
            return Results.Ok(new
            {
                counts = new
                {
                    total = catalog.Count,
                    danish = catalog.Count(s => s.Category == "danish"),
                    international = catalog.Count(s => s.Category == "international"),
                },
                candidates = pending,
                totalCandidates = candidates.Count,
                decided = new
                {
                    approved = status.Values.Count(v => v == "approved"),
                    rejected = status.Values.Count(v => v == "rejected"),
                },
            });
        });

        admin.MapPost("/approve", async (ApproveRequest body, AppDbContext db, IWebHostEnvironment env) =>
        {
            var title = body.Title?.Trim() ?? "";
            var artist = body.Artist?.Trim() ?? "";
            if (title == "" || artist == "" || body.Year is not int year)
                return Results.BadRequest(new { error = "title, artist og year er påkrævet." });

            var catalog = await db.Songs.AsNoTracking().ToListAsync();
            if (CatalogHas(catalog, artist, title))
            {
                await SetStatusAsync(env, body.CandidateId, "approved");
                return Results.Ok(new { id = (string?)null, duplicate = true });
            }

            var song = new Song
            {
                Id = Guid.NewGuid().ToString("n"),
                Title = title,
                Artist = artist,
                Year = year,
                Category = body.Category == "danish" ? "danish" : "international",
                Decade = DecadeForYear(year),
                Genre = Blank(body.Genre),
                FunFact = Blank(body.FunFact),
                PreviewUrl = Blank(body.PreviewUrl),
                ArtworkUrl = Blank(body.ArtworkUrl),
            };
            db.Songs.Add(song);
            await db.SaveChangesAsync();
            await SetStatusAsync(env, body.CandidateId, "approved");
            return Results.Ok(new { id = song.Id, duplicate = false });
        });

        admin.MapPost("/reject", async (RejectRequest body, IWebHostEnvironment env) =>
        {
            if (string.IsNullOrWhiteSpace(body.CandidateId))
                return Results.BadRequest(new { error = "candidateId mangler." });
            await SetStatusAsync(env, body.CandidateId, "rejected");
            return Results.Ok(new { ok = true });
        });

        // Preview refresh: re-resolve expired iTunes preview URLs in the DB (see PreviewRefresher).
        admin.MapGet("/previews/refresh", (PreviewRefresher refresher) => Results.Ok(refresher.GetStatus()));

        admin.MapPost("/previews/refresh", (PreviewRefresher refresher) =>
        {
            refresher.TryStartRun(); // already running → just report the current status
            return Results.Accepted("/api/admin/previews/refresh", refresher.GetStatus());
        });

        admin.MapPost("/previews/refresh/{id}", async (string id, PreviewRefresher refresher, AppDbContext db, CancellationToken ct) =>
        {
            var (song, outcome) = await refresher.RefreshSongAsync(db, id, ct);
            if (song is null) return Results.NotFound();
            return Results.Ok(new { song, outcome = outcome.ToString() });
        });
    }

    static string? Blank(string? s) => string.IsNullOrWhiteSpace(s) ? null : s.Trim();

    // Mirrors decadeForYear in scripts/songsFile.ts.
    internal static string DecadeForYear(int year) => year switch
    {
        < 1970 => "60s",
        < 1980 => "70s",
        < 1990 => "80s",
        < 2000 => "90s",
        < 2010 => "00s",
        < 2020 => "10s",
        _ => "20s",
    };

    static string Norm(string s) => string.Join(' ', s.ToLowerInvariant().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    static bool CatalogHas(List<Song> catalog, string artist, string title)
    {
        var a = Norm(artist);
        var t = Norm(title);
        return catalog.Any(s => Norm(s.Artist) == a && Norm(s.Title) == t);
    }

    // Candidate pool ships with the app (seed/, linked from src/data in the csproj).
    // In `dotnet run` the content root is server/, so fall back to the repo's src/data.
    static string? FindBundled(IWebHostEnvironment env, string file)
    {
        string[] paths =
        [
            Path.Combine(env.ContentRootPath, "seed", file),
            Path.Combine(env.ContentRootPath, "..", "src", "data", file),
        ];
        return paths.FirstOrDefault(File.Exists);
    }

    static List<Candidate> LoadCandidates(IWebHostEnvironment env)
    {
        var path = FindBundled(env, "candidates.json");
        if (path is null) return [];
        try { return JsonSerializer.Deserialize<List<Candidate>>(File.ReadAllText(path), JsonOpts) ?? []; }
        catch { return []; }
    }

    // Decisions live in App_Data (survives deploys), initialised from the bundled
    // candidate-status.json the first time.
    static string StatusPath(IWebHostEnvironment env) =>
        Path.Combine(env.ContentRootPath, "App_Data", "candidate-status.json");

    static async Task<Dictionary<string, string>> LoadStatusAsync(IWebHostEnvironment env)
    {
        var path = StatusPath(env);
        if (!File.Exists(path)) path = FindBundled(env, "candidate-status.json") ?? path;
        if (!File.Exists(path)) return new();
        try { return JsonSerializer.Deserialize<Dictionary<string, string>>(await File.ReadAllTextAsync(path), JsonOpts) ?? new(); }
        catch { return new(); }
    }

    static async Task SetStatusAsync(IWebHostEnvironment env, string? candidateId, string decision)
    {
        if (string.IsNullOrWhiteSpace(candidateId)) return;
        await StatusLock.WaitAsync();
        try
        {
            var status = await LoadStatusAsync(env);
            status[candidateId] = decision;
            var path = StatusPath(env);
            Directory.CreateDirectory(Path.GetDirectoryName(path)!);
            await File.WriteAllTextAsync(path, JsonSerializer.Serialize(status, JsonOpts) + "\n");
        }
        finally { StatusLock.Release(); }
    }
}
