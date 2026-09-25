import { motion } from 'motion/react';
import { RoundResult, StatePlayer } from '../services/gameApi';

// Current standings after a round: total score per player (players arrive sorted by
// score from the server) plus what each one earned in the round just revealed.
export function Standings({
  players,
  results,
  meId,
  title = 'Stilling',
}: {
  players: StatePlayer[];
  results: RoundResult[];
  meId?: string;
  title?: string;
}) {
  return (
    <div className="mt-6">
      <p className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-charcoal-400">{title}</p>
      <div className="space-y-2">
        {players.map((p, i) => {
          const points = results.find((r) => r.playerId === p.id)?.points ?? 0;
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                i === 0 ? 'bg-amber-500/15 ring-1 ring-amber-500/60' : 'bg-charcoal-800/70'
              } ${p.id === meId ? 'ring-2 ring-coral-500' : ''}`}
            >
              <span className="font-semibold">
                <span className="mr-2 text-charcoal-500">{i + 1}.</span>
                <span style={{ color: p.color }}>{p.name}</span>
                {p.id === meId && <span className="ml-1 text-xs text-charcoal-400">(dig)</span>}
              </span>
              <span className="flex items-center gap-3">
                <span className={`text-sm font-bold ${points > 0 ? 'text-emerald-400' : 'text-charcoal-500'}`}>
                  +{points}
                </span>
                <span className="w-10 text-right text-2xl font-black">{p.score}</span>
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
