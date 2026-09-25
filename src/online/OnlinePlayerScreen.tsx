import { useCallback, useRef, useState } from 'react';
import { attachFadeEnvelope, fadeOutAndPause, resetFade } from '../services/audioFade';
import { gameApi, useGameState } from '../services/gameApi';
import { PlacementPicker } from './PlacementPicker';
import { RevealOverlay, useRevealOverlay } from './RevealOverlay';
import { Standings } from './Standings';
import { HostControls } from './HostControls';

interface JoinedPlayer {
  id: string;
  name: string;
  color: string;
}

export const storageKey = (code: string) => `hits.game.${code}.player`;
// Set when this device created the game and plays along (see OnlineHostScreen).
export const hostStorageKey = (code: string) => `hits.game.${code}.host`;

function loadIsHost(code: string): boolean {
  try {
    return localStorage.getItem(hostStorageKey(code)) === '1';
  } catch {
    return false;
  }
}

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
  const [isHost] = useState(() => loadIsHost(code));
  const [name, setName] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { state } = useGameState(player ? code : null);
  const overlay = useRevealOverlay(state);

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

  const markReady = useCallback(async () => {
    if (!player) return;
    try {
      await gameApi.ready(code, player.id);
    } catch {
      /* round moved on already — live state will resync UI */
    }
  }, [code, player]);

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
  // Shared playback with the host playing along from a phone: that phone is the speaker.
  const hostIsSpeaker = isHost && state?.playbackMode !== 'individual';
  const answered = round?.answeredPlayerIds.includes(player.id) ?? false;
  const myResult = round?.results.find((r) => r.playerId === player.id) ?? null;

  return (
    <Shell>
      {overlay.visible && state && round && (
        <RevealOverlay
          round={round}
          players={state.players}
          timeline={state.timeline}
          highlightPlayerId={player.id}
          onClose={overlay.close}
        />
      )}
      <div className="flex items-center justify-between">
        <span className="font-semibold" style={{ color: player.color }}>
          {player.name}
        </span>
        <span className="text-sm text-slate-400">
          {state ? `${state.players.find((p) => p.id === player.id)?.score ?? 0} point` : '…'}
        </span>
      </div>

      {!state && <p className="mt-8 text-center text-slate-400">Forbinder…</p>}

      {state?.status === 'lobby' && !isHost && (
        <Centered>
          <p className="text-lg">Du er med! 🎉</p>
          <p className="mt-2 text-sm text-slate-400">Venter på at værten starter spillet…</p>
          <p className="mt-4 text-sm text-slate-500">{state.players.length} spillere er klar</p>
        </Centered>
      )}

      {state?.status === 'playing' && round && (
        <div className="mt-6">
          {hostIsSpeaker && round.audioUrl && (
            <div className="mb-4">
              <p className="mb-2 text-sm text-slate-400">🔊 Din telefon er højttaler — tryk play, så alle kan høre sangen.</p>
              <div className="flex">
                <LocalAudioPlayer key={round.number} src={round.audioUrl} />
              </div>
            </div>
          )}
          {answered ? (
            <Centered>
              <p className="text-lg">Svar sendt ✅</p>
              <p className="mt-2 text-sm text-slate-400">
                Venter på de andre… ({round.answeredPlayerIds.length}/{state.players.length})
              </p>
            </Centered>
          ) : (
            <>
              {state.playbackMode === 'individual' ? (
                <>
                  <p className="mb-4 text-sm text-slate-400">
                    Runde {round.number} — tryk play for at høre sangen, og placér den.
                  </p>
                  {!round.audioUrl && (
                    <p className="mb-4 text-center text-amber-400">Ingen lydklip for denne sang.</p>
                  )}
                </>
              ) : hostIsSpeaker ? (
                <p className="mb-4 text-sm text-slate-400">Runde {round.number} — placér sangen.</p>
              ) : (
                <p className="mb-4 text-sm text-slate-400">
                  Runde {round.number} — lyt på storskærmen og placér sangen.
                </p>
              )}
              <PlacementPicker
                key={round.number}
                timeline={state.timeline}
                onSubmit={submitAnswer}
                audioControl={
                  state.playbackMode === 'individual' && round.audioUrl ? (
                    <LocalAudioPlayer key={round.number} src={round.audioUrl} />
                  ) : undefined
                }
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
          <div className="text-left">
            <Standings
              players={state.players}
              results={round.results}
              meId={player.id}
              title={`Stilling efter runde ${state.currentRound}`}
            />
          </div>
          {state.playbackMode !== 'individual' ? (
            !isHost && <p className="mt-4 text-sm text-slate-500">Venter på næste runde…</p>
          ) : round.readyPlayerIds.includes(player.id) ? (
            <p className="mt-6 text-sm text-slate-400">
              Venter på de andre… ({round.readyPlayerIds.length}/{state.players.length})
            </p>
          ) : (
            <button
              onClick={markReady}
              className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-3 text-lg font-bold text-white hover:bg-emerald-500"
            >
              {state.currentRound >= state.targetRounds ? 'Se slutstilling' : 'Videre til næste sang'}
            </button>
          )}
        </Centered>
      )}

      {isHost && state && <HostControls code={code} state={state} />}

      {state?.status === 'finished' && (
        <Centered>
          <p className="text-2xl font-extrabold">🏆 Spillet er slut!</p>
          <Scoreboard players={state.players} meId={player.id} />
        </Centered>
      )}
    </Shell>
  );
}

// Play/stop control for individual playback mode: each player streams the round's
// preview locally instead of hearing it from the host's speaker. Reuses the same
// fade-in/fade-out envelope the host screen applies to its <audio> element.
function LocalAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      fadeOutAndPause(audio).then(() => setPlaying(false));
      return;
    }
    resetFade(audio);
    audio.currentTime = 0;
    audio.play().catch(() => {});
    cleanupRef.current?.();
    cleanupRef.current = attachFadeEnvelope(audio);
    setPlaying(true);
  }, [playing]);

  return (
    <div className="flex flex-1">
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        className="hidden"
      />
      <button
        onClick={toggle}
        className={`flex-1 rounded-full px-4 py-4 text-lg font-bold ${
          playing
            ? 'bg-rose-600 hover:bg-rose-500'
            : 'bg-emerald-600 hover:bg-emerald-500'
        }`}
      >
        {playing ? '⏹ Stop' : '▶️ Afspil'}
      </button>
    </div>
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
