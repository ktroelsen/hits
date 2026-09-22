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
}
