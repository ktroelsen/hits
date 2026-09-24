import { Song } from '../types';

// Per-browser song order so consecutive games don't repeat songs. The backend keeps a
// shuffled order of the whole catalog + the songs played so far, bound to an HttpOnly
// session cookie (see server/Game/PlaySessionStore.cs). We fetch it once into this
// module-level cache; draws are ordered by it and every song that comes into play is
// reported back. If the API is unreachable, songs are simply shuffled randomly.

const API_BASE = (import.meta.env.VITE_API_BASE ?? '').replace(/\/$/, '');

let orderIndex = new Map<string, number>();
let played = new Set<string>();

interface SessionResponse {
  order: string[];
  played: string[];
}

function apply(data: SessionResponse) {
  orderIndex = new Map(data.order.map((id, i) => [id, i]));
  played = new Set(data.played);
}

// Fetches (and creates, if needed) this browser's play session.
export async function loadPlaySession(): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/session/order`, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    apply(await res.json());
  } catch (err) {
    console.warn('Play session unavailable, using random song order.', err);
  }
}

// Orders songs for drawing: unplayed first in session order, then played ones (also
// in session order). Songs the session doesn't know yet go last, randomly.
export function orderSongs(songs: Song[]): Song[] {
  const rank = (s: Song) => {
    const i = orderIndex.get(s.id);
    if (i === undefined) return 2 * orderIndex.size + Math.random();
    return played.has(s.id) ? orderIndex.size + i : i;
  };
  return songs
    .map((s) => ({ s, r: rank(s) }))
    .sort((a, b) => a.r - b.r)
    .map(({ s }) => s);
}

// Marks songs as played (locally right away, then on the server). The server
// reshuffles once every song has been played; its reply refreshes the cache.
export function markPlayed(...songs: Song[]): void {
  const ids = songs.map((s) => s.id).filter((id) => !played.has(id));
  if (ids.length === 0) return;
  ids.forEach((id) => played.add(id));
  fetch(`${API_BASE}/api/session/played`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ songIds: ids }),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: SessionResponse | null) => data && apply(data))
    .catch(() => {
      // offline / no backend: the local cache still avoids repeats this visit
    });
}
