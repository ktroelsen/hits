using System.Text.Json;
using Hits.Api.Admin;
using Hits.Api.Catalog;
using Hits.Api.Data;
using Hits.Api.Gameplay;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// SQLite path. Defaults to App_Data/hits.db under the content root; the deploy keeps
// App_Data across releases (msdeploy -skip) so game/catalog data survives redeploys.
// Override with ConnectionStrings__Default to point at any persistent, writable path.
var dataDir = Path.Combine(builder.Environment.ContentRootPath, "App_Data");
Directory.CreateDirectory(dataDir);
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? $"Data Source={Path.Combine(dataDir, "hits.db")}";

builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite(connectionString));
builder.Services.AddSignalR();
builder.Services.AddScoped<GameBroadcaster>();
builder.Services.AddHostedService<PlaySessionCleanupService>();

// Keeps iTunes preview URLs in the catalog alive (they expire); runs weekly + on demand from /admin.
builder.Services.AddHttpClient(nameof(PreviewRefresher), c => c.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddSingleton<PreviewRefresher>();
builder.Services.AddHostedService<PreviewRefreshJob>();

// Allow the statically-hosted frontend (dev on :3000) to call the API cross-origin.
const string DevCors = "dev-frontend";
builder.Services.AddCors(o => o.AddPolicy(DevCors, p => p
    .WithOrigins("http://localhost:3000", "http://localhost:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()
    .AllowCredentials())); // play session cookie (hits_session)

var app = builder.Build();

// Apply migrations and seed the catalog on startup.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    await SeedSongsAsync(db, app.Environment, app.Logger);
}

if (app.Environment.IsDevelopment())
    app.UseCors(DevCors);

// Serve the built React frontend from wwwroot (populated by the deploy: dist → wwwroot).
// In production this makes the whole app one self-contained .NET site — frontend, API
// and SignalR hub under one origin, so no proxy or CORS is needed live.
app.UseDefaultFiles();
app.UseStaticFiles();

// ---- Song catalog API (issue 10) ----
var songs = app.MapGroup("/api/songs");

songs.MapGet("/", async (AppDbContext db) =>
    await db.Songs.OrderBy(s => s.Year).ToListAsync());

songs.MapGet("/{id}", async (string id, AppDbContext db) =>
    await db.Songs.FindAsync(id) is { } song ? Results.Ok(song) : Results.NotFound());

songs.MapPost("/", async (Song song, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(song.Id))
        song.Id = Guid.NewGuid().ToString("n");
    if (await db.Songs.AnyAsync(s => s.Id == song.Id))
        return Results.Conflict($"Song '{song.Id}' already exists.");
    db.Songs.Add(song);
    await db.SaveChangesAsync();
    return Results.Created($"/api/songs/{song.Id}", song);
}).AddEndpointFilter(AdminEndpoints.RequireAdminKey);

songs.MapPut("/{id}", async (string id, Song input, AppDbContext db) =>
{
    var song = await db.Songs.FindAsync(id);
    if (song is null) return Results.NotFound();
    song.Title = input.Title;
    song.Artist = input.Artist;
    song.Year = input.Year;
    song.Category = input.Category;
    song.Decade = AdminEndpoints.DecadeForYear(input.Year); // keep in sync with the year
    song.Genre = input.Genre;
    song.FunFact = input.FunFact;
    song.CustomPreviewUrl = input.CustomPreviewUrl;
    song.PreviewUrl = input.PreviewUrl;
    song.ArtworkUrl = input.ArtworkUrl;
    await db.SaveChangesAsync();
    return Results.Ok(song);
}).AddEndpointFilter(AdminEndpoints.RequireAdminKey);

songs.MapDelete("/{id}", async (string id, AppDbContext db) =>
{
    var song = await db.Songs.FindAsync(id);
    if (song is null) return Results.NotFound();
    db.Songs.Remove(song);
    await db.SaveChangesAsync();
    return Results.NoContent();
}).AddEndpointFilter(AdminEndpoints.RequireAdminKey);

// ---- Admin curation API (/admin) ----
app.MapAdminEndpoints();

// ---- Online game API (issue 8) ----
app.MapGameEndpoints();
app.MapHub<GameHub>("/gameHub");

// ---- Shared single-player highscores ----
app.MapHighscoreEndpoints();

// ---- Per-browser song order (no repeats across games) ----
app.MapPlaySessionEndpoints();

// SPA fallback: client-side routes (/game, /game/{code}, /admin) return index.html.
// Runs after the API and hub are mapped, so it never shadows them.
app.MapFallbackToFile("index.html");

app.Run();

// Seeds the catalog once from server/seed/songs.json (generated from src/data/songs.ts
// via `npm run export-songs`). No-op if the table already has rows.
static async Task SeedSongsAsync(AppDbContext db, IWebHostEnvironment env, ILogger logger)
{
    if (await db.Songs.AnyAsync()) return;

    var seedPath = Path.Combine(env.ContentRootPath, "seed", "songs.json");
    if (!File.Exists(seedPath))
    {
        logger.LogWarning("Seed file not found at {Path}; starting with empty catalog.", seedPath);
        return;
    }

    await using var stream = File.OpenRead(seedPath);
    var opts = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
    var seeded = await JsonSerializer.DeserializeAsync<List<Song>>(stream, opts) ?? new();
    db.Songs.AddRange(seeded);
    await db.SaveChangesAsync();
    logger.LogInformation("Seeded {Count} songs into SQLite.", seeded.Count);
}
