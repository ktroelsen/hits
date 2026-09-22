// Typed client for the online game API (issue 8). Same-origin in production; in dev
// Vite proxies /api/games to the .NET backend. See vite.config.ts.
import { useEffect, useRef, useState } from 'react';

export type GameStatus = 'lobby' | 'playing' | 'revealed' | 'finished';
export type RoundStatus = 'playing' | 'revealed';

export interface StatePlayer {
  id: string;
  name: string;
  color: string;
  score: number;
}

export interface TimelineSong {
  id: string;
  title: string;
  artist: string;
  year: number;
  artworkUrl?: string | null;
}

export interface RoundResult {
  playerId: string;
  insertIndex: number;
  guessedYear: number | null;
  placementCorrect: boolean;
  yearCorrect: boolean;
  points: number;
}

export interface RoundState {
  number: number;
  status: RoundStatus;
  audioUrl?: string | null;
  answeredPlayerIds: string[];
  correctIndex: number | null;
  song: (TimelineSong & { previewUrl?: string | null }) | null;
  results: RoundResult[];
}

export interface GameState {
  code: string;
  status: GameStatus;
  currentRound: number;
  targetRounds: number;
  players: StatePlayer[];
  timeline: TimelineSong[];
  round: RoundState | null;
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/games${path}`, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `HTTP ${res.status}`);
  }
  const text = await res.text();
  return (text ? JSON.parse(text) : {}) as T;
}

export const gameApi = {
  create: (targetRounds?: number) =>
    req<{ gameId: string; code: string }>('/', {
      method: 'POST',
      body: JSON.stringify({ targetRounds }),
    }),
  join: (code: string, name: string) =>
    req<{ id: string; name: string; color: string }>(`/${code}/join`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  start: (code: string) => req<void>(`/${code}/start`, { method: 'POST' }),
  answer: (code: string, playerId: string, insertIndex: number, guessedYear?: number) =>
    req<void>(`/${code}/answer`, {
      method: 'POST',
      body: JSON.stringify({ playerId, insertIndex, guessedYear }),
    }),
  reveal: (code: string) => req<void>(`/${code}/reveal`, { method: 'POST' }),
  next: (code: string) => req<{ finished: boolean }>(`/${code}/next`, { method: 'POST' }),
  state: (code: string) => req<GameState>(`/${code}`),
};

// Polls GET /api/games/{code} on an interval. Fase 3 will replace this with a
// SignalR subscription; components consume the same GameState either way.
export function useGameState(code: string | null, intervalMs = 1500) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const active = useRef(true);

  useEffect(() => {
    if (!code) return;
    active.current = true;
    let timer: number;
    const tick = async () => {
      try {
        const s = await gameApi.state(code);
        if (active.current) {
          setState(s);
          setError(null);
        }
      } catch (e) {
        if (active.current) setError((e as Error).message);
      } finally {
        if (active.current) timer = window.setTimeout(tick, intervalMs);
      }
    };
    tick();
    return () => {
      active.current = false;
      window.clearTimeout(timer);
    };
  }, [code, intervalMs]);

  return { state, error };
}
