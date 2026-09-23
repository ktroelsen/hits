import { Clock, Coins, Heart, LogOut, Trophy } from 'lucide-react';
import { Player, GameSettings } from '../types';

interface PlayerBarProps {
  players: Player[];
  activePlayerIndex: number;
  settings: GameSettings;
  lives: number;
  remainingSeconds: number | null; // timed team games; null otherwise
  highscore: number;
  highscoreName: string;
  onExitGame: () => void;
}

export function PlayerBar({
  players,
  activePlayerIndex,
  settings,
  lives,
  remainingSeconds,
  highscore,
  highscoreName,
  onExitGame,
}: PlayerBarProps) {
  return (
    <div id="player-bar" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2 sm:p-2.5 backdrop-blur-md">
      <div className="flex items-center gap-3">
        {/* Exit to the start screen (choose what to play) */}
        <button
          id="exit-game-btn"
          onClick={onExitGame}
          title="Afslut spillet og vælg et nyt"
          className="flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/70 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/50 transition-colors text-xs font-bold"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Afslut spillet</span>
        </button>

        {remainingSeconds !== null && <Countdown seconds={remainingSeconds} />}

        {settings.mode === 'solo' ? (
          // Solo: lives, score and highscore instead of teams/tokens
          <div className="flex items-center gap-3 sm:gap-5 flex-1 flex-wrap">
            <div className="flex items-center gap-1" title={`${lives} liv tilbage`}>
              {lives > 0 ? (
                Array.from({ length: lives }).map((_, i) => (
                  <Heart key={i} className="w-5 h-5 text-rose-500 fill-rose-500" />
                ))
              ) : (
                <span className="text-xs font-bold text-rose-300">Sidste chance!</span>
              )}
            </div>
            <span className="text-sm font-bold text-slate-300">
              Score: <span className="font-black text-white font-mono">{players[0]?.score ?? 0}</span>
            </span>
            <span
              className="flex items-center gap-1 text-sm font-bold text-amber-300"
              title={highscoreName ? `Rekord: ${highscoreName}` : undefined}
            >
              <Trophy className="w-4 h-4" />
              <span className="font-black font-mono">{highscore}</span>
              {highscoreName && (
                <span className="hidden sm:inline text-xs font-bold text-amber-300/80">
                  ({highscoreName})
                </span>
              )}
            </span>
          </div>
        ) : (
        <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 flex-1">
          {players.map((player, idx) => {
            const isActive = idx === activePlayerIndex;
            const cardCount = player.score ?? player.timeline.length;
            const isTimed = remainingSeconds !== null;
            const progressPercent = Math.min(100, (cardCount / settings.targetCards) * 100);

            return (
              <div
                key={player.id}
                className={`flex items-center gap-3 px-4 py-2 rounded-xl border transition-all shrink-0 ${
                  isActive
                    ? 'bg-slate-800 border-pink-500 shadow-lg ring-2 ring-pink-500/30 scale-[1.02]'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 opacity-70'
                }`}
              >
                {/* Player Color Avatar */}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white text-sm shadow ring-2 ring-white/10"
                  style={{ backgroundColor: player.color }}
                >
                  {player.name.slice(0, 2).toUpperCase()}
                </div>

                {/* Player Name & Progress */}
                <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-white">
                      {player.name}
                    </span>
                    {isActive && (
                      <span className="text-[10px] font-bold text-pink-300 bg-pink-950/80 px-1.5 py-0.5 rounded border border-pink-500/40 animate-pulse">
                        Deres tur
                      </span>
                    )}
                  </div>
                  {/* Progress bar towards target cards (timed games just show the count) */}
                  <div className="flex items-center gap-2 text-slate-400 font-mono">
                    {!isTimed && (
                    <div className="w-20 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-amber-400 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    )}
                    <span className="text-sm font-black text-white">
                      {cardCount}
                      <span className="text-[11px] font-bold text-slate-500">
                        {isTimed ? ' kort' : `/${settings.targetCards}`}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Token Count */}
                <div
                  className="flex items-center gap-1 ml-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 text-sm font-bold font-mono"
                  title="HITS Tokens (kan bruges til at skifte sang)"
                >
                  <Coins className="w-3.5 h-3.5 text-amber-400" />
                  <span>{player.tokens}</span>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}

function Countdown({ seconds }: { seconds: number }) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  const urgent = seconds <= 30;
  return (
    <div
      title="Tid tilbage — flest kort når tiden løber ud vinder"
      className={`flex items-center gap-1.5 shrink-0 px-3 py-2 rounded-xl border font-mono font-black text-sm ${
        urgent
          ? 'bg-rose-950/70 border-rose-500/60 text-rose-300 animate-pulse'
          : 'bg-slate-800 border-slate-700 text-cyan-300'
      }`}
    >
      <Clock className="w-4 h-4" />
      {seconds === 0 ? 'Sidste tur!' : `${m}:${s}`}
    </div>
  );
}
