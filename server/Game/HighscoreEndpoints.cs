using Hits.Api.Admin;
using Hits.Api.Data;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Gameplay;

// Shared single-player highscore lists: all-time and this week (resets Monday 00:00
// Danish time). Every score keeps its name, score and timestamp, so the weekly list
// is the same data filtered on CreatedAt — nothing is deleted at the reset.
// Open for players to post; admins can delete.
public static class HighscoreEndpoints
{
    private const int MaxNameLength = 20;
    private const int MaxScore = 10_000;
    private const int TopCount = 10;

    public static void MapHighscoreEndpoints(this WebApplication app)
    {
        var scores = app.MapGroup("/api/highscores");

        scores.MapGet("/", async (AppDbContext db) => await ListsAsync(db));

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
            return Results.Ok(await ListsAsync(db));
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

    private static async Task<HighscoreLists> ListsAsync(AppDbContext db)
    {
        var weekStart = WeekStartUtc(DateTime.UtcNow);
        return new HighscoreLists(
            await TopAsync(db.SoloScores),
            await TopAsync(db.SoloScores.Where(s => s.CreatedAt >= weekStart)),
            weekStart);
    }

    private static async Task<List<SoloScore>> TopAsync(IQueryable<SoloScore> query)
    {
        // SQLite can't ORDER BY DateTime server-side reliably; the list is small, so
        // order by score in SQL and break ties by date in memory.
        var top = await query
            .OrderByDescending(s => s.Score)
            .Take(TopCount * 5)
            .ToListAsync();
        return top
            .OrderByDescending(s => s.Score)
            .ThenBy(s => s.CreatedAt)
            .Take(TopCount)
            .ToList();
    }

    // Monday 00:00 (Danish time) of the week containing utcNow, returned as UTC.
    internal static DateTime WeekStartUtc(DateTime utcNow)
    {
        var local = TimeZoneInfo.ConvertTimeFromUtc(utcNow, DanishTime);
        var daysSinceMonday = ((int)local.DayOfWeek + 6) % 7;
        var monday = DateTime.SpecifyKind(local.Date.AddDays(-daysSinceMonday), DateTimeKind.Unspecified);
        return TimeZoneInfo.ConvertTimeToUtc(monday, DanishTime);
    }

    private static readonly TimeZoneInfo DanishTime = FindDanishTime();

    // IANA id works on Linux and on Windows with ICU; the Windows id is the fallback for IIS.
    private static TimeZoneInfo FindDanishTime()
    {
        foreach (var id in new[] { "Europe/Copenhagen", "Romance Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        return TimeZoneInfo.Utc;
    }

    public record SubmitScoreRequest(string? Name, int Score);
    public record HighscoreLists(List<SoloScore> AllTime, List<SoloScore> Weekly, DateTime WeekStart);
}
