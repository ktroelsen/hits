import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { GameState, RoundState, StatePlayer, TimelineSong } from '../services/gameApi';
import { HitsterCard, decadeForYear } from '../components/HitsterCard';
import { appleMusicUrl } from '../services/audioService';

// Full-screen pop-up shown on the host screen and the phones when a round is revealed: the song
// (artwork, title, artist, year) plus every player's year guess (closest first) and round points.
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
  /** The shared timeline, which by now includes the revealed song. */
  timeline: TimelineSong[];
  /** Emphasises this player's row (the player's own phone). */
  highlightPlayerId?: string;
  onClose: () => void;
  durationMs?: number;
}

export function RevealOverlay({ round, players, timeline, highlightPlayerId, onClose, durationMs = 9000 }: RevealOverlayProps) {
  const song = round.song;

  useEffect(() => {
    const t = window.setTimeout(onClose, durationMs);
    return () => window.clearTimeout(t);
  }, [onClose, durationMs]);

  const rows = useMemo(() => {
    const year = song?.year ?? 0;
    return players
      .map((p) => {
        const result = round.results.find((r) => r.playerId === p.id);
        const guess = result?.guessedYear ?? null;
        return { player: p, guess, points: result?.points ?? 0, diff: guess == null ? Infinity : Math.abs(guess - year) };
      })
      .sort((a, b) => a.diff - b.diff);
  }, [players, round.results, song?.year]);

  if (!song) return null;
  const anyExact = rows.some((r) => r.diff === 0);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-950/90 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      onClick={onClose}
    >
      {anyExact && <Fireworks />}

      <motion.div
        className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-2xl bg-charcoal-900 p-6 shadow-2xl ring-1 ring-charcoal-700"
        initial={{ scale: 0.8, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <div className="flex flex-col items-center text-center">
          {song.artworkUrl && (
            <img src={song.artworkUrl} alt="" className="h-28 w-28 rounded-xl shadow-lg sm:h-40 sm:w-40" />
          )}
          <p className="mt-4 text-2xl font-extrabold">{song.title}</p>
          <p className="text-charcoal-400">{song.artist}</p>
          <a
            href={appleMusicUrl(song.artist, song.title)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()} // don't close the pop-up
            className="mt-2 inline-flex items-center gap-1 rounded-full bg-coral-950/50 px-3 py-1 text-xs font-semibold text-coral-300 ring-1 ring-coral-800/60 hover:bg-coral-950/80 hover:text-coral-200"
          >
            ♫ Lyt på Apple Music ↗
          </a>
          <motion.p
            className="mt-2 text-6xl font-black text-coral-400"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 260, damping: 12 }}
          >
            {song.year}
          </motion.p>
        </div>

        <TimelineNeighbours song={song} timeline={timeline} />

        <div className="mt-6 space-y-2">
          {rows.map(({ player, guess, points, diff }, i) => {
            const exact = diff === 0;
            const isMe = player.id === highlightPlayerId;
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.15 }}
                className={`flex items-center justify-between rounded-lg px-4 py-2 ${
                  exact ? 'bg-amber-500/20 ring-2 ring-amber-400' : 'bg-charcoal-800/70'
                } ${isMe && !exact ? 'ring-2 ring-coral-500' : ''}`}
              >
                <span className="font-semibold" style={{ color: player.color }}>
                  {exact && '⭐ '}
                  {player.name}
                  {isMe && <span className="ml-1 text-xs text-charcoal-400">(dig)</span>}
                </span>
                <span className="flex items-center gap-2">
                  <span className={`text-xl font-black ${exact ? 'text-amber-300' : 'text-charcoal-200'}`}>
                    {guess ?? '—'}
                  </span>
                  {guess != null && !exact && (
                    <span className="text-xs text-charcoal-500">±{diff}</span>
                  )}
                  {exact && (
                    <motion.span
                      animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.3, 1] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                    >
                      🌟
                    </motion.span>
                  )}
                  <span
                    className={`ml-1 min-w-[3.5rem] rounded-full px-2 py-0.5 text-center text-sm font-bold ${
                      points > 0 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-charcoal-700/60 text-charcoal-400'
                    }`}
                  >
                    +{points} p
                  </span>
                </span>
              </motion.div>
            );
          })}
        </div>

        {/* Countdown bar */}
        <motion.div
          className="mt-6 h-1 rounded-full bg-coral-500"
          initial={{ width: '100%' }}
          animate={{ width: '0%' }}
          transition={{ duration: durationMs / 1000, ease: 'linear' }}
        />
      </motion.div>
    </motion.div>
  );
}

// The revealed song on the shared timeline with its neighbours: the card before, the
// song itself (highlighted), and the card after. The timeline already contains the
// revealed song, sorted by year.
function TimelineNeighbours({ song, timeline }: { song: TimelineSong; timeline: TimelineSong[] }) {
  const idx = timeline.findIndex((s) => s.id === song.id);
  if (idx < 0) return null;
  const toCard = (s: TimelineSong) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    year: s.year,
    decade: decadeForYear(s.year),
    artworkUrl: s.artworkUrl ?? undefined,
  });
  const before = timeline[idx - 1];
  const after = timeline[idx + 1];

  return (
    <motion.div
      className="mt-5"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      onClick={(e) => e.stopPropagation()} // card play buttons shouldn't close the pop-up
    >
      <p className="mb-2 text-center text-xs font-bold uppercase tracking-widest text-charcoal-400">Tidslinjen</p>
      <div className="flex items-center justify-center gap-2">
        {before ? <HitsterCard song={toCard(before)} isRevealed status="neutral" /> : <EdgeCard label="Først" />}
        <HitsterCard song={toCard(song)} isRevealed status="active" />
        {after ? <HitsterCard song={toCard(after)} isRevealed status="neutral" /> : <EdgeCard label="Sidst" />}
      </div>
    </motion.div>
  );
}

// Placeholder where the revealed song sits at either end of the timeline.
function EdgeCard({ label }: { label: string }) {
  return (
    <div className="flex h-32 w-24 items-center justify-center rounded-2xl border-2 border-dashed border-charcoal-700 text-xs font-bold uppercase tracking-wider text-charcoal-500 sm:w-28">
      {label}
    </div>
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
