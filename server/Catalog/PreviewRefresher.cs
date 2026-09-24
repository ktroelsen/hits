using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Hits.Api.Data;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Catalog;

// Keeps the catalog's iTunes preview/artwork URLs alive in the database. Apple's preview
// URLs expire over time and the DB is only seeded once, so the server periodically checks
// each song's previewUrl against Apple's CDN and re-resolves dead ones via the iTunes
// Search API. It never clears a URL: songs that can't be resolved are left untouched.
public sealed partial class PreviewRefresher(
    IHttpClientFactory httpFactory, IServiceScopeFactory scopes, IWebHostEnvironment env, ILogger<PreviewRefresher> logger)
{
    // Same pacing as scripts/check-previews.ts: iTunes Search allows ~20 req/min per IP,
    // and a 403/429 means "wait out the per-minute window", not "no preview".
    static readonly TimeSpan SearchDelay = TimeSpan.FromSeconds(4);
    static readonly TimeSpan ThrottleCooldown = TimeSpan.FromSeconds(60);
    const int MaxRetries = 3;

    public static readonly TimeSpan RunInterval = TimeSpan.FromDays(7);

    public enum Outcome { Found, NotFound, Unknown }
    public record Resolved(Outcome Outcome, string? PreviewUrl = null, string? ArtworkUrl = null);

    public record Status(
        bool Running, DateTimeOffset? StartedAt, DateTimeOffset? FinishedAt,
        int Checked, int Refreshed, int Missing, int Skipped, DateTimeOffset? LastCompletedAt);

    readonly SemaphoreSlim _runLock = new(1, 1);
    HttpClient Http => httpFactory.CreateClient(nameof(PreviewRefresher));
    readonly object _statusLock = new();
    Status? _status;

    public Status GetStatus()
    {
        lock (_statusLock)
            return _status ?? new Status(false, null, null, 0, 0, 0, 0, LoadLastCompleted());
    }

    public bool IsDue() =>
        LoadLastCompleted() is not { } last || DateTimeOffset.UtcNow - last >= RunInterval;

    // Starts a full run in the background. Returns false if one is already running.
    public bool TryStartRun()
    {
        if (!_runLock.Wait(0)) return false;
        // Report "running" before returning so the caller's response already reflects it.
        SetStatus(new Status(true, DateTimeOffset.UtcNow, null, 0, 0, 0, 0, LoadLastCompleted()));
        _ = Task.Run(async () =>
        {
            try { await RunCoreAsync(CancellationToken.None); }
            catch (Exception ex) { logger.LogError(ex, "Preview refresh failed."); }
            finally { _runLock.Release(); }
        });
        return true;
    }

    // Runs a full pass and waits for it (used by the background job). No-op if already running.
    public async Task RunAsync(CancellationToken ct)
    {
        if (!await _runLock.WaitAsync(0, ct)) return;
        try { await RunCoreAsync(ct); }
        finally { _runLock.Release(); }
    }

    async Task RunCoreAsync(CancellationToken ct)
    {
        var started = DateTimeOffset.UtcNow;
        int checkedCount = 0, refreshed = 0, missing = 0, skipped = 0;
        void Publish(bool running, DateTimeOffset? finished) =>
            SetStatus(new Status(running, started, finished, checkedCount, refreshed, missing, skipped, LoadLastCompleted()));
        Publish(true, null);
        logger.LogInformation("Preview refresh started.");

        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var songs = await db.Songs.ToListAsync(ct);

        foreach (var song in songs)
        {
            ct.ThrowIfCancellationRequested();
            checkedCount++;

            // A hand-set custom preview wins over iTunes; nothing to maintain.
            if (!string.IsNullOrWhiteSpace(song.CustomPreviewUrl)) { skipped++; Publish(true, null); continue; }

            if (!string.IsNullOrWhiteSpace(song.PreviewUrl))
            {
                var alive = await IsAliveAsync(song.PreviewUrl, ct);
                if (alive != false) { Publish(true, null); continue; } // alive, or unknown → leave it
            }

            var result = await ResolveAsync(song.Artist, song.Title, ct);
            switch (result.Outcome)
            {
                case Outcome.Found:
                    Apply(song, result);
                    await db.SaveChangesAsync(ct);
                    refreshed++;
                    logger.LogInformation("Refreshed preview for {Id} {Artist} – {Title}.", song.Id, song.Artist, song.Title);
                    break;
                case Outcome.NotFound:
                    missing++;
                    logger.LogWarning("No iTunes preview for {Id} {Artist} – {Title}; left unchanged.", song.Id, song.Artist, song.Title);
                    break;
                default:
                    skipped++;
                    logger.LogWarning("Could not verify {Id} {Artist} – {Title} (throttled/network); left unchanged.", song.Id, song.Artist, song.Title);
                    break;
            }
            Publish(true, null);
            await Task.Delay(SearchDelay, ct);
        }

        var finished = DateTimeOffset.UtcNow;
        await SaveLastCompletedAsync(finished);
        Publish(false, finished);
        logger.LogInformation(
            "Preview refresh done: {Checked} checked, {Refreshed} refreshed, {Missing} missing, {Skipped} skipped.",
            checkedCount, refreshed, missing, skipped);
    }

    // Re-resolves a single song right away (admin "Forny" button), dead link or not.
    public async Task<(Song? Song, Outcome Outcome)> RefreshSongAsync(AppDbContext db, string id, CancellationToken ct)
    {
        var song = await db.Songs.FindAsync([id], ct);
        if (song is null) return (null, Outcome.NotFound);
        var result = await ResolveAsync(song.Artist, song.Title, ct, retry: false);
        if (result.Outcome == Outcome.Found)
        {
            Apply(song, result);
            await db.SaveChangesAsync(ct);
        }
        return (song, result.Outcome);
    }

    static void Apply(Song song, Resolved result)
    {
        song.PreviewUrl = result.PreviewUrl;
        if (result.ArtworkUrl is not null) song.ArtworkUrl = result.ArtworkUrl;
    }

    // Port of buildItunesSearchUrl in src/services/audioService.ts — keep them identical.
    public static string BuildSearchUrl(string artist, string title)
    {
        var cleanArtist = FeatRegex().Replace(artist, "").Replace("'", "").Trim();
        var cleanTitle = FeatRegex().Replace(ParensRegex().Replace(title, ""), "").Replace("'", "").Trim();
        var term = $"{cleanArtist} {cleanTitle}";
        return $"https://itunes.apple.com/search?term={Uri.EscapeDataString(term)}&entity=song&limit=3";
    }

    [GeneratedRegex(@"ft\..*$", RegexOptions.IgnoreCase)]
    private static partial Regex FeatRegex();

    [GeneratedRegex(@"\(.*?\)")]
    private static partial Regex ParensRegex();

    async Task<Resolved> ResolveAsync(string artist, string title, CancellationToken ct, bool retry = true)
    {
        for (var attempt = 0; attempt <= (retry ? MaxRetries : 0); attempt++)
        {
            try
            {
                using var res = await Http.GetAsync(BuildSearchUrl(artist, title), ct);
                if (res.StatusCode is HttpStatusCode.Forbidden or HttpStatusCode.TooManyRequests)
                {
                    if (!retry) return new(Outcome.Unknown);
                    logger.LogWarning("iTunes rate limit hit; waiting {Seconds}s.", ThrottleCooldown.TotalSeconds);
                    await Task.Delay(ThrottleCooldown, ct);
                    continue;
                }
                if (!res.IsSuccessStatusCode) return new(Outcome.Unknown);

                // iTunes answers with text/javascript, so parse the stream directly.
                await using var body = await res.Content.ReadAsStreamAsync(ct);
                using var json = await JsonDocument.ParseAsync(body, cancellationToken: ct);
                if (!json.RootElement.TryGetProperty("results", out var results) || results.GetArrayLength() == 0)
                    return new(Outcome.NotFound);

                var match = results[0];
                var preview = match.TryGetProperty("previewUrl", out var p) ? p.GetString() : null;
                if (string.IsNullOrWhiteSpace(preview)) return new(Outcome.NotFound);
                var artwork = match.TryGetProperty("artworkUrl100", out var a) ? a.GetString() : null;
                artwork = artwork?.Replace("100x100bb", "600x600bb");
                return new(Outcome.Found, preview, artwork);
            }
            catch (Exception ex) when (ex is HttpRequestException or JsonException or TaskCanceledException && !ct.IsCancellationRequested)
            {
                if (!retry) return new(Outcome.Unknown);
                await Task.Delay(SearchDelay * (attempt + 2), ct);
            }
        }
        return new(Outcome.Unknown);
    }

    // true = alive, false = definitely dead (4xx), null = unknown (5xx/network).
    async Task<bool?> IsAliveAsync(string url, CancellationToken ct)
    {
        try
        {
            using var head = await Http.SendAsync(new HttpRequestMessage(HttpMethod.Head, url), ct);
            var status = head.StatusCode;
            if (status == HttpStatusCode.MethodNotAllowed)
            {
                var get = new HttpRequestMessage(HttpMethod.Get, url);
                get.Headers.Range = new System.Net.Http.Headers.RangeHeaderValue(0, 0);
                using var res = await Http.SendAsync(get, HttpCompletionOption.ResponseHeadersRead, ct);
                status = res.StatusCode;
            }
            var code = (int)status;
            if (code is >= 200 and < 400) return true;
            if (code is >= 400 and < 500) return false;
            return null;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException && !ct.IsCancellationRequested)
        {
            return null;
        }
    }

    void SetStatus(Status status)
    {
        lock (_statusLock) _status = status;
    }

    // Last completed run lives in App_Data so it survives app-pool recycles and redeploys.
    string StatePath => Path.Combine(env.ContentRootPath, "App_Data", "preview-refresh.json");

    record State(DateTimeOffset LastCompletedAt);

    DateTimeOffset? LoadLastCompleted()
    {
        try
        {
            return File.Exists(StatePath)
                ? JsonSerializer.Deserialize<State>(File.ReadAllText(StatePath))?.LastCompletedAt
                : null;
        }
        catch { return null; }
    }

    async Task SaveLastCompletedAsync(DateTimeOffset at)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(StatePath)!);
        await File.WriteAllTextAsync(StatePath, JsonSerializer.Serialize(new State(at)));
    }
}

// Runs the refresh when it's due. IIS may idle the app pool, so rather than a fixed weekly
// timer we check shortly after startup and then every few hours whether a week has passed.
public sealed class PreviewRefreshJob(PreviewRefresher refresher, ILogger<PreviewRefreshJob> logger) : BackgroundService
{
    static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(1);
    static readonly TimeSpan CheckInterval = TimeSpan.FromHours(6);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await Task.Delay(StartupDelay, stoppingToken);
            while (!stoppingToken.IsCancellationRequested)
            {
                if (refresher.IsDue())
                {
                    try { await refresher.RunAsync(stoppingToken); }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        logger.LogError(ex, "Scheduled preview refresh failed.");
                    }
                }
                else
                {
                    logger.LogInformation("Preview refresh not due yet (last run {Last}).", refresher.GetStatus().LastCompletedAt);
                }
                await Task.Delay(CheckInterval, stoppingToken);
            }
        }
        catch (OperationCanceledException) { }
    }
}
