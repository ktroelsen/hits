import { HeartCrack, Trophy, RotateCcw, LogOut } from 'lucide-react';

interface GameOverModalProps {
  isOpen: boolean;
  score: number;
  highscore: number;
  isNewRecord: boolean;
  onRestart: () => void;
  onExit: () => void;
}

// Shown when a solo game ends (wrong placement with no lives left).
export function GameOverModal({
  isOpen,
  score,
  highscore,
  isNewRecord,
  onRestart,
  onExit,
}: GameOverModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-slate-900 border-2 border-rose-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden text-center">
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-rose-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10">
          <div
            className={`inline-flex p-3 sm:p-4 rounded-3xl shadow-xl mb-3 ${
              isNewRecord
                ? 'bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 shadow-amber-500/30 animate-bounce'
                : 'bg-gradient-to-tr from-rose-600 to-pink-500 text-white shadow-rose-500/30'
            }`}
          >
            {isNewRecord ? (
              <Trophy className="w-8 h-8 sm:w-10 sm:h-10" />
            ) : (
              <HeartCrack className="w-8 h-8 sm:w-10 sm:h-10" />
            )}
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
            {isNewRecord ? 'Ny rekord!' : 'Game over'}
          </h2>
          <p className="text-sm text-slate-400 mt-1">Du har ikke flere liv tilbage.</p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Score</div>
              <div className="text-4xl font-black text-white font-mono mt-1">{score}</div>
            </div>
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-amber-500/30">
              <div className="text-xs font-bold uppercase tracking-wider text-amber-300">Highscore</div>
              <div className="text-4xl font-black text-amber-400 font-mono mt-1">{highscore}</div>
            </div>
          </div>
        </div>

        <div className="relative z-10 mt-6 pt-4 border-t border-slate-800 flex items-center justify-center gap-2 flex-wrap">
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm tracking-wide border border-slate-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Til forsiden</span>
          </button>
          <button
            onClick={onRestart}
            className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:scale-105 text-white font-bold text-sm tracking-wide shadow-lg shadow-pink-500/25 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Spil igen</span>
          </button>
        </div>
      </div>
    </div>
  );
}
