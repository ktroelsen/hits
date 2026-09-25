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

        // Host creates a game (lobby). The deck follows the host's play session order,
        // so songs the host has already heard in earlier games come last.
        games.MapPost("/", async (CreateGameRequest? req, HttpContext http, AppDbContext db) =>
        {
            var session = await PlaySessionStore.GetOrCreateAsync(http, db);
            var songIds = PlaySessionStore.DeckOrder(session);
            if (songIds.Count == 0) return Results.Problem("Kataloget er tomt.");

            // No two rounds may share a year, so a game can't be longer than the number of years.
            var distinctYears = await db.Songs.Where(x => songIds.Contains(x.Id)).Select(x => x.Year).Distinct().CountAsync();
            if (distinctYears == 0) return Results.Problem("Kataloget er tomt.");

            var playbackMode = req?.PlaybackMode == GamePlaybackMode.Individual
                ? GamePlaybackMode.Individual
                : GamePlaybackMode.Shared;
            var game = new Game
            {
                Id = NewId(),
                Code = await GenerateUniqueCodeAsync(db),
                Status = GameStatus.Lobby,
                CreatedAt = DateTime.UtcNow,
                CurrentRound = 0,
                TargetRounds = Math.Clamp(req?.TargetRounds ?? 10, 1, distinctYears),
                DeckJson = JsonSerializer.Serialize(songIds),
                DeckPosition = 0,
                HostSessionId = session.Id,
                PlaybackMode = playbackMode,
            };
            db.Games.Add(game);
            await db.SaveChangesAsync();
            return Results.Ok(new { gameId = game.Id, code = game.Code });
        });

        // Player joins by code with a name.
        games.MapPost("/{code}/join", async (string code, JoinRequest req, AppDbContext db, GameBroadcaster bc) =>
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
            await bc.BroadcastAsync(db, code);
            return Results.Ok(new { id = player.Id, name = player.Name, color = player.Color });
        });

        // Host starts the game → first round.
        games.MapPost("/{code}/start", async (string code, AppDbContext db, GameBroadcaster bc) =>
        {
            var game = await db.Games.Include(g => g.Players).FirstOrDefaultAsync(g => g.Code == code);
            if (game is null) return Results.NotFound();
            if (game.Status != GameStatus.Lobby) return Results.BadRequest("Spillet er allerede startet.");
            if (game.Players.Count == 0) return Results.BadRequest("Ingen spillere har joinet endnu.");
            if (!await StartNextRoundAsync(game, db)) return Results.Problem("Ingen sange tilbage i bunken.");
            await db.SaveChangesAsync();
            await bc.BroadcastAsync(db, code);
            return Results.Ok();
        });

        // Player submits their placement + year for the current round. In individual
        // playback mode the round reveals itself once every player has answered.
        games.MapPost("/{code}/answer", async (string code, AnswerRequest req, AppDbContext db, GameBroadcaster bc) =>
        {
            await RoundLock.WaitAsync();
            try { return await SubmitAnswerAsync(code, req, db, bc); }
            finally { RoundLock.Release(); }
        });

        // Host reveals the current round manually (shared mode, or when someone never answers).
        games.MapPost("/{code}/reveal", async (string code, AppDbContext db, GameBroadcaster bc) =>
        {
            await RoundLock.WaitAsync();
            try
            {
                var game = await db.Games.FirstOrDefaultAsync(g => g.Code == code);
                if (game is null) return Results.NotFound();
                if (game.Status != GameStatus.Playing) return Results.BadRequest("Ingen runde at afsløre.");

                var round = await db.Rounds.FirstOrDefaultAsync(r => r.GameId == game.Id && r.Number == game.CurrentRound);
                if (round is null) return Results.BadRequest("Runden findes ikke.");

                var error = await RevealRoundAsync(game, round, db);
                if (error is not null) return error;
                await db.SaveChangesAsync();
                await bc.BroadcastAsync(db, code);
                return Results.Ok();
            }
            finally { RoundLock.Release(); }
        });

        // Host advances to the next round, or finishes the game.
        games.MapPost("/{code}/next", async (string code, AppDbContext db, GameBroadcaster bc) =>
        {
            await RoundLock.WaitAsync();
            try
            {
                var game = await db.Games.FirstOrDefaultAsync(g => g.Code == code);
                if (game is null) return Results.NotFound();
                if (game.Status != GameStatus.Revealed) return Results.BadRequest("Afslør den nuværende runde først.");

                var finished = await AdvanceAsync(game, db);
                await db.SaveChangesAsync();
                await bc.BroadcastAsync(db, code);
                return Results.Ok(new { finished });
            }
            finally { RoundLock.Release(); }
        });

        // Player pressed "Videre" after a reveal. In individual playback mode the next
        // round starts once every player is ready (the host can still press "Næste runde").
        games.MapPost("/{code}/ready", async (string code, ReadyRequest req, AppDbContext db, GameBroadcaster bc) =>
        {
            await RoundLock.WaitAsync();
            try
            {
                var game = await db.Games.FirstOrDefaultAsync(g => g.Code == code);
                if (game is null) return Results.NotFound();
                if (game.Status != GameStatus.Revealed) return Results.BadRequest("Runden er ikke afsløret.");

                var players = await db.Players.Where(p => p.GameId == game.Id).ToListAsync();
                var player = players.FirstOrDefault(p => p.Id == req.PlayerId);
                if (player is null) return Results.BadRequest("Ukendt spiller.");
                player.ReadyForRound = game.CurrentRound;

                if (game.PlaybackMode == GamePlaybackMode.Individual &&
                    players.All(p => p.ReadyForRound == game.CurrentRound))
                    await AdvanceAsync(game, db);

                await db.SaveChangesAsync();
                await bc.BroadcastAsync(db, code);
                return Results.Ok();
            }
            finally { RoundLock.Release(); }
        });

        // Full state for the main screen and players (also used by SignalR). Hides the
        // round song's identity until the round is revealed — only audio is exposed.
        games.MapGet("/{code}", async (string code, AppDbContext db) =>
        {
            var state = await GameStateBuilder.BuildAsync(db, code);
            return state is null ? Results.NotFound() : Results.Ok(state);
        });
    }

    // Serialises answers and reveals, so two "last" answers arriving together can't
    // both trigger the auto-reveal and score the round twice. Single-server app.
    private static readonly SemaphoreSlim RoundLock = new(1, 1);

    private static async Task<IResult> SubmitAnswerAsync(string code, AnswerRequest req, AppDbContext db, GameBroadcaster bc)
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

        if (game.PlaybackMode == GamePlaybackMode.Individual)
        {
            var answered = await db.Answers.CountAsync(a => a.RoundId == round.Id);
            var playerCount = await db.Players.CountAsync(p => p.GameId == game.Id);
            if (answered >= playerCount && await RevealRoundAsync(game, round, db) is null)
                await db.SaveChangesAsync();
        }

        await bc.BroadcastAsync(db, code);
        return Results.Ok();
    }

    // Scores every answer of a playing round and marks it revealed (the round song
    // joins the timeline). Caller saves. Returns an error result, or null on success.
    private static async Task<IResult?> RevealRoundAsync(Game game, Round round, AppDbContext db)
    {
        if (round.Status != RoundStatus.Playing) return Results.BadRequest("Runden er allerede afsløret.");

        var song = await db.Songs.FindAsync(round.SongId);
        if (song is null) return Results.Problem("Rundens sang findes ikke i kataloget.");

        var timeline = await GameStateBuilder.BuildTimelineAsync(game, db); // revealed songs so far
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
        return null;
    }

    // ---- helpers ----

    private static string NewId() => Guid.NewGuid().ToString("n");

    private static async Task<string> GenerateUniqueCodeAsync(AppDbContext db)
    {
        // 4-digit codes are few (10.000), so a code held by a finished or stale game is
        // reused: the old game's code gets a suffix so the unique index still holds.
        var staleBefore = DateTime.UtcNow.AddHours(-12);
        var rng = Random.Shared;
        for (var attempt = 0; attempt < 50; attempt++)
        {
            var code = rng.Next(0, 10_000).ToString("D4");
            var existing = await db.Games.FirstOrDefaultAsync(g => g.Code == code);
            if (existing is null) return code;
            if (existing.Status == GameStatus.Finished || existing.CreatedAt < staleBefore)
            {
                existing.Code = $"{code}-{existing.Id[..8]}";
                await db.SaveChangesAsync();
                return code;
            }
        }
        throw new InvalidOperationException("Kunne ikke generere en unik spilkode.");
    }

    // Correct insertion index into a year-sorted timeline: the number of songs with a
    // strictly earlier year. An empty timeline always yields 0 (first card is free).
    private static int CorrectIndexFor(int year, List<Song> timeline)
        => timeline.Count(s => s.Year < year);

    // Moves a revealed game on: the next round, or finished when the target is reached
    // or the deck is empty. Caller saves. Returns true when the game finished.
    private static async Task<bool> AdvanceAsync(Game game, AppDbContext db)
    {
        if (game.CurrentRound < game.TargetRounds && await StartNextRoundAsync(game, db))
            return false;
        game.Status = GameStatus.Finished;
        return true;
    }

    // Draws the next deck song and opens a new playing round. Like the single-device
    // game, songs whose year is already on the timeline are skipped (left unplayed), so
    // no two cards share a year. The song is marked played in the host's play session
    // (if it hasn't been cleaned up). Returns false when the deck has no usable song left.
    private static async Task<bool> StartNextRoundAsync(Game game, AppDbContext db)
    {
        var deck = JsonSerializer.Deserialize<List<string>>(game.DeckJson) ?? new();
        var remaining = deck.Skip(game.DeckPosition).ToList();
        var yearById = await db.Songs.Where(x => remaining.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, x => x.Year);
        var playedIds = await db.Rounds.Where(r => r.GameId == game.Id).Select(r => r.SongId).ToListAsync();
        var takenYears = (await db.Songs.Where(x => playedIds.Contains(x.Id)).Select(x => x.Year).ToListAsync())
            .ToHashSet();

        while (game.DeckPosition < deck.Count &&
               (!yearById.TryGetValue(deck[game.DeckPosition], out var year) || takenYears.Contains(year)))
            game.DeckPosition++;
        if (game.DeckPosition >= deck.Count) return false;

        var songId = deck[game.DeckPosition];
        if (game.HostSessionId is not null &&
            await db.PlaySessions.FindAsync(game.HostSessionId) is { } session)
            PlaySessionStore.MarkPlayed(session, new[] { songId });
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
        return true;
    }
}

public record CreateGameRequest(int? TargetRounds, string? PlaybackMode);
public record JoinRequest(string Name);
public record AnswerRequest(string PlayerId, int InsertIndex, int? GuessedYear);
public record ReadyRequest(string PlayerId);
