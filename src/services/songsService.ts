import { HITSTER_SONGS } from '../data/songs';
import { Song } from '../types';
import { getRemovedIds } from './removalStore';

// The full catalog minus songs the user marked as "missing music" this session.
// Use this everywhere songs are drawn into play so marked songs disappear
// immediately (and stay gone across reloads via localStorage).
export function getActiveSongs(): Song[] {
  const removed = getRemovedIds();
  if (removed.size === 0) return HITSTER_SONGS;
  return HITSTER_SONGS.filter((s) => !removed.has(s.id));
}
