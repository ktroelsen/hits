// Song libraries: each is its own database on the server (own songs, tags, games,
// highscores and admin key), e.g. one per family. The chosen library is a cookie, so
// every API request and the SignalR hub carry it without extra headers. See
// server/Data/Libraries.cs.

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const COOKIE = 'hits_lib';
export const DEFAULT_LIBRARY = 'hits';

export interface LibraryInfo {
  id: string;
  name: string;
}

export function currentLibraryId(): string {
  const match = document.cookie.match(/(?:^|;\s*)hits_lib=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : DEFAULT_LIBRARY;
}

export function setLibrary(id: string): void {
  document.cookie = `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
}

// Switches library and reloads, so the catalog, tags and play session are fetched anew.
export function switchLibrary(id: string): void {
  setLibrary(id);
  window.location.reload();
}

// A link that opens in the current library (?lib=…), e.g. the join link for an online game.
export function withLibrary(url: string, id = currentLibraryId()): string {
  if (id === DEFAULT_LIBRARY) return url;
  return `${url}${url.includes('?') ? '&' : '?'}lib=${encodeURIComponent(id)}`;
}

// Applies ?lib=… from a shared link before anything is loaded, then tidies the URL.
export function applyLibraryFromUrl(): void {
  const url = new URL(window.location.href);
  const id = url.searchParams.get('lib');
  if (!id) return;
  setLibrary(id.toLowerCase());
  url.searchParams.delete('lib');
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

// The libraries to choose between. Null without a backend (only the default then).
export async function fetchLibraries(): Promise<{ current: string; libraries: LibraryInfo[] } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/libraries`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

// Which library an online game code belongs to (the chosen one is tried first).
export async function findGameLibrary(code: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/libraries/game/${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    return ((await res.json()) as { library: string }).library;
  } catch {
    return null;
  }
}
