import { Trophy, Sparkles, RotateCcw, Play, LogOut } from 'lucide-react';
import { Player, Song } from '../../types';

interface VictoryModalProps {
  isOpen: boolean;
  winner: Player | null;
  onRestart: () => void;
  onExit: () => void;
  onPlaySong: (song: Song) => void;
}

export function VictoryModal({ isOpen, winner, onRestart, onExit, onPlaySong }: VictoryModalProps) {
  if (!isOpen || !winner) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-2xl bg-slate-900 border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Ambient Celebration Glow */}
        <div className="absolute -top-24 -left-24 w-60 h-60 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Top Celebration Banner */}
        <div className="text-center relative z-10">
          <div className="inline-flex p-3 sm:p-4 rounded-3xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 shadow-xl shadow-amber-500/30 mb-3 animate-bounce">
            <Trophy className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>

          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight font-display">
            {winner.name} Vinder!
          </h2>

          <p className="text-sm sm:text-base text-amber-300 font-semibold mt-1">
            Fuldførte en perfekt musikalsk tidslinje med {winner.timeline.length} hits!
          </p>
        </div>

        {/* Playlist / Winning Timeline Review */}
        <div className="mt-6 flex-1 overflow-y-auto pr-1 space-y-2 max-h-60 sm:max-h-72">
          <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider px-2 mb-2">
            <span>Vinderens Tidslinje ({winner.timeline.length} sange)</span>
            <span>Kronologisk</span>
          </div>

          {winner.timeline.map((song, i) => (
            <div
              key={song.id}
              className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-xs font-mono text-slate-500 font-bold">
                  #{i + 1}
                </span>

                <span className="text-base sm:text-lg font-black text-amber-400 font-mono bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/20">
                  {song.year}
                </span>

                <div className="flex flex-col">
                  <span className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-pink-300 transition-colors">
                    {song.title}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {song.artist} • {song.category === 'danish' ? '🇩🇰 Dansk' : '🌍 International'}
                  </span>
                </div>
              </div>

              <button
                onClick={() => onPlaySong(song)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-pink-600 text-slate-300 hover:text-white transition-all shadow-sm"
                title="Lyt til sangen"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
            </div>
          ))}
        </div>

        {/* Footer Actions */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Tak for et fantastisk spil!
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onExit}
              className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm tracking-wide border border-slate-700 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Afslut</span>
            </button>

            <button
              onClick={onRestart}
              className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:scale-105 text-white font-bold text-sm tracking-wide shadow-lg shadow-pink-500/25 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Spil et nyt spil</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
