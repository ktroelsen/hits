import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { GameState, RoundState, StatePlayer } from '../services/gameApi';

// Full-screen pop-up shown on the host screen and the phones when a round is revealed: the song
// (artwork, title, artist, year) plus every player's year guess, closest first.
// Exact guesses get stars and fireworks. Closes itself after `durationMs`.

/** True once per revealed round, until `close` is called. */
export function useRevealOverlay(state: GameState | null) {
  const [openRound, setOpenRound] = useState<number | null>(null);
  const [shownRound, setShownRound] = useState<number | null>(null);
  const round = state?.round ?? null;
  const revealed = state?.status === 'revealed' && round != null;

  useEffect(() => {
    if (revealed && round.number !== shownRound) {
      setShownRound(round.number);
      setOpenRound(round.number);
    }
  }, [revealed, round, shownRound]);

  const close = useCallback(() => setOpenRound(null), []);
  return { visible: revealed && openRound === round.number, close };
}

interface RevealOverlayProps {
  round: RoundState;
  players: StatePlayer[];
  /** Emphasises this player's row (the player's own phone). */
  highlightPlayerId?: string;
  onClose: () => void;
  durationMs?: number;
}

export function RevealOverlay({ round, players, highlightPlayerId, onClose, durationMs = 9000 }: RevealOverlayProps) {
  const song = round.song;

  useEffect(() => {
    const t = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(t);
  }, [onClose, durationMs]);

  const rows = useMemo(() => {
    const year = song?.year ?? 0;
    return players
      .map((p) => {
        const guess = round.results.find((r) => r.playerId === p.id)?.guessedYear ?? null;
        return { player: p, guess, diff: guess == null ? Infinity : Math.abs(guess - year) };
      })
      .sort((a, b) => a.diff - b.diff);
  }, [players, round.results, song?.year]);

  if (!song) return null;
  const anyExact = rows.some((r) => r.diff === 0);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      {anyExact && <Fireworks />}

      <motion.div
        className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-slate-900 p-6 shadow-2xl ring-1 ring-slate-700"
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <div className="flex flex-col items-center text-center">
          {song.artworkUrl && (
            <img src={song.artworkUrl} alt="" className="h-40 w-40 rounded-xl shadow-lg" />
          )}
          <p className="mt-4 text-2xl font-extrabold">{song.title}</p>
          <p className="text-slate-400">{song.artist}</p>
          <motion.p
            className="mt-2 text-6xl font-black text-pink-400"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 12 }}
          >
            {song.year}
          </motion.p>
        </div>

        <div className="mt-6 space-y-2">
          {rows.map(({ player, guess, diff }, i) => {
            const exact = diff === 0;
            const isMe = player.id === highlightPlayerId;
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.15 }}
                className={`flex items-center justify-between rounded-lg px-4 py-2 ${
                  exact ? 'bg-amber-500/20 ring-2 ring-amber-400' : 'bg-slate-800/70'
                } ${isMe && !exact ? 'ring-2 ring-pink-500' : ''}`}
              >
                <span className="font-semibold" style={{ color: player.color }}>
                  {exact && '⭐ '}
                  {player.name}
                  {isMe && <span className="ml-1 text-xs text-slate-400">(dig)</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`text-xl font-black ${exact ? 'text-amber-300' : 'text-slate-200'}`}>
                    {guess ?? '—'}
                  </span>
                  {guess != null && !exact && (
                    <span className="text-xs text-slate-500">±{diff}</span>
                  )}
                  {exact && (
                    <motion.span
                      animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                    >
                      🌟
                    </motion.span>
                  )}
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Countdown bar */}
        <motion.div
          className="mt-6 h-1 rounded-full bg-pink-500"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: durationMs / 1000, ease: 'linear' }}
        />
      </motion.div>
    </motion.div>
  );
}

const COLORS = ['#f472b6', '#facc15', '#22d3ee', '#a78bfa', '#34d399', '#fb923c'];

function Fireworks() {
  // A few bursts at random spots, each a ring of particles flying outwards.
  const bursts = useMemo(
    () =>
      Array.from({ length: 6 }, (_, b) => ({
        x: 10 + Math.random() * 80,
        y: 10 + Math.random() * 50,
        delay: b * 0.5,
        color: COLORS[b % COLORS.length],
      })),
    [],
  );

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {bursts.map((burst, b) =>
        Array.from({ length: 18 }, (_, i) => {
          const angle = (i / 18) * Math.PI * 2;
          const dist = 90 + Math.random() * 60;
          return (
            <motion.span
              key={`${b}-${i}`}
              className="absolute h-2 w-2 rounded-full"
              style={{ left: `${burst.x}%`, top: `${burst.y}%`, backgroundColor: burst.color }}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist + 40,
                opacity: 0,
                scale: 0.4,
              }}
              transition={{ duration: 1.4, delay: burst.delay, repeat: Infinity, repeatDelay: 2, ease: 'easeOut' }}
            />
          );
        }),
      )}
    </div>
  );
}
