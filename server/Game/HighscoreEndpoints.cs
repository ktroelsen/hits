using Hits.Api.Admin;
using Hits.Api.Data;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Gameplay;

// Shared single-player highscore list. Open for players to post; admins can delete.
public static class HighscoreEndpoints
{
    private const int MaxNameLength = 20;
    private const int MaxScore = 10_000;
    private const int TopCount = 10;

    public static void MapHighscoreEndpoints(this WebApplication app)
    {
        var scores = app.MapGroup("/api/highscores");

        scores.MapGet("/", async (AppDbContext db) => await TopAsync(db));

        scores.MapPost("/", async (SubmitScoreRequest req, AppDbContext db) =>
        {
            var name = req.Name?.Trim() ?? "";
            if (name.Length is 0 or > MaxNameLength)
                return Results.BadRequest($"Navn skal være 1–{MaxNameLength} tegn.");
            if (req.Score is <= 0 or > MaxScore)
                return Results.BadRequest("Ugyldig score.");

            db.SoloScores.Add(new SoloScore
            {
                Id = Guid.NewGuid(),
                Name = name,
                Score = req.Score,
                CreatedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
            return Results.Ok(await TopAsync(db));
        });

        scores.MapDelete("/{id:guid}", async (Guid id, AppDbContext db) =>
        {
            var score = await db.SoloScores.FindAsync(id);
            if (score is null) return Results.NotFound();
            db.SoloScores.Remove(score);
            await db.SaveChangesAsync();
            return Results.NoContent();
        }).AddEndpointFilter(AdminEndpoints.RequireAdminKey);
    }

    private static async Task<List<SoloScore>> TopAsync(AppDbContext db)
    {
        // SQLite can't ORDER BY DateTime server-side reliably; the list is small, so
        // order by score in SQL and break ties by date in memory.
        var top = await db.SoloScores
            .OrderByDescending(s => s.Score)
            .Take(TopCount * 5)
            .ToListAsync();
        return top
            .OrderByDescending(s => s.Score)
            .ThenBy(s => s.CreatedAt)
            .Take(TopCount)
            .ToList();
    }

    public record SubmitScoreRequest(string? Name, int Score);
}
