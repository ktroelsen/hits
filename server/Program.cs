using System.Text.Json;
using Hits.Api.Data;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// SQLite path: configurable so production can point at a persistent, writable folder
// outside the deploy target (see appsettings + deploy notes). Defaults to a local file.
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? "Data Source=hits.db";

builder.Services.AddDbContext<AppDbContext>(o => o.UseSqlite(connectionString));

// Allow the statically-hosted frontend (dev on :3000) to call the API cross-origin.
const string DevCors = "dev-frontend";
builder.Services.AddCors(o => o.AddPolicy(DevCors, p => p
    .WithOrigins("http://localhost:3000", "http://localhost:5173")
    .AllowAnyHeader()
    .AllowAnyMethod()));

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
});

songs.MapPut("/{id}", async (string id, Song input, AppDbContext db) =>
{
    var song = await db.Songs.FindAsync(id);
    if (song is null) return Results.NotFound();
    song.Title = input.Title;
    song.Artist = input.Artist;
    song.Year = input.Year;
    song.Category = input.Category;
    song.Decade = input.Decade;
    song.Genre = input.Genre;
    song.FunFact = input.FunFact;
    song.CustomPreviewUrl = input.CustomPreviewUrl;
    song.PreviewUrl = input.PreviewUrl;
    song.ArtworkUrl = input.ArtworkUrl;
    await db.SaveChangesAsync();
    return Results.Ok(song);
});

songs.MapDelete("/{id}", async (string id, AppDbContext db) =>
{
    var song = await db.Songs.FindAsync(id);
    if (song is null) return Results.NotFound();
    db.Songs.Remove(song);
    await db.SaveChangesAsync();
    return Results.NoContent();
});

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
