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
      default: return 'HITS';
    }
  };

  return (
    <header id="app-navbar" className="w-full border-b border-charcoal-800 bg-charcoal-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-coral-500 via-lemon-400 to-mint-400 flex items-center justify-center shadow-lg shadow-coral-500/20">
              <Disc className="w-6 h-6 text-white animate-[spin_8s_linear_infinite]" />
            </div>
            {/* Tiny turntable arm */}
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 shadow-xs" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-coral-400 via-lemon-300 to-mint-400 font-display tracking-wider">
                HITS
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-coral-500/10 text-coral-300 border border-coral-500/20 hidden sm:inline-block">
                DK & INT
              </span>
            </div>
            <span className="text-[10px] text-charcoal-400 font-medium">
              Gæt årstal & byg din tidslinje
            </span>
          </div>
        </div>

        {/* Center / Game Mode Pill */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-charcoal-900 border border-charcoal-800 text-xs text-charcoal-300">
          <span className="font-bold text-coral-400">{getModeLabel()}</span>
          <span className="text-charcoal-600">•</span>
          <span>
            {settings.categoryFilter === 'all'
              ? '🇩🇰 + 🌍 Blandet'
              : settings.categoryFilter === 'danish'
              ? '🇩🇰 Kun Danske'
              : '🌍 Kun Internationale'}
          </span>
          <span className="text-charcoal-600">•</span>
          <span>Mål: {settings.targetCards} sange</span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Sound FX Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 sm:px-2.5 sm:py-2 rounded-xl text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-900 border border-transparent hover:border-charcoal-800 transition-colors"
            title={soundOn ? 'Slå lydeffekter fra' : 'Slå lydeffekter til'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-coral-400" /> : <VolumeX className="w-4 h-4 text-charcoal-500" />}
          </button>

          {/* Song Catalog preview */}
          <button
            onClick={onOpenSongCatalog}
            className="p-2 sm:px-2.5 sm:py-2 rounded-xl text-charcoal-400 hover:text-charcoal-200 hover:bg-charcoal-900 border border-transparent hover:border-charcoal-800 transition-colors"
            title="Se sangliste og statistik"
          >
            <ListMusic className="w-4 h-4" />
          </button>

          {/* Rules Modal */}
          <button
            onClick={onOpenRules}
            className="p-2 sm:px-3 sm:py-2 rounded-xl text-charcoal-300 hover:text-white hover:bg-charcoal-900 border border-charcoal-800 transition-colors text-xs font-bold flex items-center gap-1.5"
            title="Spilleregler"
          >
            <HelpCircle className="w-4 h-4 text-mint-400" />
            <span className="hidden sm:inline">Regler</span>
          </button>

          {/* Settings / New Game */}
          <button
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-charcoal-900 hover:bg-charcoal-800 text-charcoal-200 border border-charcoal-700/80 hover:border-charcoal-600 transition-colors text-xs font-bold shadow-sm"
            title="Nyt spil eller indstillinger"
          >
            <Settings className="w-4 h-4 text-coral-400" />
            <span className="hidden sm:inline">Nyt spil</span>
          </button>
        </div>
      </div>
    </header>
  );
}
