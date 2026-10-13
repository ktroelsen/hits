namespace Hits.Api.Models;

// Mirrors the Song interface in src/types.ts so the frontend model is unchanged.
public class Song
{
    public string Id { get; set; } = default!;
    public string Title { get; set; } = default!;
    public string Artist { get; set; } = default!;
    public int Year { get; set; }
    // 'danish' | 'international'
    public string Category { get; set; } = default!;
    // '60s' | '70s' | '80s' | '90s' | '00s' | '10s' | '20s'
    public string Decade { get; set; } = default!;
    public string? Genre { get; set; }
    public string? FunFact { get; set; }
    public string? CustomPreviewUrl { get; set; }
    public string? PreviewUrl { get; set; }
    public string? ArtworkUrl { get; set; }
    // The iTunes track the preview belongs to, picked by hand in /admin when the search's first
    // hit was the wrong recording. The weekly preview refresh then looks up this track instead
    // of searching again. Null = use the iTunes search (first hit).
    public long? ITunesTrackId { get; set; }
    // Only active songs are dealt into games; inactive ones stay in the catalog (toggled in /admin).
    public bool Active { get; set; } = true;
    // Free-form, normalised (lowercase, trimmed) labels such as "dance" or "melodi grand prix".
    // Set in /admin or via the song import (scripts/songs.ps1); local games can filter on them.
    public List<string> Tags { get; set; } = new();
}
