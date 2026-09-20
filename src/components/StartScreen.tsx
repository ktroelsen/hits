import { Disc, Play, Settings, HelpCircle, ListMusic } from 'lucide-react';
import { GameSettings } from '../types';

interface StartScreenProps {
  settings: GameSettings;
  onStart: () => void;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onOpenCatalog: () => void;
}

export function StartScreen({
  settings,
  onStart,
  onOpenSettings,
  onOpenRules,
  onOpenCatalog,
}: StartScreenProps) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Ambient neon glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-pink-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full">
        {/* Brand logo */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-600 to-cyan-400 flex items-center justify-center shadow-xl shadow-pink-500/20 mb-6">
          <Disc className="w-12 h-12 text-white animate-[spin_8s_linear_infinite]" />
        </div>

        <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400 font-display tracking-wider">
          HITS
        </h1>
        <p className="mt-3 text-slate-300 text-base sm:text-lg font-medium">
          Gæt årstal & byg jeres fælles tidslinje
        </p>
        <p className="mt-1 text-slate-500 text-sm">
          {settings.categoryFilter === 'all'
            ? '🇩🇰 + 🌍 Blandet'
            : settings.categoryFilter === 'danish'
            ? '🇩🇰 Kun danske'
            : '🌍 Kun internationale'}{' '}
          • Mål: {settings.targetCards} sange
        </p>

        {/* Primary start button */}
        <button
          id="start-game-btn"
          onClick={onStart}
          className="mt-8 w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white font-black text-lg tracking-wide uppercase shadow-lg shadow-pink-500/25 hover:scale-[1.02] transition-all"
        >
          <Play className="w-6 h-6 fill-current" />
          Start spil
        </button>

        {/* Secondary actions */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-600 transition-colors text-sm font-bold"
          >
            <Settings className="w-4 h-4 text-pink-400" />
            Indstillinger
          </button>
          <button
            onClick={onOpenRules}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors text-sm font-bold"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            Regler
          </button>
          <button
            onClick={onOpenCatalog}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 transition-colors text-sm font-bold"
          >
            <ListMusic className="w-4 h-4 text-purple-400" />
            Se sange
          </button>
        </div>
      </div>
    </div>
  );
}
