using Hits.Api.Data;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Gameplay;

// Builds the full game-state payload for the main screen and players. Shared by the
// GET /api/games/{code} endpoint, the SignalR hub (on join), and every broadcast so
// the shape is identical everywhere. Hides the current round song's identity until
// the round is revealed.
public static class GameStateBuilder
{
    public static async Task<object?> BuildAsync(AppDbContext db, string code)
    {
        var game = await db.Games.FirstOrDefaultAsync(g => g.Code == code);
        if (game is null) return null;

        var players = await db.Players
            .Where(p => p.GameId == game.Id)
            .OrderByDescending(p => p.Score).ThenBy(p => p.JoinedAt)
            .Select(p => new { p.Id, p.Name, p.Color, p.Score, p.ReadyForRound })
            .ToListAsync();

        var valueOf = await ValueOfAsync(game, db);
        var timeline = await BuildTimelineAsync(game, db, valueOf);
        var rank = game.RankTag is null ? null : await db.RankedTags.FindAsync(game.RankTag);

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
                    readyPlayerIds = players.Where(p => p.ReadyForRound == round.Number).Select(p => p.Id).ToList(),
                    correctIndex = revealed ? round.CorrectIndex : null,
                    song = revealed && song is not null
                        ? new { song.Id, song.Title, song.Artist, song.Year, value = valueOf(song), song.PreviewUrl, song.ArtworkUrl }
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

        return new
        {
            code = game.Code,
            status = game.Status,
            currentRound = game.CurrentRound,
            targetRounds = game.TargetRounds,
            playbackMode = game.PlaybackMode,
            // Placement game: how the numbers read and which occur (for the guess picker).
            rank = game.RankTag is null ? null : new
            {
                tag = game.RankTag,
                valuePrefix = rank?.ValuePrefix ?? "",
                valueSuffix = rank?.ValueSuffix ?? "",
                values = await GameValuesAsync(game, db),
            },
            players = players.Select(p => new { p.Id, p.Name, p.Color, p.Score }),
            timeline = timeline.Select(s => new { s.Id, s.Title, s.Artist, s.Year, value = valueOf(s), s.ArtworkUrl }),
            round = roundDto,
        };
    }

    // The number each song is placed by: its year, or in a placement game its number in
    // the game's tag (songs without one sort last; the deck only holds numbered songs).
    public static async Task<Func<Song, int>> ValueOfAsync(Game game, AppDbContext db)
    {
        if (game.RankTag is null) return s => s.Year;
        var values = await db.SongTagValues.Where(v => v.Tag == game.RankTag)
            .ToDictionaryAsync(v => v.SongId, v => v.Value);
        return s => values.TryGetValue(s.Id, out var v) ? v : int.MaxValue;
    }

    // The distinct numbers of the songs in a placement game's deck, ascending.
    static async Task<List<int>> GameValuesAsync(Game game, AppDbContext db)
    {
        var deck = System.Text.Json.JsonSerializer.Deserialize<List<string>>(game.DeckJson) ?? new();
        return await db.SongTagValues
            .Where(v => v.Tag == game.RankTag && deck.Contains(v.SongId))
            .Select(v => v.Value).Distinct().OrderBy(v => v).ToListAsync();
    }

    // The shared timeline = songs from already-revealed rounds, sorted ascending by their
    // value (year, or number in a placement game).
    public static async Task<List<Song>> BuildTimelineAsync(Game game, AppDbContext db, Func<Song, int> valueOf)
    {
        var revealedSongIds = await db.Rounds
            .Where(r => r.GameId == game.Id && r.Status == RoundStatus.Revealed)
            .Select(r => r.SongId)
            .ToListAsync();
        if (revealedSongIds.Count == 0) return new();
        var songs = await db.Songs.Where(s => revealedSongIds.Contains(s.Id)).ToListAsync();
        return songs.OrderBy(valueOf).ToList();
    }
}
