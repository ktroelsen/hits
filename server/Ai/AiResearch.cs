using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using Anthropic;
using Anthropic.Models.Beta.Messages;
using Hits.Api.Admin;
using Hits.Api.Catalog;
using Hits.Api.Data;
using Hits.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace Hits.Api.Ai;

// AI assistant in /admin: the admin describes a song collection ("Billboard: flest uger
// som nr. 1, top 50") and Claude researches it on the web and returns the songs with
// their numbers as structured JSON. Research takes minutes, so it runs as a background
// job the page polls. Nothing is written to the catalog until the admin reviews the
// proposal and imports the rows they keep (ApplyAsync).
//
// Needs an Anthropic API key: config "Anthropic:ApiKey" (env Anthropic__ApiKey) or the
// ANTHROPIC_API_KEY environment variable.
public sealed class AiResearch(IConfiguration config, IServiceScopeFactory scopes, ILogger<AiResearch> logger)
{
    const string Model = "claude-opus-5-5";
    // Each search is a step in the server-side loop, which pauses after 10 steps
    // (stop_reason "pause_turn"); staying below that keeps it to one request.
    const int MaxSearches = 8;

    readonly ConcurrentDictionary<string, Job> _jobs = new();

    public enum JobStatus { Running, Done, Failed }

    public sealed class Job
    {
        public string Id { get; init; } = default!;
        public string Prompt { get; init; } = default!;
        public JobStatus Status { get; set; } = JobStatus.Running;
        public DateTime StartedAt { get; init; }
        public DateTime? FinishedAt { get; set; }
        public string? Error { get; set; }
        public Proposal? Result { get; set; }
        // Year lookup for a Spotify playlist (StartYears): the playlist and Claude's answer.
        public Spotify.SpotifyPlaylist.Playlist? Playlist { get; init; }
        public List<YearItem>? Years { get; set; }
        public long InputTokens { get; set; }
        public long OutputTokens { get; set; }
        public long Searches { get; set; }
    }

    // The JSON Claude returns (see Schema).
    public record Proposal(string Tag, string Description, string ValuePrefix, string ValueSuffix, List<ProposalItem> Items, string Notes);
    public record ProposalItem(int Value, string Title, string Artist, int Year, string Category, string Source, bool Uncertain, string Note);

    // The JSON Claude returns for a year lookup (see YearsSchema). Index = the track's position in the playlist.
    public record YearsAnswer(List<YearItem> Items);
    public record YearItem(int Index, int Year, string Category, bool Uncertain, string Note);

    public bool IsConfigured => ApiKey() is not null;

    string? ApiKey() =>
        AdminEndpoints.Blank(config["Anthropic:ApiKey"]) ?? AdminEndpoints.Blank(Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY"));

    public Job Start(string prompt)
    {
        var job = Add(new Job { Id = Guid.NewGuid().ToString("n"), Prompt = prompt, StartedAt = DateTime.UtcNow });
        _ = Task.Run(() => RunAsync(job, SystemPrompt, prompt, Schema(), text =>
        {
            var proposal = JsonSerializer.Deserialize<Proposal>(text, JsonOpts)
                ?? throw new InvalidOperationException("Tomt svar fra AI.");
            job.Result = proposal with { Tag = AdminEndpoints.NormalizeTags([proposal.Tag]).FirstOrDefault() ?? "" };
        }));
        return job;
    }

    // Looks up the original release year (and category) of every track in a Spotify
    // playlist — the embed page has no years. Without an API key the job finishes at once
    // with no years, and the admin fills them in by hand.
    public Job StartYears(Spotify.SpotifyPlaylist.Playlist playlist)
    {
        var job = Add(new Job
        {
            Id = Guid.NewGuid().ToString("n"),
            Prompt = playlist.Name,
            Playlist = playlist,
            StartedAt = DateTime.UtcNow,
        });
        if (!IsConfigured)
        {
            job.Years = [];
            job.Status = JobStatus.Done;
            job.FinishedAt = DateTime.UtcNow;
            return job;
        }
        var list = string.Join('\n', playlist.Tracks.Select((t, i) => $"{i}. {t.Artist} – {t.Title}"));
        _ = Task.Run(() => RunAsync(job, YearsSystemPrompt, $"Playlist \"{playlist.Name}\":\n{list}", YearsSchema(), text =>
        {
            var answer = JsonSerializer.Deserialize<YearsAnswer>(text, JsonOpts)
                ?? throw new InvalidOperationException("Tomt svar fra AI.");
            job.Years = answer.Items;
        }));
        return job;
    }

    Job Add(Job job)
    {
        _jobs[job.Id] = job;
        // Old jobs only matter while someone reviews them.
        foreach (var old in _jobs.Values.Where(j => j.StartedAt < DateTime.UtcNow.AddDays(-1)))
            _jobs.TryRemove(old.Id, out _);
        return job;
    }

    public Job? Get(string id) => _jobs.GetValueOrDefault(id);

    // Runs one structured-output request with web search and hands the JSON answer to onResult.
    async Task RunAsync(Job job, string system, string message, Dictionary<string, JsonElement> schema, Action<string> onResult)
    {
        try
        {
            var client = new AnthropicClient { ApiKey = ApiKey()! };
            var parameters = new MessageCreateParams
            {
                Model = Model,
                MaxTokens = 64000,
                Betas = ["server-side-fallback-2026-06-01"],
                Fallbacks = new BetaFallbacksParam(new List<BetaFallbackParam> { new() { Model = "claude-opus-4-8" } }), // a refused request is re-run on this model
                Thinking = new BetaThinkingConfigAdaptive(),
                OutputConfig = new BetaOutputConfig
                {
                    Effort = Effort.High,
                    Format = new BetaJsonOutputFormat { Schema = schema },
                },
                Tools = [new BetaToolUnion(new BetaWebSearchTool20260209 { MaxUses = MaxSearches })],
                System = system,
                Messages = [new() { Role = Role.User, Content = message }],
            };

            // Streamed so the long research turn never hits an HTTP timeout. With
            // structured output the answer is the last text block.
            var text = new StringBuilder();
            string? stopReason = null;
            await foreach (var ev in client.Beta.Messages.CreateStreaming(parameters))
            {
                if (ev.TryPickContentBlockStart(out _))
                    text.Clear(); // only the last block (the JSON answer) counts
                else if (ev.TryPickContentBlockDelta(out var delta) && delta.Delta.TryPickText(out var t))
                    text.Append(t.Text);
                else if (ev.TryPickStart(out var msgStart))
                    job.InputTokens += msgStart.Message.Usage.InputTokens;
                else if (ev.TryPickDelta(out var msgDelta))
                {
                    stopReason = msgDelta.Delta.StopReason?.Raw();
                    job.OutputTokens = msgDelta.Usage.OutputTokens;
                    job.Searches = msgDelta.Usage.ServerToolUse?.WebSearchRequests ?? job.Searches;
                }
            }

            if (stopReason == "refusal") throw new InvalidOperationException("AI'en afviste opgaven.");
            if (stopReason == "max_tokens") throw new InvalidOperationException("Svaret blev for langt. Bed om færre sange.");
            if (stopReason == "pause_turn") throw new InvalidOperationException("Researchen tog for mange skridt. Prøv en mere præcis beskrivelse.");

            onResult(text.ToString());
            job.Status = JobStatus.Done;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AI research failed");
            job.Error = ex.Message;
            job.Status = JobStatus.Failed;
        }
        finally
        {
            job.FinishedAt = DateTime.UtcNow;
        }
    }

    // A job's proposal, each row matched against the catalog (same loose matching as the
    // bulk import), for the review table.
    public async Task<object?> ReviewAsync(Job job)
    {
        if (job.Result is not { } p) return null;
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var catalog = await db.Songs.AsNoTracking().ToListAsync();
        var ranked = await db.RankedTags.AsNoTracking().FirstOrDefaultAsync(t => t.Tag == p.Tag);
        return new
        {
            p.Tag,
            p.Description,
            p.ValuePrefix,
            p.ValueSuffix,
            p.Notes,
            tagExists = catalog.Any(s => s.Tags.Contains(p.Tag)),
            tagHasNumbers = ranked is not null,
            items = p.Items.Select(i =>
            {
                var match = AdminEndpoints.FindInCatalogLoose(catalog, i.Artist, i.Title);
                return new
                {
                    i.Value, i.Title, i.Artist, i.Year, i.Category, i.Source, i.Uncertain, i.Note,
                    existing = match is null ? null : new { match.Id, match.Title, match.Artist, match.Year, match.Active, match.Tags },
                };
            }),
        };
    }

    public record ApplyItem(int Value, string? Title, string? Artist, int Year, string? Category, string? ExistingId);
    public record ApplyRequest(string? Tag, string? Description, string? ValuePrefix, string? ValueSuffix, List<ApplyItem>? Items);

    // Imports the reviewed rows: makes the tag a tag with numbers (if it isn't), gives
    // existing songs the tag and number, and creates the rest as inactive songs — the
    // admin listens to them in Katalog before activating them. Previews and
    // covers for new songs are looked up on iTunes afterwards.
    public async Task<object> ApplyAsync(ApplyRequest body, AppDbContext db, PreviewRefresher previews)
    {
        var tag = AdminEndpoints.NormalizeTags([body.Tag]).FirstOrDefault()
            ?? throw new ArgumentException("tag er påkrævet.");
        // A brand-new collection starts inactive: the admin listens through the new songs
        // and activates the tag (in /admin → Tags) when the playlist is ready.
        var newTag = await db.RankedTags.FindAsync(tag) is null && await Tags.TagEndpoints.IsNewTagAsync(db, tag);
        if (newTag) await Tags.TagEndpoints.SetActiveAsync(db, tag, false);
        if (await db.RankedTags.FindAsync(tag) is null)
            db.RankedTags.Add(new RankedTag
            {
                Tag = tag,
                Description = AdminEndpoints.Blank(body.Description),
                ValuePrefix = body.ValuePrefix ?? "",
                ValueSuffix = body.ValueSuffix ?? "",
                CreatedAt = DateTime.UtcNow,
            });
        await db.SaveChangesAsync();

        var catalog = await db.Songs.ToListAsync(); // tracked: songs get tags and numbers
        int updated = 0;
        var createdIds = new List<string>();
        foreach (var item in body.Items ?? [])
        {
            var row = new SongImport.Row(item.Title, item.Artist, item.Year, item.Category, item.ExistingId);
            if (SongImport.FindOrCreate(db, catalog, row, out var created) is not { } song) continue;
            if (created) createdIds.Add(song.Id);
            else updated++;
            await Tags.RankedTagEndpoints.SetValueAsync(db, tag, song, item.Value);
        }
        await db.SaveChangesAsync();

        // Preview + cover for the new songs (iTunes), in the background.
        previews.RefreshSongsInBackground(createdIds);

        return new { tag, updated, created = createdIds.Count, inactive = newTag };
    }

    static readonly JsonSerializerOptions JsonOpts = new() { PropertyNameCaseInsensitive = true };

    const string SystemPrompt = """
        You research song collections for HITS, a Danish music quiz where players place songs on a
        timeline. The admin describes a collection, e.g. "DR's top 100 over Danmarks bedste sange" or
        "Billboard Hot 100: sange med flest uger som nr. 1, top 50". Find the actual list with web search
        and return every song in it with its number.

        - value: the number the collection ranks songs by — the placement (1, 2, 3 …) or the count the
          admin asks about (e.g. weeks at number one). Ties are allowed when the source has them.
        - year: the year the recording was first released (not a re-release or the year it charted
          later). If sources disagree or you are unsure, give your best year and set uncertain = true.
        - category: "danish" for Danish artists, otherwise "international".
        - title and artist: the common spelling, without "(Remastered)" and similar suffixes.
        - source: the URL you took the song's number from.
        - note: short, in Danish, only when something needs checking (empty string otherwise).
        - tag: a short lowercase name for the collection, e.g. "billboard uger" or "top 100".
        - valuePrefix / valueSuffix: how the number reads, "#" + "" for placements, "" + " uger" for weeks.
        - description: one line in Danish describing the collection and its source.
        - notes: in Danish, anything the admin should know (e.g. the list was cut short); empty otherwise.

        Prefer the primary source (the chart's or broadcaster's own site). Never invent songs or
        numbers; if you can only verify part of the list, return that part and say so in notes.
        If the admin asks for a number of songs, return that many (when the source has them).
        """;

    const string YearsSystemPrompt = """
        You date songs for HITS, a Danish music quiz where players place songs on a timeline by
        year. You get a numbered Spotify playlist ("index. artists – title"). For every line return:

        - index: the line's number, unchanged. Return every line exactly once.
        - year: the year the song was first released. Spotify often lists a remaster, a compilation
          or a later live version; give the original release year of the song, not of that album.
          If you are unsure, give your best year and set uncertain = true.
        - category: "danish" for Danish artists, otherwise "international".
        - uncertain: true when the year needs checking.
        - note: short, in Danish, only when something needs checking (e.g. "Cover af …, originalen
          er fra 1975"); empty string otherwise.

        Use web search only for songs you cannot date confidently.
        """;

    static Dictionary<string, JsonElement> YearsSchema() => ToSchema(new
    {
        type = "object",
        additionalProperties = false,
        required = new[] { "items" },
        properties = new
        {
            items = new
            {
                type = "array",
                items = new
                {
                    type = "object",
                    additionalProperties = false,
                    required = new[] { "index", "year", "category", "uncertain", "note" },
                    properties = new
                    {
                        index = new { type = "integer" },
                        year = new { type = "integer" },
                        category = new { type = "string", @enum = new[] { "danish", "international" } },
                        uncertain = new { type = "boolean" },
                        note = new { type = "string" },
                    },
                },
            },
        },
    });

    static Dictionary<string, JsonElement> ToSchema(object schema) =>
        JsonSerializer.SerializeToElement(schema).EnumerateObject().ToDictionary(p => p.Name, p => p.Value.Clone());

    static Dictionary<string, JsonElement> Schema()
    {
        var str = new { type = "string" };
        var schema = new
        {
            type = "object",
            additionalProperties = false,
            required = new[] { "tag", "description", "valuePrefix", "valueSuffix", "items", "notes" },
            properties = new
            {
                tag = str,
                description = str,
                valuePrefix = str,
                valueSuffix = str,
                notes = str,
                items = new
                {
                    type = "array",
                    items = new
                    {
                        type = "object",
                        additionalProperties = false,
                        required = new[] { "value", "title", "artist", "year", "category", "source", "uncertain", "note" },
                        properties = new
                        {
                            value = new { type = "integer" },
                            title = str,
                            artist = str,
                            year = new { type = "integer" },
                            category = new { type = "string", @enum = new[] { "danish", "international" } },
                            source = str,
                            uncertain = new { type = "boolean" },
                            note = str,
                        },
                    },
                },
            },
        };
        return ToSchema(schema);
    }
}
