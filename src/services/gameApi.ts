// Typed client for the online game API (issue 8). Same-origin in production; in dev
// Vite proxies /api/games and /gameHub to the .NET backend. See vite.config.ts.
import { useEffect, useRef, useState } from 'react';
import { HubConnectionBuilder, HubConnectionState } from '@microsoft/signalr';

export type GameStatus = 'lobby' | 'playing' | 'revealed' | 'finished';
export type RoundStatus = 'playing' | 'revealed';
export type PlaybackMode = 'shared' | 'individual';

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
  /** Players who pressed "Videre" after this round was revealed. */
  readyPlayerIds: string[];
  correctIndex: number | null;
  song: (TimelineSong & { previewUrl?: string | null }) | null;
  results: RoundResult[];
}

export interface GameState {
  code: string;
  status: GameStatus;
  currentRound: number;
  targetRounds: number;
  playbackMode: PlaybackMode;
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
  create: (targetRounds?: number, playbackMode?: PlaybackMode) =>
    req<{ gameId: string; code: string }>('/', {
      method: 'POST',
      body: JSON.stringify({ targetRounds, playbackMode }),
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
  ready: (code: string, playerId: string) =>
    req<void>(`/${code}/ready`, { method: 'POST', body: JSON.stringify({ playerId }) }),
  state: (code: string) => req<GameState>(`/${code}`),
};

// Subscribes to live game state over SignalR (/gameHub): the server pushes the full
// GameState to everyone in the game's group after every change. If the hub can't be
// reached, it transparently falls back to polling GET /api/games/{code}.
export function useGameState(code: string | null, pollMs = 1500) {
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let disposed = false;
    let pollTimer: number | undefined;

    const startPolling = () => {
      const tick = async () => {
        try {
          const s = await gameApi.state(code);
          if (!disposed) {
            setState(s);
            setError(null);
          }
        } catch (e) {
          if (!disposed) setError((e as Error).message);
        } finally {
          if (!disposed) pollTimer = window.setTimeout(tick, pollMs);
        }
      };
      tick();
    };

    const connection = new HubConnectionBuilder()
      .withUrl('/gameHub')
      .withAutomaticReconnect()
      .build();

    connection.on('state', (s: GameState) => {
      if (!disposed) {
        setState(s);
        setError(null);
      }
    });
    connection.onreconnected(() => connection.invoke('JoinGame', code).catch(() => {}));

    connection
      .start()
      .then(() => connection.invoke('JoinGame', code))
      .catch(() => {
        // Hub unavailable — fall back to polling so the game still works.
        if (!disposed) startPolling();
      });

    return () => {
      disposed = true;
      if (pollTimer) window.clearTimeout(pollTimer);
      if (connection.state !== HubConnectionState.Disconnected) connection.stop();
    };
  }, [code, pollMs]);

  return { state, error };
}
