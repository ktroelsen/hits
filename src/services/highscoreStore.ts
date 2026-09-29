// Shared single-player (solo) highscore lists, stored in the backend database.
// The server returns an all-time list and a weekly list (resets Monday 00:00 Danish
// time). The player's last used name is remembered in this browser to prefill the form.

export interface HighscoreEntry {
  id: string;
  name: string;
  score: number;
  createdAt: string;
}

export interface HighscoreLists {
  allTime: HighscoreEntry[];
  weekly: HighscoreEntry[];
  weekStart: string;
}

// The best entry of each list; what the game screens show.
export interface BestScores {
  allTime: HighscoreEntry | null;
  weekly: HighscoreEntry | null;
}

// Which record a finished game beat (all-time implies weekly too).
export type RecordKind = 'allTime' | 'weekly' | null;

export function bestScores(lists: HighscoreLists | null): BestScores {
  return { allTime: lists?.allTime[0] ?? null, weekly: lists?.weekly[0] ?? null };
}

const EMPTY_LISTS: HighscoreLists = { allTime: [], weekly: [], weekStart: '' };

const NAME_KEY = 'hitster:soloName';
export const MAX_NAME_LENGTH = 20;

// Returns both top lists, best first. Empty on network/server errors.
export async function fetchHighscores(): Promise<HighscoreLists> {
  try {
    const res = await fetch('/api/highscores');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Kunne ikke hente highscores', err);
    return EMPTY_LISTS;
  }
}

// Saves a score and returns the updated top lists. Throws on failure.
export async function postHighscore(name: string, score: number): Promise<HighscoreLists> {
  const res = await fetch('/api/highscores', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, score }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}`);
  }
  saveName(name);
  return res.json();
}

export function getSavedName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // ignore write failures
  }
}
