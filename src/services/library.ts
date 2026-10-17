// Song libraries: each is its own database on the server (own songs, tags, games,
// highscores and admin key), e.g. one per family. The playground database can be chosen
// under Indstillinger; other libraries are chosen by opening the site with ?db=<id> (e.g.
// /?db=mol, back with ?db=hits). The choice is remembered in a cookie, so every API
// request, the SignalR hub and /admin use it.
// See server/Data/Libraries.cs.

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');
const COOKIE = 'hits_lib';
const PARAM = 'db';
export const DEFAULT_LIBRARY = 'hits';
export const PLAYGROUND_LIBRARY = 'playground';

export interface LibraryInfo {
  id: string;
  name: string;
}

export function currentLibraryId(): string {
  const match = document.cookie.match(/(?:^|;\s*)hits_lib=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : DEFAULT_LIBRARY;
}

function setLibrary(id: string): void {
  document.cookie =
    id === DEFAULT_LIBRARY
      ? `${COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${COOKIE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
}

// Switches database and reloads, so the catalog, tags and play session are fetched anew.
export function switchLibrary(id: string): void {
  setLibrary(id);
  window.location.reload();
}

// A link that opens in the current library (?db=…), e.g. the join link for an online game.
export function withLibrary(url: string, id = currentLibraryId()): string {
  if (id === DEFAULT_LIBRARY) return url;
  return `${url}${url.includes('?') ? '&' : '?'}${PARAM}=${encodeURIComponent(id)}`;
}

// Applies ?db=… before anything is loaded, then tidies the URL. An empty ?db= goes back
// to the default library.
export function applyLibraryFromUrl(): void {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(PARAM)) return;
  setLibrary(url.searchParams.get(PARAM)?.trim().toLowerCase() || DEFAULT_LIBRARY);
  url.searchParams.delete(PARAM);
  window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}

// The library this browser uses (id + display name). Null without a backend.
export async function fetchCurrentLibrary(): Promise<LibraryInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/api/libraries`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch {
    return null;
  }
}

// Which library an online game code belongs to (this browser's library is tried first).
export async function findGameLibrary(code: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/libraries/game/${encodeURIComponent(code)}`);
    if (!res.ok) return null;
    return ((await res.json()) as { library: string }).library;
  } catch {
    return null;
  }
}
