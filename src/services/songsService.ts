import { HITSTER_SONGS } from '../data/songs';
import { Song } from '../types';
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
