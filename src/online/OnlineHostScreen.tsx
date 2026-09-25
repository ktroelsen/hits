import { useCallback, useState } from 'react';
import { attachFadeEnvelope } from '../services/audioFade';
import { gameApi, useGameState, PlaybackMode, StatePlayer } from '../services/gameApi';
import { RevealOverlay, useRevealOverlay } from './RevealOverlay';
import { Standings } from './Standings';

// Callback ref: applies the fade envelope to each round's <audio> element.
const fadeAudioRef = (el: HTMLAudioElement | null) => (el ? attachFadeEnvelope(el) : undefined);

// Main "big screen" for the online game (route /game). The host creates the game,
// players join by code on their own phones, and this screen plays each song and
// drives the round loop (start → reveal → next).
export function OnlineHostScreen() {
  const [code, setCode] = useState<string | null>(null);
  const [targetRounds, setTargetRounds] = useState(10);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('shared');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { state } = useGameState(code);

  const run = useCallback(async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  const createGame = () => run(async () => {
    const { code: c } = await gameApi.create(targetRounds, playbackMode);
    setCode(c);
  });

  const round = state?.round ?? null;
  const overlay = useRevealOverlay(state);

  const joinUrl = code ? `${window.location.origin}/game/${code}` : '';

  return (
    <div className="min-h-screen bg-charcoal-950 px-4 py-8 text-charcoal-100">
      {overlay.visible && state && round && (
        <RevealOverlay round={round} players={state.players} timeline={state.timeline} onClose={overlay.close} />
      )}
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">🎵 Hits — Online</h1>
          {state && (
            <span className="text-sm text-charcoal-400">
              Runde {state.currentRound}/{state.targetRounds}
            </span>
          )}
        </header>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-950/60 p-3 text-sm text-rose-200 ring-1 ring-rose-800">
            {error}
          </div>
        )}

        {/* --- Create --- */}
        {!code && (
          <section className="rounded-xl bg-charcoal-900 p-6 ring-1 ring-charcoal-800">
            <p className="mb-4 text-charcoal-300">Start et nyt online-spil. Spillere joiner med koden.</p>
            <label className="mb-4 block">
              <span className="text-xs uppercase tracking-wide text-charcoal-400">Antal runder</span>
              <input
                type="number"
                min={1}
                max={50}
                value={targetRounds}
                onChange={(e) => setTargetRounds(Math.max(1, Number(e.target.value) || 1))}
                className="mt-1 w-28 rounded-lg bg-charcoal-800 px-3 py-2 outline-none ring-1 ring-charcoal-700 focus:ring-coral-500"
              />
            </label>
            <fieldset className="mb-4">
              <legend className="text-xs uppercase tracking-wide text-charcoal-400">Lydafspilning</legend>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <label
                  className={`flex-1 cursor-pointer rounded-lg px-4 py-3 text-sm ring-1 ${
                    playbackMode === 'shared'
                      ? 'bg-coral-950/60 ring-coral-600'
                      : 'bg-charcoal-800 ring-charcoal-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="playbackMode"
                    value="shared"
                    checked={playbackMode === 'shared'}
                    onChange={() => setPlaybackMode('shared')}
                    className="sr-only"
                  />
                  <span className="font-semibold">🔊 Fælles højttaler</span>
                  <p className="mt-1 text-xs text-charcoal-400">Sangen spiller på denne skærm.</p>
                </label>
                <label
                  className={`flex-1 cursor-pointer rounded-lg px-4 py-3 text-sm ring-1 ${
                    playbackMode === 'individual'
                      ? 'bg-coral-950/60 ring-coral-600'
                      : 'bg-charcoal-800 ring-charcoal-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="playbackMode"
                    value="individual"
                    checked={playbackMode === 'individual'}
                    onChange={() => setPlaybackMode('individual')}
                    className="sr-only"
                  />
                  <span className="font-semibold">🎧 Hver spiller lytter selv</span>
                  <p className="mt-1 text-xs text-charcoal-400">Hver spiller afspiller på egen telefon.</p>
                </label>
              </div>
            </fieldset>
            <button
              onClick={createGame}
              disabled={busy}
              className="rounded-lg bg-coral-600 px-5 py-3 font-bold hover:bg-coral-500 disabled:opacity-40"
            >
              Opret spil
            </button>
          </section>
        )}

        {/* --- Lobby --- */}
        {state?.status === 'lobby' && (
          <section className="rounded-xl bg-charcoal-900 p-6 ring-1 ring-charcoal-800 text-center">
            <p className="text-sm text-charcoal-400">Gå ind på</p>
            <p className="mt-1 font-mono text-lg text-coral-400">{joinUrl}</p>
            <p className="mt-4 text-sm text-charcoal-400">og indtast koden</p>
            <p className="my-2 font-mono text-6xl font-black tracking-widest">{code}</p>

            <PlayerChips players={state.players} />

            <button
              onClick={() => run(() => gameApi.start(code!))}
              disabled={busy || state.players.length === 0}
              className="mt-6 rounded-lg bg-emerald-600 px-6 py-3 font-bold hover:bg-emerald-500 disabled:opacity-40"
            >
              {state.players.length === 0 ? 'Venter på spillere…' : 'Start spil'}
            </button>
          </section>
        )}

        {/* --- Playing --- */}
        {state?.status === 'playing' && round && (
          <section className="rounded-xl bg-charcoal-900 p-6 ring-1 ring-charcoal-800">
            {state.playbackMode === 'individual' ? (
              <p className="mb-3 text-center text-charcoal-300">
                🎧 Lyt på jeres egne telefoner og placér sangen
              </p>
            ) : (
              <>
                <p className="mb-3 text-center text-charcoal-300">
                  🎧 Lyt til sangen og placér den på jeres telefoner
                </p>
                {round.audioUrl ? (
                  <audio
                    key={round.number}
                    ref={fadeAudioRef}
                    src={round.audioUrl}
                    controls
                    autoPlay
                    className="mx-auto w-full max-w-md"
                  />
                ) : (
                  <p className="text-center text-amber-400">Ingen lydklip for denne sang.</p>
                )}
              </>
            )}

            <Timeline songs={state.timeline} />

            <div className="mt-6">
              <p className="mb-2 text-sm text-charcoal-400">
                Svar: {round.answeredPlayerIds.length}/{state.players.length}
              </p>
              <div className="flex flex-wrap gap-2">
                {state.players.map((p) => {
                  const done = round.answeredPlayerIds.includes(p.id);
                  return (
                    <span
                      key={p.id}
                      className={`rounded-full px-3 py-1 text-sm ring-1 ${
                        done
                          ? 'bg-emerald-900/50 text-emerald-300 ring-emerald-700'
                          : 'bg-charcoal-800 text-charcoal-400 ring-charcoal-700'
                      }`}
                    >
                      {done ? '✅' : '⏳'} {p.name}
                    </span>
                  );
                })}
              </div>
            </div>

            {state.playbackMode === 'individual' ? (
              <>
                <p className="mt-6 text-center text-sm text-charcoal-400">
                  Svarene afsløres automatisk, når alle har svaret.
                </p>
                <button
                  onClick={() => run(() => gameApi.reveal(code!))}
                  disabled={busy}
                  className="mt-2 w-full rounded-lg bg-charcoal-800 px-4 py-2 text-sm font-semibold text-charcoal-300 ring-1 ring-charcoal-700 hover:bg-charcoal-700 disabled:opacity-40"
                >
                  Afslør nu uden at vente
                </button>
              </>
            ) : (
              <button
                onClick={() => run(() => gameApi.reveal(code!))}
                disabled={busy}
                className="mt-6 w-full rounded-lg bg-coral-600 px-4 py-3 font-bold hover:bg-coral-500 disabled:opacity-40"
              >
                Afslør svar
              </button>
            )}
          </section>
        )}

        {/* --- Revealed --- */}
        {state?.status === 'revealed' && round && (
          <section className="rounded-xl bg-charcoal-900 p-6 ring-1 ring-charcoal-800">
            {round.song && (
              <div className="mb-4 flex items-center gap-4">
                {round.song.artworkUrl && (
                  <img src={round.song.artworkUrl} alt="" className="h-20 w-20 rounded-lg shadow" />
                )}
                <div>
                  <p className="text-xl font-extrabold">{round.song.title}</p>
                  <p className="text-charcoal-400">{round.song.artist}</p>
                  <p className="mt-1 text-3xl font-black text-coral-400">{round.song.year}</p>
                </div>
              </div>
            )}

            <Timeline songs={state.timeline} />

            <Standings
              players={state.players}
              results={round.results}
              title={`Stilling efter runde ${state.currentRound}`}
            />

            {state.playbackMode === 'individual' ? (
              <>
                <p className="mt-6 text-center text-sm text-charcoal-400">
                  Næste sang starter, når alle har trykket videre ({round.readyPlayerIds.length}/
                  {state.players.length})
                </p>
                <button
                  onClick={() => run(() => gameApi.next(code!))}
                  disabled={busy}
                  className="mt-2 w-full rounded-lg bg-charcoal-800 px-4 py-2 text-sm font-semibold text-charcoal-300 ring-1 ring-charcoal-700 hover:bg-charcoal-700 disabled:opacity-40"
                >
                  {state.currentRound >= state.targetRounds ? 'Afslut spil nu' : 'Start næste runde nu'}
                </button>
              </>
            ) : (
              <button
                onClick={() => run(() => gameApi.next(code!))}
                disabled={busy}
                className="mt-6 w-full rounded-lg bg-emerald-600 px-4 py-3 font-bold hover:bg-emerald-500 disabled:opacity-40"
              >
                {state.currentRound >= state.targetRounds ? 'Afslut spil' : 'Næste runde'}
              </button>
            )}
          </section>
        )}

        {/* --- Finished --- */}
        {state?.status === 'finished' && (
          <section className="rounded-xl bg-charcoal-900 p-6 ring-1 ring-charcoal-800 text-center">
            <p className="text-3xl font-black">🏆 Slutstilling</p>
            <div className="mx-auto mt-6 max-w-sm space-y-2">
              {state.players.map((p, i) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                    i === 0 ? 'bg-amber-500/20 ring-1 ring-amber-500' : 'bg-charcoal-800'
                  }`}
                >
                  <span className="font-semibold" style={{ color: p.color }}>
                    {i + 1}. {p.name}
                  </span>
                  <span className="text-xl font-black">{p.score}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                window.location.href = '/';
              }}
              className="mt-6 rounded-lg bg-coral-600 px-6 py-3 font-bold hover:bg-coral-500"
            >
              Tilbage til forsiden
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

function PlayerChips({ players }: { players: StatePlayer[] }) {
  if (players.length === 0) {
    return <p className="mt-6 text-charcoal-500">Ingen spillere endnu…</p>;
  }
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-2">
      {players.map((p) => (
        <span
          key={p.id}
          className="rounded-full px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: p.color }}
        >
          {p.name}
        </span>
      ))}
    </div>
  );
}

function Timeline({ songs }: { songs: { id: string; title: string; artist: string; year: number }[] }) {
  if (songs.length === 0) {
    return <p className="mt-4 text-center text-sm text-charcoal-500">Tidslinjen er tom endnu.</p>;
  }
  return (
    <div className="mt-4 flex flex-wrap items-stretch gap-2">
      {songs.map((s) => (
        <div key={s.id} className="rounded-lg bg-charcoal-800 px-3 py-2 text-center ring-1 ring-charcoal-700">
          <p className="text-lg font-black text-coral-400">{s.year}</p>
          <p className="max-w-[8rem] truncate text-xs text-charcoal-300">{s.title}</p>
        </div>
      ))}
    </div>
  );
}
