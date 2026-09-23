import { Disc, Heart, Play, Settings, HelpCircle, ListMusic, Users } from 'lucide-react';
import { GameSettings } from '../types';

interface StartScreenProps {
  settings: GameSettings;
  highscore: number;
  highscoreName: string;
  onStart: () => void;
  onStartSolo: () => void;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onOpenCatalog: () => void;
}

export function StartScreen({
  settings,
  highscore,
  highscoreName,
  onStart,
  onStartSolo,
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
          • Mål:{' '}
          {settings.winCondition === 'time'
            ? `flest kort på ${settings.timeLimitMinutes} min`
            : `${settings.targetCards} sange`}
        </p>

        {/* Primary start button — classic, single-device HITS */}
        <button
          id="start-game-btn"
          onClick={onStart}
          className="mt-8 w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:to-indigo-700 text-white font-black text-lg tracking-wide uppercase shadow-lg shadow-pink-500/25 hover:scale-[1.02] transition-all"
        >
          <Play className="w-6 h-6 fill-current" />
          Start spil
        </button>
        <p className="mt-2 text-slate-400 text-sm">
          Klassisk HITS · alle spiller på denne enhed
        </p>

        {/* Single player — lives + highscore */}
        <button
          id="start-solo-btn"
          onClick={onStartSolo}
          className="mt-5 w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-lg tracking-wide uppercase border border-rose-500/50 hover:border-rose-400 shadow-lg shadow-rose-500/10 hover:scale-[1.02] transition-all"
        >
          <Heart className="w-6 h-6 text-rose-400 fill-rose-400" />
          Single player
        </button>
        <p className="mt-2 text-slate-400 text-sm">
          Spil alene · én fejl og du er ude
          {highscore > 0 && (
            <>
              {' '}· <span className="text-amber-300 font-bold">
                Highscore: {highscore}
                {highscoreName && ` (${highscoreName})`}
              </span>
            </>
          )}
        </p>

        {/* Online multiplayer — each player on their own phone */}
        <button
          onClick={() => {
            window.location.href = '/game';
          }}
          className="mt-5 w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-lg tracking-wide uppercase border border-cyan-500/50 hover:border-cyan-400 shadow-lg shadow-cyan-500/10 hover:scale-[1.02] transition-all"
        >
          <Users className="w-6 h-6 text-cyan-400" />
          Online spil
        </button>
        <p className="mt-2 text-slate-400 text-sm">
          Spil sammen på hver jeres telefon med en kode
        </p>

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
