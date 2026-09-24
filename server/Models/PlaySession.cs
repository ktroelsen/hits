namespace Hits.Api.Models;

// A browser's personal song order (identified by the hits_session cookie), so
// consecutive games on the same device don't repeat songs. Songs are drawn in
// OrderJson order, skipping played ones; when every catalog song has been played
// the order is reshuffled. Deleted after 2 hours without use.
public class PlaySession
{
    public string Id { get; set; } = default!;       // cookie value
    public string OrderJson { get; set; } = "[]";    // shuffled song ids (whole catalog)
    public string PlayedJson { get; set; } = "[]";   // ids played in the current pass
    public DateTime CreatedAt { get; set; }
    public DateTime LastSeenAt { get; set; }
}
