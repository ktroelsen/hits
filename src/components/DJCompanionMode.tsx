import { useState, useEffect } from 'react';
import { Disc, Play, RefreshCw, Eye, EyeOff, Sparkles, Volume2, HelpCircle } from 'lucide-react';
import { Song, GameSettings } from '../types';
import { TurntablePlayer } from './TurntablePlayer';
import { HitsterCard } from './HitsterCard';
import { sfx } from '../services/audioService';

interface DJCompanionModeProps {
  songs: Song[];
  settings: GameSettings;
  onExitDJMode: () => void;
}

export function DJCompanionMode({ songs, settings, onExitDJMode }: DJCompanionModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [deck, setDeck] = useState<Song[]>([]);

  // Initialize randomized deck
  useEffect(() => {
    const shuffled = [...songs].sort(() => Math.random() - 0.5);
    setDeck(shuffled);
    setCurrentIndex(0);
    setIsRevealed(false);
  }, [songs]);

  const currentSong = deck[currentIndex] || null;

  const handleNextCard = () => {
    sfx.playFlip();
    setIsRevealed(false);
    if (currentIndex + 1 < deck.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      // Reshuffle deck
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      setDeck(shuffled);
      setCurrentIndex(0);
    }
  };

  const handleReveal = () => {
    sfx.playSuccess();
    setIsRevealed(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
            <Disc className="w-6 h-6 animate-spin" style={{ animationDuration: '4s' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white font-display">
              Hitster DJ Companion & Fri Quiz
            </h2>
            <p className="text-xs text-slate-400">
              Træk et sangkort, spil sangen for dine venner, og afslør årstallet når I er klar!
            </p>
          </div>
        </div>

        <button
          onClick={onExitDJMode}
          className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors border border-slate-700"
        >
          Tilbage til spil
        </button>
      </div>

      {/* Main Turntable Player */}
      <TurntablePlayer
        currentSong={currentSong}
        isRevealed={isRevealed}
        autoPlay={true}
      />

      {/* Center Reveal & Draw Card Actions */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-center gap-4">
        {!isRevealed ? (
          <button
            id="dj-reveal-btn"
            onClick={handleReveal}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white font-bold text-sm tracking-wide shadow-lg shadow-pink-500/25 transition-all flex items-center justify-center gap-2"
          >
            <Eye className="w-5 h-5" />
            <span>Afslør Årstal & Kunstner</span>
          </button>
        ) : (
          <button
            id="dj-next-btn"
            onClick={handleNextCard}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white font-bold text-sm tracking-wide shadow-lg shadow-cyan-500/25 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            <span>Træk Næste Sang ({currentIndex + 1}/{deck.length})</span>
          </button>
        )}
      </div>

      {/* Revealed Card Details & Fun Facts */}
      {isRevealed && currentSong && (
        <div className="flex justify-center animate-in zoom-in-95 duration-300">
          <HitsterCard
            song={currentSong}
            isRevealed={true}
            status="correct"
          />
        </div>
      )}
    </div>
  );
}
