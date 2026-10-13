namespace Hits.Api.Models;

// A tag whose songs also have a number, e.g. "top 100" (placement on DR's list) or
// "billboard uger" (weeks at #1). The tag still decides which songs are in the
// collection — so it works in the normal year game like any tag — and the number lets
// the collection be played as a placement game, where the timeline is ordered by the
// number instead of the year. Managed in /admin → Tags med tal.
public class RankedTag
{
    public string Tag { get; set; } = default!;      // normalised tag, e.g. "top 100"
    public string? Description { get; set; }
    // Shown around the number: "#" + 12 = "#12", 14 + " uger" = "14 uger".
    public string ValuePrefix { get; set; } = "";
    public string ValueSuffix { get; set; } = "";
    public DateTime CreatedAt { get; set; }
}

// A song's number in a ranked tag. Only counts while the song has the tag. Numbers
// need not be unique (several songs can share a number of weeks at #1).
public class SongTagValue
{
    public string Tag { get; set; } = default!;
    public string SongId { get; set; } = default!;
    public int Value { get; set; }
}
