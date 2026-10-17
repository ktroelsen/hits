using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Data;

// A song library is one SQLite database with its own catalog, tags, games, highscores and
// admin key, so e.g. two families can each curate their own songs without disturbing
// each other. The default library is App_Data/hits.db (admin key "Admin:Key"); every
// App_Data/hits-{id}.db is another library (admin key "Libraries:{id}:AdminKey", env
// Libraries__{id}__AdminKey). Its display name is "Libraries:{id}:Name" (default: the id).
// The "playground" library always exists and can be chosen under Indstillinger in the app.
// It is the former "mol" library: file App_Data/hits-mol.db, admin key
// "Libraries:playground:AdminKey" or else "Libraries:mol:AdminKey" (secret ADMIN_KEY_MOL).
public sealed record Library(string Id, string Name, string ConnectionString, string? AdminKey, string? FileId = null)
{
    public bool IsDefault => Id == LibraryRegistry.DefaultId;

    // Per-library suffix for files and cookies: "" for the default library, "-mol" otherwise.
    public string Suffix => IsDefault ? "" : $"-{FileId ?? Id}";
}

public sealed partial class LibraryRegistry
{
    public const string DefaultId = "hits";
    public const string PlaygroundId = "playground";
    // The playground keeps the data of the library it replaced (App_Data/hits-mol.db).
    const string PlaygroundFileId = "mol";
    // The browser's library: Standard/Playground chosen under Indstillinger, or any library
    // by opening the site with ?db=<id>. The frontend remembers it in a cookie so every
    // request and the SignalR hub carry it. X-Library is for scripts.
    public const string CookieName = "hits_lib";
    public const string HeaderName = "X-Library";
    public const string QueryName = "db";

    public IReadOnlyList<Library> All { get; }
    public Library Default => All[0];

    LibraryRegistry(IReadOnlyList<Library> all) => All = all;

    // "mol" (the playground's old name, e.g. in old cookies and ?db=mol links) finds the playground.
    public Library? Find(string? id)
    {
        if (string.IsNullOrWhiteSpace(id)) return null;
        var key = id.Trim().ToLowerInvariant();
        if (key == PlaygroundFileId) key = PlaygroundId;
        return All.FirstOrDefault(l => l.Id == key);
    }

    public Library FromRequest(HttpContext? http)
    {
        if (http is null) return Default;
        var req = http.Request;
        return Find(req.Headers[HeaderName].ToString())
            ?? Find(req.Query[QueryName].ToString())
            ?? Find(req.Cookies[CookieName])
            ?? Default;
    }

    public static LibraryRegistry Load(IConfiguration config, string dataDir)
    {
        var libraries = new List<Library>
        {
            new(DefaultId,
                config[$"Libraries:{DefaultId}:Name"] ?? "Standard",
                config.GetConnectionString("Default") ?? $"Data Source={Path.Combine(dataDir, "hits.db")}",
                config["Admin:Key"]),
            new(PlaygroundId,
                config[$"Libraries:{PlaygroundId}:Name"] ?? "Playground",
                $"Data Source={Path.Combine(dataDir, $"hits-{PlaygroundFileId}.db")}",
                config[$"Libraries:{PlaygroundId}:AdminKey"] ?? config[$"Libraries:{PlaygroundFileId}:AdminKey"],
                PlaygroundFileId),
        };

        // Libraries named in config, plus every hits-{id}.db file dropped into App_Data.
        var ids = config.GetSection("Libraries").GetChildren().Select(c => c.Key.ToLowerInvariant())
            .Concat(Directory.EnumerateFiles(dataDir, "hits-*.db")
                .Select(f => Path.GetFileNameWithoutExtension(f)["hits-".Length..].ToLowerInvariant()))
            .Where(id => id is not (DefaultId or PlaygroundId or PlaygroundFileId) && IdPattern().IsMatch(id))
            .Distinct()
            .Order();
        foreach (var id in ids)
        {
            libraries.Add(new(id,
                config[$"Libraries:{id}:Name"] ?? char.ToUpperInvariant(id[0]) + id[1..],
                $"Data Source={Path.Combine(dataDir, $"hits-{id}.db")}",
                config[$"Libraries:{id}:AdminKey"]));
        }
        return new LibraryRegistry(libraries);
    }

    [GeneratedRegex("^[a-z0-9][a-z0-9_]{0,31}$")]
    private static partial Regex IdPattern();
}

// The library this request (or background scope) works on. AppDbContext connects to it.
// Resolved lazily from the request, so SignalR hub calls use the connection's request too.
public sealed class LibraryContext(LibraryRegistry registry, IHttpContextAccessor http)
{
    Library? _current;

    public Library Current => _current ??= registry.FromRequest(http.HttpContext);

    public void Use(Library library) => _current = library;
}

public static class LibraryScopes
{
    // A DI scope whose AppDbContext talks to the given library (for background work).
    public static IServiceScope CreateLibraryScope(this IServiceScopeFactory scopes, Library library)
    {
        var scope = scopes.CreateScope();
        scope.ServiceProvider.GetRequiredService<LibraryContext>().Use(library);
        return scope;
    }

    public static void MapLibraryEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/libraries");

        // The library this browser uses. The other libraries are deliberately not listed.
        group.MapGet("/", (LibraryContext current) =>
            Results.Ok(new { current.Current.Id, current.Current.Name }));

        // Which library an online game code belongs to, so a player who types the code on
        // another device joins the right one (the chosen library first).
        group.MapGet("/game/{code}", async (string code, LibraryRegistry registry, LibraryContext current, IServiceScopeFactory scopes) =>
        {
            foreach (var library in registry.All.OrderBy(l => l != current.Current))
            {
                using var scope = scopes.CreateLibraryScope(library);
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                if (await db.Games.AnyAsync(g => g.Code == code))
                    return Results.Ok(new { library = library.Id });
            }
            return Results.NotFound();
        });
    }
}
