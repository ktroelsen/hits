import { useCallback, useState } from 'react';
import { gameApi, useGameState } from '../services/gameApi';
import { PlacementPicker } from './PlacementPicker';

interface JoinedPlayer {
  id: string;
  name: string;
  color: string;
}

const storageKey = (code: string) => `hits.game.${code}.player`;

function loadPlayer(code: string): JoinedPlayer | null {
  try {
    const raw = localStorage.getItem(storageKey(code));
    return raw ? (JSON.parse(raw) as JoinedPlayer) : null;
  } catch {
    return null;
  }
}

export function OnlinePlayerScreen({ code }: { code: string }) {
  const [player, setPlayer] = useState<JoinedPlayer | null>(() => loadPlayer(code));
  const [name, setName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { state } = useGameState(player ? code : null);

  const join = useCallback(async () => {
    if (!name.trim()) return;
    setBusy(true);
    setJoinError(null);
    try {
      const p = await gameApi.join(code, name.trim());
      try {
        localStorage.setItem(storageKey(code), JSON.stringify(p));
      } catch {
        /* private mode — session still works in-memory */
      }
      setPlayer(p);
    } catch (e) {
      setJoinError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [code, name]);

  const submitAnswer = useCallback(
    async (insertIndex: number, guessedYear?: number) => {
      if (!player) return;
      try {
        await gameApi.answer(code, player.id, insertIndex, guessedYear);
      } catch {
        /* already answered or round moved on — polling will resync UI */
      }
    },
    [code, player],
  );

  // --- Join screen ---
  if (!player) {
    return (
      <Shell>
        <h1 className="text-2xl font-extrabold">Join spil</h1>
        <p className="mt-1 text-sm text-slate-400">
          Kode: <span className="font-mono text-pink-400">{code}</span>
        </p>
        <label className="mt-6 block">
          <span className="text-xs uppercase tracking-wide text-slate-400">Dit spillernavn</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && join()}
            className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-pink-500"
            placeholder="fx Anna"
          />
        </label>
        {joinError && <p className="mt-2 text-sm text-rose-400">{joinError}</p>}
        <button
          onClick={join}
          disabled={busy || !name.trim()}
          className="mt-4 w-full rounded-lg bg-pink-600 px-4 py-3 font-bold text-white hover:bg-pink-500 disabled:opacity-40"
        >
          Join
        </button>
      </Shell>
    );
  }

  const round = state?.round ?? null;
  const answered = round?.answeredPlayerIds.includes(player.id) ?? false;
  const myResult = round?.results.find((r) => r.playerId === player.id) ?? null;

  return (
    <Shell>
      <div className="flex items-center justify-between">
        <span className="font-semibold" style={{ color: player.color }}>
          {player.name}
        </span>
        <span className="text-sm text-slate-400">
          {state ? `${state.players.find((p) => p.id === player.id)?.score ?? 0} point` : '…'}
        </span>
      </div>

      {!state && <p className="mt-8 text-center text-slate-400">Forbinder…</p>}

      {state?.status === 'lobby' && (
        <Centered>
          <p className="text-lg">Du er med! 🎉</p>
          <p className="mt-2 text-sm text-slate-400">Venter på at værten starter spillet…</p>
          <p className="mt-4 text-sm text-slate-500">{state.players.length} spillere er klar</p>
        </Centered>
      )}

      {state?.status === 'playing' && round && (
        <div className="mt-6">
          {answered ? (
            <Centered>
              <p className="text-lg">Svar sendt ✅</p>
              <p className="mt-2 text-sm text-slate-400">
                Venter på de andre… ({round.answeredPlayerIds.length}/{state.players.length})
              </p>
            </Centered>
          ) : (
            <>
              <p className="mb-4 text-sm text-slate-400">
                Runde {round.number} — lyt på storskærmen og placér sangen.
              </p>
              <PlacementPicker
                key={round.number}
                timeline={state.timeline}
                onSubmit={submitAnswer}
              />
            </>
          )}
        </div>
      )}

      {state?.status === 'revealed' && round && (
        <Centered>
          {round.song && (
            <p className="text-lg font-bold">
              {round.song.artist} – {round.song.title} ({round.song.year})
            </p>
          )}
          {myResult ? (
            <p className={`mt-3 text-2xl font-extrabold ${myResult.points > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {myResult.points > 0 ? `+${myResult.points} point` : '0 point'}
            </p>
          ) : (
            <p className="mt-3 text-slate-400">Du svarede ikke i denne runde.</p>
          )}
          {myResult && (
            <p className="mt-1 text-sm text-slate-400">
              Placering {myResult.placementCorrect ? '✅' : '❌'} · Årstal{' '}
              {myResult.yearCorrect ? '✅' : '❌'}
            </p>
          )}
          <Scoreboard players={state.players} meId={player.id} />
        </Centered>
      )}

      {state?.status === 'finished' && (
        <Centered>
          <p className="text-2xl font-extrabold">🏆 Spillet er slut!</p>
          <Scoreboard players={state.players} meId={player.id} />
        </Centered>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-md">{children}</div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="mt-10 text-center">{children}</div>;
}

function Scoreboard({
  players,
  meId,
}: {
  players: { id: string; name: string; color: string; score: number }[];
  meId?: string;
}) {
  return (
    <div className="mx-auto mt-6 max-w-xs space-y-1 text-left">
      {players.map((p, i) => (
        <div
          key={p.id}
          className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
            p.id === meId ? 'bg-slate-800 ring-1 ring-pink-500/40' : 'bg-slate-900'
          }`}
        >
          <span>
            <span className="mr-2 text-slate-500">{i + 1}.</span>
            <span style={{ color: p.color }}>{p.name}</span>
          </span>
          <span className="font-bold">{p.score}</span>
        </div>
      ))}
    </div>
  );
}
