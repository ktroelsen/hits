using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Song> Songs => Set<Song>();
    public DbSet<Game> Games => Set<Game>();
    public DbSet<Player> Players => Set<Player>();
    public DbSet<Round> Rounds => Set<Round>();
    public DbSet<Answer> Answers => Set<Answer>();
    public DbSet<SoloScore> SoloScores => Set<SoloScore>();
    public DbSet<PlaySession> PlaySessions => Set<PlaySession>();
    public DbSet<RankedTag> RankedTags => Set<RankedTag>();
    public DbSet<SongTagValue> SongTagValues => Set<SongTagValue>();
    public DbSet<TagSetting> TagSettings => Set<TagSetting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Song>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Id).ValueGeneratedNever();
        });

        modelBuilder.Entity<Game>(e =>
        {
            e.HasKey(g => g.Id);
            e.Property(g => g.Id).ValueGeneratedNever();
            e.HasIndex(g => g.Code).IsUnique();
            e.HasMany(g => g.Players).WithOne().HasForeignKey(p => p.GameId).OnDelete(DeleteBehavior.Cascade);
            e.HasMany(g => g.Rounds).WithOne().HasForeignKey(r => r.GameId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Player>(e =>
        {
            e.HasKey(p => p.Id);
            e.Property(p => p.Id).ValueGeneratedNever();
        });

        modelBuilder.Entity<Round>(e =>
        {
            e.HasKey(r => r.Id);
            e.Property(r => r.Id).ValueGeneratedNever();
            e.HasMany(r => r.Answers).WithOne().HasForeignKey(a => a.RoundId).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Answer>(e =>
        {
            e.HasKey(a => a.Id);
            e.Property(a => a.Id).ValueGeneratedNever();
            // One answer per player per round.
            e.HasIndex(a => new { a.RoundId, a.PlayerId }).IsUnique();
        });

        modelBuilder.Entity<SoloScore>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Id).ValueGeneratedNever();
            e.Property(s => s.Name).HasMaxLength(20);
            e.HasIndex(s => s.Score);
        });

        modelBuilder.Entity<PlaySession>(e =>
        {
            e.HasKey(s => s.Id);
            e.Property(s => s.Id).ValueGeneratedNever();
            e.HasIndex(s => s.LastSeenAt);
        });

        modelBuilder.Entity<RankedTag>(e =>
        {
            e.HasKey(t => t.Tag);
            e.Property(t => t.Tag).ValueGeneratedNever();
            e.HasMany<SongTagValue>().WithOne().HasForeignKey(v => v.Tag).OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<TagSetting>(e =>
        {
            e.HasKey(t => t.Tag);
            e.Property(t => t.Tag).ValueGeneratedNever();
        });

        modelBuilder.Entity<SongTagValue>(e =>
        {
            e.HasKey(v => new { v.Tag, v.SongId });
            e.HasIndex(v => new { v.Tag, v.Value });
            e.HasOne<Song>().WithMany().HasForeignKey(v => v.SongId).OnDelete(DeleteBehavior.Cascade);
        });
    }
}
