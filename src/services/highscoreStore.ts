// Persists the best single-player (solo) score (and the name of whoever set it) in this browser.

const STORAGE_KEY = 'hitster:soloHighscore';
const NAME_STORAGE_KEY = 'hitster:soloHighscoreName';
const MAX_NAME_LENGTH = 20;

export function getHighscore(): number {
  try {
    const n = parseInt(localStorage.getItem(STORAGE_KEY) ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function getHighscoreName(): string {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

// Stores `score` if it beats the saved highscore. Clears the previous record holder's
// name since the new record hasn't been claimed yet. Returns true on a new record.
export function submitScore(score: number): boolean {
  if (score <= getHighscore()) return false;
  try {
    localStorage.setItem(STORAGE_KEY, String(score));
    localStorage.removeItem(NAME_STORAGE_KEY);
  } catch {
    // ignore write failures
  }
  return true;
}

// Attaches a name to the current highscore, e.g. after a new record is set.
export function saveHighscoreName(name: string): void {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) return;
  try {
    localStorage.setItem(NAME_STORAGE_KEY, trimmed);
  } catch {
    // ignore write failures
  }
}
