import { useState } from 'react';
import { gameApi, GameState } from '../services/gameApi';

// Host controls shown on the player screen when the host also plays (created the game
// on their phone and joined it). Mirrors the big-screen host's buttons: start in the
// lobby, reveal while playing, next round after a reveal. In individual playback mode
// the game advances by itself, so reveal/next are only small fallbacks there.
export function HostControls({ code, state }: { code: string; state: GameState }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const individual = state.playbackMode === 'individual';

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const primary =
    'w-full rounded-lg px-4 py-3 text-lg font-bold text-white disabled:opacity-40';
  const fallback =
    'w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40';
  const lastRound = state.currentRound >= state.targetRounds;

  let content: React.ReactNode = null;
  if (state.status === 'lobby') {
    const joinUrl = `${window.location.origin}/game/${code}`;
    content = (
      <>
        <p className="text-sm text-slate-400">Andre joiner på</p>
        <p className="font-mono text-sm text-pink-400 break-all">{joinUrl}</p>
        <p className="mt-2 text-sm text-slate-400">med koden</p>
        <p className="my-1 font-mono text-5xl font-black tracking-widest">{code}</p>
        <button
          onClick={() => run(() => gameApi.start(code))}
          disabled={busy}
          className={`mt-4 bg-emerald-600 hover:bg-emerald-500 ${primary}`}
        >
          Start spil ({state.players.length} {state.players.length === 1 ? 'spiller' : 'spillere'})
        </button>
      </>
    );
  } else if (state.status === 'playing') {
    content = (
      <button
        onClick={() => run(() => gameApi.reveal(code))}
        disabled={busy}
        className={individual ? fallback : `bg-pink-600 hover:bg-pink-500 ${primary}`}
      >
        {individual ? 'Afslør nu uden at vente' : 'Afslør svar'}
      </button>
    );
  } else if (state.status === 'revealed') {
    content = (
      <button
        onClick={() => run(() => gameApi.next(code))}
        disabled={busy}
        className={individual ? fallback : `bg-emerald-600 hover:bg-emerald-500 ${primary}`}
      >
        {individual
          ? lastRound ? 'Afslut spil nu' : 'Start næste runde nu'
          : lastRound ? 'Afslut spil' : 'Næste runde'}
      </button>
    );
  }
  if (!content) return null;

  return (
    <div className="mt-8 rounded-xl bg-slate-900 p-4 text-center ring-1 ring-slate-800">
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">👑 Vært</p>
      {content}
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
    </div>
  );
}
