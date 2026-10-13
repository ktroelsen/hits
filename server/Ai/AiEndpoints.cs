using Hits.Api.Admin;
using Hits.Api.Catalog;
using Hits.Api.Data;

namespace Hits.Api.Ai;

// /admin → AI-assistent: start a research job, poll it, import the reviewed rows.
// Admin-key protected like the rest of /api/admin. See AiResearch.
public static class AiEndpoints
{
    public record ResearchRequest(string? Prompt);

    public static void MapAiEndpoints(this WebApplication app)
    {
        var ai = app.MapGroup("/api/admin/ai").AddEndpointFilter(AdminEndpoints.RequireAdminKey);

        ai.MapGet("/status", (AiResearch research) => Results.Ok(new { configured = research.IsConfigured }));

        ai.MapPost("/research", (ResearchRequest body, AiResearch research) =>
        {
            if (!research.IsConfigured)
                return Results.Json(new { error = "AI er ikke konfigureret på serveren (sæt Anthropic__ApiKey)." }, statusCode: 503);
            var prompt = body.Prompt?.Trim() ?? "";
            if (prompt.Length < 5) return Results.BadRequest(new { error = "Beskriv hvilke sange du vil have." });
            var job = research.Start(prompt);
            return Results.Ok(new { id = job.Id });
        });

        ai.MapGet("/research/{id}", async (string id, AiResearch research) =>
        {
            if (research.Get(id) is not { } job) return Results.NotFound();
            return Results.Ok(new
            {
                job.Id,
                job.Prompt,
                status = job.Status.ToString().ToLowerInvariant(),
                job.Error,
                seconds = (int)((job.FinishedAt ?? DateTime.UtcNow) - job.StartedAt).TotalSeconds,
                job.Searches,
                job.InputTokens,
                job.OutputTokens,
                proposal = await research.ReviewAsync(job),
            });
        });

        ai.MapPost("/apply", async (AiResearch.ApplyRequest body, AiResearch research, AppDbContext db, PreviewRefresher previews) =>
        {
            try { return Results.Ok(await research.ApplyAsync(body, db, previews)); }
            catch (ArgumentException ex) { return Results.BadRequest(new { error = ex.Message }); }
        });
    }
}
