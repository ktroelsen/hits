import { Coins, Sparkles, User, RefreshCw, Trophy } from 'lucide-react';
import { Player, GameSettings } from '../types';

interface PlayerBarProps {
  players: Player[];
  activePlayerIndex: number;
  settings: GameSettings;
  canUseTokens: boolean;
  onUseToken: (action: 'skip' | 'hint') => void;
  onSelectPlayer?: (index: number) => void;
}

export function PlayerBar({
  players,
  activePlayerIndex,
  settings,
  canUseTokens,
  onUseToken,
}: PlayerBarProps) {
  const activePlayer = players[activePlayerIndex];

  return (
    <div id="player-bar" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4 backdrop-blur-md">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Players / Teams List */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 w-full sm:w-auto">
          {/* Shared timeline badge */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] font-semibold text-slate-300 shrink-0">
            <span className="w-2 h-2 rounded-full bg-pink-500" />
            <span>Fælles Tidslinje</span>
          </div>

          {players.map((player, idx) => {
            const isActive = idx === activePlayerIndex;
            const cardCount = player.score ?? player.timeline.length;
            const progressPercent = Math.min(100, (cardCount / settings.targetCards) * 100);

            return (
              <div
                key={player.id}
                className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all shrink-0 ${
                  isActive
                    ? 'bg-slate-800 border-pink-500 shadow-md ring-2 ring-pink-500/20'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 opacity-75'
                }`}
              >
                {/* Player Color Avatar */}
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center font-bold text-white text-xs shadow"
                  style={{ backgroundColor: player.color }}
                >
                  {player.name.slice(0, 2).toUpperCase()}
                </div>

                {/* Player Name & Progress */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-slate-200">
                      {player.name}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-bold text-pink-400 bg-pink-950/80 px-1.5 py-0.2 rounded border border-pink-500/30 animate-pulse">
                        Deres tur
                      </span>
                    )}
                  </div>
                  {/* Progress bar towards target cards */}
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                    <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-amber-400 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span>{cardCount}/{settings.targetCards}</span>
                  </div>
                </div>

                {/* Token Count */}
                <div
                  className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold font-mono"
                  title="Hitster Tokens (kan bruges til at skifte sang)"
                >
                  <Coins className="w-3 h-3 text-amber-400" />
                  <span>{player.tokens}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Player Actions & Token Use */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            id="use-token-skip-btn"
            onClick={() => onUseToken('skip')}
            disabled={!canUseTokens || activePlayer.tokens <= 0}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:pointer-events-none border border-slate-700 transition-colors"
            title="Brug 1 Hitster-token på at skifte sangen ud"
          >
            <RefreshCw className="w-3.5 h-3.5 text-pink-400" />
            <span>Skift sang</span>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1 rounded font-mono border border-amber-500/30">
              -1 🪙
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
