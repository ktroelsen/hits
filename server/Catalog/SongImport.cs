using Hits.Api.Admin;
using Hits.Api.Data;
using Hits.Api.Models;

namespace Hits.Api.Catalog;

// Shared by the imports that take reviewed rows from outside (AI-assistent, Spotify):
// a row is either a song already in the catalog or a new song, created inactive so the
// admin listens to it in Katalog before it is dealt into games.
public static class SongImport
{
    public record Row(string? Title, string? Artist, int Year, string? Category, string? ExistingId);

    // The row's song: the one picked in the review (ExistingId), else a loose catalog match,
    // else a new inactive song (added to db and catalog). Null when a new song would lack a
    // title, artist or plausible year. `catalog` must be tracked by `db`.
    public static Song? FindOrCreate(AppDbContext db, List<Song> catalog, Row row, out bool created)
    {
        created = false;
        var title = row.Title?.Trim() ?? "";
        var artist = row.Artist?.Trim() ?? "";
        var song = row.ExistingId is { } id ? catalog.FirstOrDefault(s => s.Id == id) : null;
        song ??= title != "" && artist != "" ? AdminEndpoints.FindInCatalogLoose(catalog, artist, title) : null;
        if (song is not null) return song;
        if (title == "" || artist == "" || row.Year is < 1900 or > 2100) return null;

        song = new Song
        {
            Id = Guid.NewGuid().ToString("n"),
            Title = title,
            Artist = artist,
            Year = row.Year,
            Category = row.Category == "danish" ? "danish" : "international",
            Decade = AdminEndpoints.DecadeForYear(row.Year),
            Active = false,
        };
        db.Songs.Add(song);
        catalog.Add(song);
        created = true;
        return song;
    }
}
