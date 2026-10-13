import { GameSettings, Song } from '../types';

// Tags with numbers ("top 100" → placement, "billboard uger" → weeks at #1) from
// GET /api/ranked-tags, cached once like the catalog. The tag decides which songs are in
// the collection; the number lets it be played as a placement game (settings.rankTag),
// where the timeline is ordered by the number instead of the year. ValueScale hides
// that difference from the game logic and the UI.

export interface RankedTag {
  tag: string;
  description?: string | null;
  valuePrefix: string;
  valueSuffix: string;
  values: { songId: string; value: number }[]; // sorted by value; only songs with the tag
}

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

let rankedTags: RankedTag[] = [];

// Fetches the tags with numbers. Without a backend there are simply none.
export async function loadRankedTags(): Promise<RankedTag[]> {
  try {
    const res = await fetch(`${API_BASE}/api/ranked-tags`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    rankedTags = (await res.json()) as RankedTag[];
  } catch (err) {
    console.warn('Tags with numbers unavailable.', err);
  }
  return rankedTags;
}

export function getRankedTags(): RankedTag[] {
  return rankedTags;
}

export function getRankedTag(tag: string | undefined): RankedTag | undefined {
  return tag ? rankedTags.find((t) => t.tag === tag) : undefined;
}

export const formatRank = (t: Pick<RankedTag, 'valuePrefix' | 'valueSuffix'>, value: number) =>
  `${t.valuePrefix}${value}${t.valueSuffix}`;

// The songs (from `songs`, e.g. getActiveSongs()) that have a number in the tag.
export function songsWithRank(t: RankedTag, songs: Song[]): Song[] {
  const ids = new Set(t.values.map((v) => v.songId));
  return songs.filter((s) => ids.has(s.id));
}

// What the timeline is ordered by: the release year, or a tag's numbers.
export interface ValueScale {
  rankTag?: RankedTag;
  valueOf: (song: Song) => number;
  format: (value: number) => string; // "1987", "#12", "14 uger"
  min: number;
  max: number;
  // Numbers that actually occur (placement games), so the UI can tell whether a slot
  // between two cards can hold anything at all.
  values?: number[];
}

export const YEAR_SCALE: ValueScale = {
  valueOf: (s) => s.year,
  format: (v) => String(v),
  min: 1950,
  max: 2026,
};

export function scaleForRankTag(t: RankedTag | undefined): ValueScale {
  if (!t || t.values.length === 0) return YEAR_SCALE;
  const byId = new Map(t.values.map((v) => [v.songId, v.value]));
  const values = [...new Set(t.values.map((v) => v.value))].sort((a, b) => a - b);
  return {
    rankTag: t,
    valueOf: (s) => byId.get(s.id) ?? Number.NaN,
    format: (v) => formatRank(t, v),
    min: values[0],
    max: values[values.length - 1],
    values,
  };
}

export function scaleForSettings(settings: Pick<GameSettings, 'rankTag'>): ValueScale {
  return scaleForRankTag(getRankedTag(settings.rankTag));
}
