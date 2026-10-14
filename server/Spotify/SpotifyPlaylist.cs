using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Hits.Api.Spotify;

// Reads the songs of a public Spotify playlist for the import in /admin → Spotify.
// Spotify's Web API only returns the items of playlists the app's user owns (Development
// Mode, since March 2026), so this reads the public embed page instead
// (open.spotify.com/embed/playlist/{id}). Its __NEXT_DATA__ JSON holds the playlist name
// and up to 100 tracks (title + artists, no year). No key needed; private playlists 404.
public sealed partial class SpotifyPlaylist(IHttpClientFactory httpFactory)
{
    // The embed page lists at most this many tracks.
    public const int EmbedLimit = 100;

    public record Track(string Title, string Artist);
    public record Playlist(string Id, string Name, List<Track> Tracks)
    {
        // A playlist with exactly the embed limit is most likely longer than what we got.
        public bool Truncated => Tracks.Count >= EmbedLimit;
    }

    [GeneratedRegex(@"(?:playlist[/:])([A-Za-z0-9]{22})")]
    private static partial Regex PlaylistIdInUrl();

    [GeneratedRegex(@"^[A-Za-z0-9]{22}$")]
    private static partial Regex BareId();

    [GeneratedRegex(@"<script id=""__NEXT_DATA__""[^>]*>(.*?)</script>", RegexOptions.Singleline)]
    private static partial Regex NextData();

    // "https://open.spotify.com/intl-da/playlist/{id}?si=…", "spotify:playlist:{id}" or the bare id.
    public static string? ParsePlaylistId(string? input)
    {
        input = input?.Trim() ?? "";
        if (BareId().IsMatch(input)) return input;
        return PlaylistIdInUrl().Match(input) is { Success: true } m ? m.Groups[1].Value : null;
    }

    public async Task<Playlist> FetchAsync(string id, CancellationToken ct = default)
    {
        using var res = await httpFactory.CreateClient(nameof(SpotifyPlaylist))
            .GetAsync($"https://open.spotify.com/embed/playlist/{id}", ct);
        if (res.StatusCode == HttpStatusCode.NotFound) throw NotPublic();
        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"Spotify svarede {(int)res.StatusCode}. Prøv igen om lidt.");

        var html = await res.Content.ReadAsStringAsync(ct);
        if (NextData().Match(html) is not { Success: true } m)
            throw new InvalidOperationException("Spotify-siden kunne ikke læses (formatet er måske ændret).");

        using var doc = JsonDocument.Parse(m.Groups[1].Value);
        var props = doc.RootElement.GetProperty("props").GetProperty("pageProps");
        // A missing or private playlist renders Spotify's "Page not found" page (status 404 in the JSON).
        if (!props.TryGetProperty("state", out var state)
            || !state.TryGetProperty("data", out var data)
            || !data.TryGetProperty("entity", out var entity)
            || !entity.TryGetProperty("trackList", out var trackList))
            throw NotPublic();

        var tracks = new List<Track>();
        foreach (var t in trackList.EnumerateArray())
        {
            // Podcast episodes can be in playlists too; only songs are imported.
            if (t.TryGetProperty("entityType", out var type) && type.GetString() != "track") continue;
            var title = t.TryGetProperty("title", out var ti) ? ti.GetString()?.Trim() : null;
            var artist = t.TryGetProperty("subtitle", out var su) ? Clean(su.GetString()) : null;
            if (string.IsNullOrEmpty(title) || string.IsNullOrEmpty(artist)) continue;
            tracks.Add(new Track(title, artist));
        }
        var name = entity.TryGetProperty("name", out var n) ? n.GetString()?.Trim() : null;
        return new Playlist(id, string.IsNullOrEmpty(name) ? "spotify" : name, tracks);
    }

    // Artists come comma-separated ("Shakira, Burna Boy"); normalise the spacing.
    static string? Clean(string? artists) =>
        artists is null ? null : string.Join(", ", artists.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries));

    static ArgumentException NotPublic() => new("Playlisten findes ikke eller er ikke offentlig.");
}
