namespace Hits.Api.Models;

// A finished single-player (solo) game, shared across all players.
public class SoloScore
{
    public Guid Id { get; set; }
    public string Name { get; set; } = default!;
    public int Score { get; set; }
    public DateTime CreatedAt { get; set; }
}
