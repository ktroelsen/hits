import { HITSTER_SONGS } from '../data/songs';
import { GameSettings, Song } from '../types';
import { getRemovedIds } from './removalStore';

// The catalog now lives in the backend (SQLite, issue 10). We fetch it once at
// startup into this module-level cache; every synchronous consumer keeps working.
// If the API is unreachable, we fall back to the bundled songs.ts so the app still runs.
let catalog: Song[] = HITSTER_SONGS;
let loaded = false;

// API base: same-origin in production (frontend + API under one domain). In dev the
// Vite server runs on :3000 and the .NET API on :5099 — override via VITE_API_BASE.
const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

// Fetches the catalog from GET /api/songs once. Safe to call repeatedly (no-op after
// the first success). Returns true if the API load succeeded.
export async function loadCatalog(): Promise<boolean> {
  if (loaded) return true;
  try {
    const res = await fetch(`${API_BASE}/api/songs`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as Song[];
    if (Array.isArray(data) && data.length > 0) {
      catalog = data;
      loaded = true;
      return true;
    }
    return false;
  } catch (err) {
    console.warn('Catalog API unavailable, using bundled songs.ts fallback.', err);
    return false;
  }
}

// The songs marked active in /admin, minus songs the user marked as "missing music"
// this session. Use this everywhere songs are drawn into play so inactive and marked
// songs never come up (marks stay across reloads via localStorage).
export function getActiveSongs(): Song[] {
  const removed = getRemovedIds();
  return catalog.filter((s) => s.active !== false && !removed.has(s.id));
}

// The song collection every game (timeline, solo, DJ and online) uses by default. Other
// collections, e.g. "top 100", are picked as tags in the game setup.
export const DEFAULT_TAG = 'hitmix';

// Tags switched off in /admin → Tags (playlists being built, special occasions). They
// can't be picked in any game; their songs are unaffected.
let inactiveTags = new Set<string>();

// Fetches which tags are inactive (GET /api/tags). Without a backend all tags are active.
export async function loadTagSettings(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/tags`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { tag: string; active: boolean }[];
    inactiveTags = new Set(data.filter((t) => !t.active).map((t) => t.tag));
    knownTagsCache = null;
  } catch (err) {
    console.warn('Tag settings unavailable; all tags count as active.', err);
  }
}

export function isTagActive(tag: string): boolean {
  return !inactiveTags.has(tag);
}

// Active tags present on at least one active song, cached per loaded catalog.
let knownTagsCache: { key: Song[]; tags: Set<string> } | null = null;
export function getKnownTags(): Set<string> {
  if (knownTagsCache?.key !== catalog) {
    const tags = new Set(
      catalog.filter((s) => s.active !== false).flatMap((s) => s.tags ?? []).filter(isTagActive),
    );
    knownTagsCache = { key: catalog, tags };
  }
  return knownTagsCache.tags;
}

// The chosen tags that are active and that some active song actually has. Unknown and
// inactive tags are dropped, so a default like "hitmix" falls back to all songs until
// songs have been tagged (and with the bundled songs.ts fallback, which has no tags).
export function effectiveTags(tags: string[]): string[] {
  const known = getKnownTags();
  return tags.filter((t) => known.has(t));
}

// True if a song passes the game setup filters (category, decades and — when any are
// chosen — at least one of the selected tags).
export function matchesSettings(
  song: Song,
  settings: Pick<GameSettings, 'categoryFilter' | 'decades' | 'tags'>,
): boolean {
  const tags = effectiveTags(settings.tags);
  return (
    (settings.categoryFilter === 'all' || song.category === settings.categoryFilter) &&
    settings.decades.includes(song.decade) &&
    (tags.length === 0 || tags.some((t) => song.tags?.includes(t)))
  );
}
