// Persists the best single-player (solo) score in this browser.

const STORAGE_KEY = 'hitster:soloHighscore';

export function getHighscore(): number {
  try {
    const n = parseInt(localStorage.getItem(STORAGE_KEY) ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

// Stores `score` if it beats the saved highscore. Returns true on a new record.
export function submitScore(score: number): boolean {
  if (score <= getHighscore()) return false;
  try {
    localStorage.setItem(STORAGE_KEY, String(score));
  } catch {
    // ignore write failures
  }
  return true;
}
