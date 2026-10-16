using Hits.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Gameplay;

// Deletes play sessions that haven't been used for PlaySessionStore.IdleLifetime.
// Runs at startup and then every 15 minutes, in every song library.
public class PlaySessionCleanupService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    private readonly IServiceScopeFactory _scopes;
    private readonly LibraryRegistry _libraries;
    private readonly ILogger<PlaySessionCleanupService> _logger;

    public PlaySessionCleanupService(IServiceScopeFactory scopes, LibraryRegistry libraries, ILogger<PlaySessionCleanupService> logger)
    {
        _scopes = scopes;
        _libraries = libraries;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            foreach (var library in _libraries.All)
            {
                try
                {
                    using var scope = _scopes.CreateLibraryScope(library);
                    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                    var cutoff = DateTime.UtcNow - PlaySessionStore.IdleLifetime;
                    var deleted = await db.PlaySessions
                        .Where(s => s.LastSeenAt < cutoff)
                        .ExecuteDeleteAsync(stoppingToken);
                    if (deleted > 0)
                        _logger.LogInformation("Deleted {Count} idle play sessions in library {Library}.", deleted, library.Id);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogWarning(ex, "Play session cleanup failed in library {Library}.", library.Id);
                }
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
