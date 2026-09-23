// Shared single-player (solo) highscore list, stored in the backend database.
// The player's last used name is remembered in this browser to prefill the form.

export interface HighscoreEntry {
  id: string;
  name: string;
  score: number;
  createdAt: string;
}

const NAME_KEY = 'hitster:soloName';
export const MAX_NAME_LENGTH = 20;

// Returns the top list, best first. Empty on network/server errors.
export async function fetchHighscores(): Promise<HighscoreEntry[]> {
  try {
    const res = await fetch('/api/highscores');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Kunne ikke hente highscores', err);
    return [];
  }
}

// Saves a score and returns the updated top list. Throws on failure.
export async function postHighscore(name: string, score: number): Promise<HighscoreEntry[]> {
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
