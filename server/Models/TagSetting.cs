namespace Hits.Api.Models;

// Per-tag settings. An inactive tag can't be picked as a collection in any game (tag
// filter, placement game, online) — e.g. a playlist that is still being built or is only
// for a special occasion. Its songs are unaffected and the tag can still be edited in
// /admin. Tags without a row are active.
public class TagSetting
{
    public string Tag { get; set; } = default!;   // normalised tag
    public bool Active { get; set; } = true;
    public DateTime UpdatedAt { get; set; }
}
