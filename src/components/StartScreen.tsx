import { useState } from 'react';
import { Disc, Heart, Play, Settings, HelpCircle, ListMusic, Users, Plus, LogIn, ArrowLeft } from 'lucide-react';
import { GameSettings } from '../types';
import type { HighscoreEntry } from '../services/highscoreStore';

interface StartScreenProps {
  settings: GameSettings;
  highscore: HighscoreEntry | null;
  onStart: () => void;
  onStartSolo: () => void;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onOpenCatalog: () => void;
}

export function StartScreen({
  settings,
  highscore,
  onStart,
  onStartSolo,
  onOpenSettings,
  onOpenRules,
  onOpenCatalog,
}: StartScreenProps) {
  // Online button expands into "create" / "join"; join asks for the 4-digit code.
  const [onlineMode, setOnlineMode] = useState<'closed' | 'choose' | 'join'>('closed');
  const [joinCode, setJoinCode] = useState('');
  const codeValid = /^\d{4}$/.test(joinCode);

  const joinGame = () => {
    if (codeValid) window.location.href = `/game/${joinCode}`;
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden">
      {/* Ambient neon glows */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-coral-500/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-mint-500/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg w-full">
        {/* Brand logo */}
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-coral-500 via-lemon-400 to-mint-400 flex items-center justify-center shadow-xl shadow-coral-500/20 mb-6">
          <Disc className="w-12 h-12 text-white animate-[spin_8s_linear_infinite]" />
        </div>

        <h1 className="text-5xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-coral-400 via-lemon-300 to-mint-400 font-display tracking-wider">
          HITS
        </h1>
        <p className="mt-3 text-charcoal-300 text-base sm:text-lg font-medium">
          Gæt årstal & byg jeres fælles tidslinje
        </p>
        <p className="mt-1 text-charcoal-500 text-sm">
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
          className="mt-8 w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-lemon-400 hover:bg-lemon-300 text-charcoal-950 font-black text-lg tracking-wide uppercase shadow-lg shadow-lemon-400/20 hover:scale-[1.02] transition-all"
        >
          <Play className="w-6 h-6 fill-current" />
          Start spil
        </button>
        <p className="mt-2 text-charcoal-400 text-sm">
          Klassisk HITS · alle spiller på denne enhed
        </p>

        {/* Single player — lives + highscore */}
        <button
          id="start-solo-btn"
          onClick={onStartSolo}
          className="mt-5 w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-charcoal-900 hover:bg-charcoal-800 text-white font-black text-lg tracking-wide uppercase border border-rose-500/50 hover:border-rose-400 shadow-lg shadow-rose-500/10 hover:scale-[1.02] transition-all"
        >
          <Heart className="w-6 h-6 text-rose-400 fill-rose-400" />
          Single player
        </button>
        <p className="mt-2 text-charcoal-400 text-sm">
          Spil alene · én fejl og du er ude
          {highscore && (
            <>
              {' '}· <span className="text-amber-300 font-bold">Highscore: {highscore.score} ({highscore.name})</span>
            </>
          )}
        </p>

        {/* Online multiplayer — each player on their own phone */}
        {onlineMode === 'closed' && (
          <button
            onClick={() => setOnlineMode('choose')}
            className="mt-5 w-full sm:w-auto flex items-center justify-center gap-3 px-10 py-4 rounded-2xl bg-charcoal-900 hover:bg-charcoal-800 text-white font-black text-lg tracking-wide uppercase border border-mint-500/50 hover:border-mint-400 shadow-lg shadow-mint-500/10 hover:scale-[1.02] transition-all"
          >
            <Users className="w-6 h-6 text-mint-400" />
            Online spil
          </button>
        )}
        {onlineMode === 'choose' && (
          <div className="mt-5 w-full sm:w-auto flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                window.location.href = '/game';
              }}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-charcoal-900 hover:bg-charcoal-800 text-white font-black tracking-wide uppercase border border-mint-500/50 hover:border-mint-400 shadow-lg shadow-mint-500/10 transition-all"
            >
              <Plus className="w-5 h-5 text-mint-400" />
              Opret spil
            </button>
            <button
              onClick={() => setOnlineMode('join')}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-charcoal-900 hover:bg-charcoal-800 text-white font-black tracking-wide uppercase border border-mint-500/50 hover:border-mint-400 shadow-lg shadow-mint-500/10 transition-all"
            >
              <LogIn className="w-5 h-5 text-mint-400" />
              Join spil
            </button>
          </div>
        )}
        {onlineMode === 'join' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              joinGame();
            }}
            className="mt-5 w-full sm:w-auto flex gap-2"
          >
            <input
              autoFocus
              inputMode="numeric"
              placeholder="Kode"
              aria-label="4-cifret spilkode"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-40 flex-1 sm:flex-none px-4 py-4 rounded-2xl bg-charcoal-900 border border-mint-500/50 focus:border-mint-400 outline-none text-white text-center text-2xl font-black tracking-[0.4em] placeholder:tracking-normal placeholder:text-base placeholder:font-bold placeholder:text-charcoal-500"
            />
            <button
              type="submit"
              disabled={!codeValid}
              className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-mint-600 hover:bg-mint-500 disabled:bg-charcoal-800 disabled:text-charcoal-500 text-white font-black tracking-wide uppercase transition-all"
            >
              <LogIn className="w-5 h-5" />
              Join
            </button>
          </form>
        )}
        <p className="mt-2 text-charcoal-400 text-sm">
          {onlineMode === 'join'
            ? 'Indtast den 4-cifrede kode fra værtens skærm'
            : 'Spil sammen på hver jeres telefon med en kode'}
          {onlineMode !== 'closed' && (
            <>
              {' '}·{' '}
              <button
                onClick={() => {
                  setOnlineMode(onlineMode === 'join' ? 'choose' : 'closed');
                  setJoinCode('');
                }}
                className="inline-flex items-center gap-1 text-mint-300 hover:text-mint-200 font-bold"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Tilbage
              </button>
            </>
          )}
        </p>

        {/* Secondary actions */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 text-charcoal-200 border border-charcoal-700/80 hover:border-charcoal-600 transition-colors text-sm font-bold"
          >
            <Settings className="w-4 h-4 text-coral-400" />
            Indstillinger
          </button>
          <button
            onClick={onOpenRules}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 text-charcoal-200 border border-charcoal-800 transition-colors text-sm font-bold"
          >
            <HelpCircle className="w-4 h-4 text-mint-400" />
            Regler
          </button>
          <button
            onClick={onOpenCatalog}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 text-charcoal-200 border border-charcoal-800 transition-colors text-sm font-bold"
          >
            <ListMusic className="w-4 h-4 text-lemon-400" />
            Se sange
          </button>
        </div>
      </div>
    </div>
  );
}
