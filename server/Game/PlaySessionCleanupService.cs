using Hits.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Gameplay;

// Deletes play sessions that haven't been used for PlaySessionStore.IdleLifetime.
// Runs at startup and then every 15 minutes.
public class PlaySessionCleanupService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<PlaySessionCleanupService> _logger;

    public PlaySessionCleanupService(IServiceScopeFactory scopes, ILogger<PlaySessionCleanupService> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                var cutoff = DateTime.UtcNow - PlaySessionStore.IdleLifetime;
                var deleted = await db.PlaySessions
                    .Where(s => s.LastSeenAt < cutoff)
                    .ExecuteDeleteAsync(stoppingToken);
                if (deleted > 0)
                    _logger.LogInformation("Deleted {Count} idle play sessions.", deleted);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogWarning(ex, "Play session cleanup failed.");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
