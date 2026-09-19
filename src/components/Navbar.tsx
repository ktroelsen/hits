import { useState } from 'react';
import { Disc, Settings, HelpCircle, Volume2, VolumeX, RotateCcw, Sparkles, ListMusic } from 'lucide-react';
import { sfx } from '../services/audioService';
import { GameSettings } from '../types';

interface NavbarProps {
  settings: GameSettings;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  onOpenSongCatalog: () => void;
  onRestartCurrentGame: () => void;
}

export function Navbar({
  settings,
  onOpenSettings,
  onOpenRules,
  onOpenSongCatalog,
  onRestartCurrentGame,
}: NavbarProps) {
  const [soundOn, setSoundOn] = useState(sfx.isEnabled());

  const toggleSound = () => {
    const next = !soundOn;
    sfx.setEnabled(next);
    setSoundOn(next);
  };

  const getModeLabel = () => {
    switch (settings.mode) {
      case 'timeline': return '🏆 Klassisk';
      case 'expert': return '🎯 Ekspert';
      case 'party': return '🥳 Fest';
      case 'dj': return '🎧 DJ Mode';
      default: return 'Hitster';
    }
  };

  return (
    <header id="app-navbar" className="w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
              <Disc className="w-6 h-6 text-white animate-[spin_8s_linear_infinite]" />
            </div>
            {/* Tiny turntable arm */}
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-xs" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-300 to-cyan-400 font-display tracking-wider">
                HITSTER
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 hidden sm:inline-block">
                DK & INT
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">
              Gæt årstal & byg din tidslinje
            </span>
          </div>
        </div>

        {/* Center / Game Mode Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs text-slate-300">
          <span className="font-bold text-pink-400">{getModeLabel()}</span>
          <span className="text-slate-600">•</span>
          <span>
            {settings.categoryFilter === 'all'
              ? '🇩🇰 + 🌍 Blandet'
              : settings.categoryFilter === 'danish'
              ? '🇩🇰 Kun Danske'
              : '🌍 Kun Internationale'}
          </span>
          <span className="text-slate-600">•</span>
          <span>Mål: {settings.targetCards} sange</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Sound FX Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 sm:px-2.5 sm:py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
            title={soundOn ? 'Slå lydeffekter fra' : 'Slå lydeffekter til'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-pink-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Song Catalog preview */}
          <button
            onClick={onOpenSongCatalog}
            className="p-2 sm:px-2.5 sm:py-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-colors"
            title="Se sangliste og statistik"
          >
            <ListMusic className="w-4 h-4" />
          </button>

          {/* Rules Modal */}
          <button
            onClick={onOpenRules}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-900 border border-slate-800 transition-colors text-xs font-bold flex items-center gap-1.5"
            title="Spilleregler"
          >
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span className="hidden sm:inline">Regler</span>
          </button>

          {/* Settings / New Game */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:border-slate-600 transition-colors text-xs font-bold shadow-sm"
            title="Nyt spil eller indstillinger"
          >
            <Settings className="w-4 h-4 text-pink-400" />
            <span className="hidden sm:inline">Nyt spil</span>
          </button>
        </div>
      </div>
    </header>
  );
}
