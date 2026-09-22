using System.Text.Json;
using Hits.Api.Data;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Gameplay;

// Online multiplayer game API (issue 8): simultaneous rounds, one shared timeline,
// scoring = correct placement + year bonus. Host drives the main screen
// (create → start → reveal → next); players join by code and answer.
public static class GameEndpoints
{
    private static readonly string[] PlayerColors =
    {
        "#ec4899", "#3b82f6", "#f59e0b", "#10b981", "#8b5cf6",
        "#ef4444", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
    };

    public static void MapGameEndpoints(this WebApplication app)
    {
        var games = app.MapGroup("/api/games");

        // Host creates a game (lobby). Builds a shuffled deck from the catalog.
        games.MapPost("/", async (CreateGameRequest? req, AppDbContext db) =>
        {
            var songIds = await db.Songs.Select(s => s.Id).ToListAsync();
            if (songIds.Count == 0) return Results.Problem("Kataloget er tomt.");
            Shuffle(songIds);

            var game = new Game
            {
                Id = NewId(),
                Code = await GenerateUniqueCodeAsync(db),
                Status = GameStatus.Lobby,
                CreatedAt = DateTime.UtcNow,
                CurrentRound = 0,
                TargetRounds = Math.Clamp(req?.TargetRounds ?? 10, 1, songIds.Count),
                DeckJson = JsonSerializer.Serialize(songIds),
                DeckPosition = 0,
            };
            db.Games.Add(game);
            await db.SaveChangesAsync();
            return Results.Ok(new { gameId = game.Id, code = game.Code });
        });

        // Player joins by code with a name.
        games.MapPost("/{code}/join", async (string code, JoinRequest req, AppDbContext db) =>
        {
            var game = await db.Games.Include(g => g.Players).FirstOrDefaultAsync(g => g.Code == code);
            if (game is null) return Results.NotFound("Spil ikke fundet.");
            if (game.Status != GameStatus.Lobby) return Results.BadRequest("Spillet er allerede i gang.");
            var name = (req.Name ?? "").Trim();
            if (string.IsNullOrEmpty(name)) return Results.BadRequest("Navn er påkrævet.");
            if (game.Players.Any(p => string.Equals(p.Name, name, StringComparison.OrdinalIgnoreCase)))
                return Results.Conflict("Navnet er allerede taget i dette spil.");

            var player = new Player
            {
                Id = NewId(),
                GameId = game.Id,
                Name = name,
                Color = PlayerColors[game.Players.Count % PlayerColors.Length],
                Score = 0,
                JoinedAt = DateTime.UtcNow,
            };
            db.Players.Add(player);
            await db.SaveChangesAsync();
            return Results.Ok(new { id = player.Id, name = player.Name, color = player.Color });
        });

        // Host starts the game → first round.
        games.MapPost("/{code}/start", async (string code, AppDbContext db) =>
        {
            var game = await db.Games.Include(g => g.Players).FirstOrDefaultAsync(g => g.Code == code);
            if (game is null) return Results.NotFound();
            if (game.Status != GameStatus.Lobby) return Results.BadRequest("Spillet er allerede startet.");
            if (game.Players.Count == 0) return Results.BadRequest("Ingen spillere har joinet endnu.");
            await StartNextRoundAsync(game, db);
            await db.SaveChangesAsync();
            return Results.Ok();
        });

        // Player submits their placement + year for the current round.
        games.MapPost("/{code}/answer", async (string code, AnswerRequest req, AppDbContext db) =>
        {
            var game = await db.Games.FirstOrDefaultAsync(g => g.Code == code);
            if (game is null) return Results.NotFound();
            if (game.Status != GameStatus.Playing) return Results.BadRequest("Ingen aktiv runde.");

            var round = await db.Rounds.FirstOrDefaultAsync(r => r.GameId == game.Id && r.Number == game.CurrentRound);
            if (round is null || round.Status != RoundStatus.Playing) return Results.BadRequest("Runden tager ikke imod svar.");

            var player = await db.Players.FirstOrDefaultAsync(p => p.Id == req.PlayerId && p.GameId == game.Id);
            if (player is null) return Results.BadRequest("Ukendt spiller.");

            var existing = await db.Answers.FirstOrDefaultAsync(a => a.RoundId == round.Id && a.PlayerId == player.Id);
            if (existing is not null) return Results.Conflict("Du har allerede svaret i denne runde.");

            db.Answers.Add(new Answer
            {
                Id = NewId(),
                GameId = game.Id,
                RoundId = round.Id,
                PlayerId = player.Id,
                InsertIndex = req.InsertIndex,
                GuessedYear = req.GuessedYear,
                SubmittedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync();
            return Results.Ok();
        });

        // Host reveals the current round: score every answer, update the timeline.
        games.MapPost("/{code}/reveal", async (string code, AppDbContext db) =>
        {
            var game = await db.Games.FirstOrDefaultAsync(g => g.Code == code);
            if (game is null) return Results.NotFound();
            if (game.Status != GameStatus.Playing) return Results.BadRequest("Ingen runde at afsløre.");

            var round = await db.Rounds.FirstOrDefaultAsync(r => r.GameId == game.Id && r.Number == game.CurrentRound);
            if (round is null) return Results.BadRequest("Runden findes ikke.");

            var song = await db.Songs.FindAsync(round.SongId);
            if (song is null) return Results.Problem("Rundens sang findes ikke i kataloget.");

            var timeline = await BuildTimelineAsync(game, db); // revealed songs so far (year-sorted)
            var correctIndex = CorrectIndexFor(song.Year, timeline);
            round.CorrectIndex = correctIndex;

            var answers = await db.Answers.Where(a => a.RoundId == round.Id).ToListAsync();
            var players = await db.Players.Where(p => p.GameId == game.Id).ToListAsync();
            foreach (var ans in answers)
            {
                ans.PlacementCorrect = ans.InsertIndex == correctIndex;
                ans.YearCorrect = ans.GuessedYear.HasValue && ans.GuessedYear.Value == song.Year;
                ans.Points = (ans.PlacementCorrect ? game.PointsPlacement : 0)
                           + (ans.YearCorrect ? game.PointsYearBonus : 0);
                var player = players.FirstOrDefault(p => p.Id == ans.PlayerId);
                if (player is not null) player.Score += ans.Points;
            }

            round.Status = RoundStatus.Revealed;
            game.Status = GameStatus.Revealed;
            await db.SaveChangesAsync();
            return Results.Ok();
        });

        // Host advances to the next round, or finishes the game.
        games.MapPost("/{code}/next", async (string code, AppDbContext db) =>
        {
            var game = await db.Games.FirstOrDefaultAsync(g => g.Code == code);
            if (game is null) return Results.NotFound();
            if (game.Status != GameStatus.Revealed) return Results.BadRequest("Afslør den nuværende runde først.");

            var deck = JsonSerializer.Deserialize<List<string>>(game.DeckJson) ?? new();
            if (game.CurrentRound >= game.TargetRounds || game.DeckPosition >= deck.Count)
            {
                game.Status = GameStatus.Finished;
                await db.SaveChangesAsync();
                return Results.Ok(new { finished = true });
            }
            await StartNextRoundAsync(game, db);
            await db.SaveChangesAsync();
            return Results.Ok(new { finished = false });
        });

        // Full state for the main screen and players. Hides the round song's identity
        // (title/artist/year) until the round is revealed — only audio is exposed.
        games.MapGet("/{code}", async (string code, AppDbContext db) =>
        {
            var game = await db.Games.FirstOrDefaultAsync(g => g.Code == code);
            if (game is null) return Results.NotFound();

            var players = await db.Players
                .Where(p => p.GameId == game.Id)
                .OrderByDescending(p => p.Score).ThenBy(p => p.JoinedAt)
                .Select(p => new { p.Id, p.Name, p.Color, p.Score })
                .ToListAsync();

            var timeline = await BuildTimelineAsync(game, db);

            object? roundDto = null;
            if (game.CurrentRound > 0)
            {
                var round = await db.Rounds.FirstOrDefaultAsync(r => r.GameId == game.Id && r.Number == game.CurrentRound);
                if (round is not null)
                {
                    var song = await db.Songs.FindAsync(round.SongId);
                    var answers = await db.Answers.Where(a => a.RoundId == round.Id).ToListAsync();
                    var revealed = round.Status == RoundStatus.Revealed;
                    roundDto = new
                    {
                        number = round.Number,
                        status = round.Status,
                        audioUrl = song?.PreviewUrl ?? song?.CustomPreviewUrl,
                        answeredPlayerIds = answers.Select(a => a.PlayerId).ToList(),
                        correctIndex = revealed ? round.CorrectIndex : null,
                        song = revealed && song is not null
                            ? new { song.Id, song.Title, song.Artist, song.Year, song.PreviewUrl, song.ArtworkUrl }
                            : null,
                        results = revealed
                            ? answers.Select(a => new
                            {
                                a.PlayerId, a.InsertIndex, a.GuessedYear,
                                a.PlacementCorrect, a.YearCorrect, a.Points,
                            }).ToList<object>()
                            : new List<object>(),
                    };
                }
            }

            return Results.Ok(new
            {
                code = game.Code,
                status = game.Status,
                currentRound = game.CurrentRound,
                targetRounds = game.TargetRounds,
                players,
                timeline = timeline.Select(s => new { s.Id, s.Title, s.Artist, s.Year, s.ArtworkUrl }),
                round = roundDto,
            });
        });
    }

    // ---- helpers ----

    private static string NewId() => Guid.NewGuid().ToString("n");

    private static async Task<string> GenerateUniqueCodeAsync(AppDbContext db)
    {
        var rng = Random.Shared;
        for (var attempt = 0; attempt < 20; attempt++)
        {
            var code = rng.Next(0, 100_000_000).ToString("D8");
            if (!await db.Games.AnyAsync(g => g.Code == code)) return code;
        }
        throw new InvalidOperationException("Kunne ikke generere en unik spilkode.");
    }

    private static void Shuffle<T>(IList<T> list)
    {
        var rng = Random.Shared;
        for (var i = list.Count - 1; i > 0; i--)
        {
            var j = rng.Next(i + 1);
            (list[i], list[j]) = (list[j], list[i]);
        }
    }

    // The shared timeline = songs from already-revealed rounds, sorted ascending by year.
    private static async Task<List<Song>> BuildTimelineAsync(Game game, AppDbContext db)
    {
        var revealedSongIds = await db.Rounds
            .Where(r => r.GameId == game.Id && r.Status == RoundStatus.Revealed)
            .Select(r => r.SongId)
            .ToListAsync();
        if (revealedSongIds.Count == 0) return new();
        var songs = await db.Songs.Where(s => revealedSongIds.Contains(s.Id)).ToListAsync();
        return songs.OrderBy(s => s.Year).ToList();
    }

    // Correct insertion index into a year-sorted timeline: the number of songs with a
    // strictly earlier year. An empty timeline always yields 0 (first card is free).
    private static int CorrectIndexFor(int year, List<Song> timeline)
        => timeline.Count(s => s.Year < year);

    // Draws the next deck song and opens a new playing round.
    private static async Task StartNextRoundAsync(Game game, AppDbContext db)
    {
        var deck = JsonSerializer.Deserialize<List<string>>(game.DeckJson) ?? new();
        var songId = deck[game.DeckPosition];
        game.DeckPosition++;
        game.CurrentRound++;
        game.Status = GameStatus.Playing;
        db.Rounds.Add(new Round
        {
            Id = NewId(),
            GameId = game.Id,
            Number = game.CurrentRound,
            SongId = songId,
            Status = RoundStatus.Playing,
            StartedAt = DateTime.UtcNow,
        });
    }
}

public record CreateGameRequest(int? TargetRounds);
public record JoinRequest(string Name);
public record AnswerRequest(string PlayerId, int InsertIndex, int? GuessedYear);
