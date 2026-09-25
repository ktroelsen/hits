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
                    readyPlayerIds = players.Where(p => p.ReadyForRound == round.Number).Select(p => p.Id).ToList(),
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

        return new
        {
            code = game.Code,
            status = game.Status,
            currentRound = game.CurrentRound,
            targetRounds = game.TargetRounds,
            playbackMode = game.PlaybackMode,
            players = players.Select(p => new { p.Id, p.Name, p.Color, p.Score }),
            timeline = timeline.Select(s => new { s.Id, s.Title, s.Artist, s.Year, s.ArtworkUrl }),
            round = roundDto,
        };
    }

    // The shared timeline = songs from already-revealed rounds, sorted ascending by year.
    public static async Task<List<Song>> BuildTimelineAsync(Game game, AppDbContext db)
    {
        var revealedSongIds = await db.Rounds
            .Where(r => r.GameId == game.Id && r.Status == RoundStatus.Revealed)
            .Select(r => r.SongId)
            .ToListAsync();
        if (revealedSongIds.Count == 0) return new();
        var songs = await db.Songs.Where(s => revealedSongIds.Contains(s.Id)).ToListAsync();
        return songs.OrderBy(s => s.Year).ToList();
    }
}
