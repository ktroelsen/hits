// Persists the set of song ids the user has marked as "missing music" so they
// stay hidden from play across reloads. This is only a browser-side collector:
// the permanent deletion from src/data/songs.ts is done by scripts/check-previews.ts.

const STORAGE_KEY = 'hitster:pendingRemoval';

export function getRemovedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return new Set(parsed.filter((x) => typeof x === 'string'));
  } catch {
    // ignore — private mode, cleared storage, etc.
  }
  return new Set();
}

function persist(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  } catch {
    // ignore write failures
  }
}

export function markRemoved(id: string): Set<string> {
  const ids = getRemovedIds();
  ids.add(id);
  persist(ids);
  return ids;
}

export function unmarkRemoved(id: string): Set<string> {
  const ids = getRemovedIds();
  ids.delete(id);
  persist(ids);
  return ids;
}

export function clearRemoved(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
