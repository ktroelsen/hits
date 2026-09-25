namespace Hits.Api.Models;

// Online game entities (issue 8). A game is a simultaneous, Kahoot-style round loop:
// each round one song plays on the main screen, all joined players place it on ONE
// shared timeline and guess its year at the same time, then the host reveals.

public static class GameStatus
{
    public const string Lobby = "lobby";       // players joining, not started
    public const string Playing = "playing";   // a song is playing, awaiting answers
    public const string Revealed = "revealed"; // current round revealed, scores updated
    public const string Finished = "finished"; // target rounds reached
}

public static class RoundStatus
{
    public const string Playing = "playing";
    public const string Revealed = "revealed";
}

public static class GamePlaybackMode
{
    public const string Shared = "shared";         // one shared speaker (the host's screen)
    public const string Individual = "individual"; // each player plays the preview on their own device
}

public class Game
{
    public string Id { get; set; } = default!;
    public string Code { get; set; } = default!;         // 4-digit join code
    public string Status { get; set; } = GameStatus.Lobby;
    public DateTime CreatedAt { get; set; }
    public int CurrentRound { get; set; }                // 0 until the first round starts
    public int TargetRounds { get; set; } = 10;          // game ends after this many rounds
    // Shuffled song ids for the whole game + how far we've drawn.
    public string DeckJson { get; set; } = "[]";
    public int DeckPosition { get; set; }
    // The host's play session: round songs are marked played there (see PlaySessionStore).
    public string? HostSessionId { get; set; }
    // "shared" (host's speaker, default) or "individual" (each player plays locally).
    public string PlaybackMode { get; set; } = GamePlaybackMode.Shared;
    // Scoring knobs (issue 8: placement + year bonus, no time factor yet).
    public int PointsPlacement { get; set; } = 1;
    public int PointsYearBonus { get; set; } = 1;

    public List<Player> Players { get; set; } = new();
    public List<Round> Rounds { get; set; } = new();
}

public class Player
{
    public string Id { get; set; } = default!;
    public string GameId { get; set; } = default!;
    public string Name { get; set; } = default!;
    public string Color { get; set; } = default!;
    public int Score { get; set; }
    // Last round this player pressed "Videre" on (individual mode: all ready → next round).
    public int ReadyForRound { get; set; }
    public DateTime JoinedAt { get; set; }
}

public class Round
{
    public string Id { get; set; } = default!;
    public string GameId { get; set; } = default!;
    public int Number { get; set; }
    public string SongId { get; set; } = default!;
    public string Status { get; set; } = RoundStatus.Playing;
    public DateTime StartedAt { get; set; }
    // The correct insertion index into the shared timeline, computed at reveal.
    public int? CorrectIndex { get; set; }

    public List<Answer> Answers { get; set; } = new();
}

public class Answer
{
    public string Id { get; set; } = default!;
    public string GameId { get; set; } = default!;
    public string RoundId { get; set; } = default!;
    public string PlayerId { get; set; } = default!;
    public int InsertIndex { get; set; }
    public int? GuessedYear { get; set; }
    public bool PlacementCorrect { get; set; }
    public bool YearCorrect { get; set; }
    public int Points { get; set; }
    public DateTime SubmittedAt { get; set; }
}
