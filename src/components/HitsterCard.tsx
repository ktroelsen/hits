import { useState, useRef, useEffect } from 'react';
import { Play, Pause, CheckCircle2, XCircle } from 'lucide-react';
import { Decade } from '../types';
import { fetchSongAudioPreview } from '../services/audioService';
import { attachFadeEnvelope, fadeOutAndPause, resetFade } from '../services/audioFade';

// Only the fields the card actually renders/plays — lets callers pass either a full
// catalog Song or a lighter timeline entry (e.g. the online game's TimelineSong).
export interface CardSong {
  id: string;
  title: string;
  artist: string;
  year: number;
  decade: Decade;
  artworkUrl?: string;
  previewUrl?: string;
  customPreviewUrl?: string;
}

interface HitsterCardProps {
  song: CardSong;
  isRevealed?: boolean;
  isWinningCard?: boolean;
  status?: 'correct' | 'wrong' | 'neutral' | 'active';
  showDetails?: boolean;
  onPlaySong?: (song: CardSong) => void;
  claimedBy?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

// Mirrors decadeForYear in scripts/songsFile.ts / server/Admin/AdminEndpoints.cs.
export function decadeForYear(year: number): Decade {
  if (year < 1960) return '50s';
  if (year < 1970) return '60s';
  if (year < 1980) return '70s';
  if (year < 1990) return '80s';
  if (year < 2000) return '90s';
  if (year < 2010) return '00s';
  if (year < 2020) return '10s';
  return '20s';
}

export const DECADE_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  '50s': { bg: 'from-red-900/60 to-charcoal-900', border: 'border-red-700/60', badge: 'bg-red-700 text-red-100' },
  '60s': { bg: 'from-amber-900/60 to-charcoal-900', border: 'border-amber-700/60', badge: 'bg-amber-600 text-amber-100' },
  '70s': { bg: 'from-orange-900/60 to-charcoal-900', border: 'border-orange-700/60', badge: 'bg-orange-600 text-orange-100' },
  '80s': { bg: 'from-coral-900/60 to-charcoal-900', border: 'border-coral-600/60', badge: 'bg-coral-600 text-coral-100' },
  '90s': { bg: 'from-mint-900/60 to-charcoal-900', border: 'border-mint-600/60', badge: 'bg-mint-600 text-mint-100' },
  '00s': { bg: 'from-emerald-900/60 to-charcoal-900', border: 'border-emerald-600/60', badge: 'bg-emerald-600 text-emerald-100' },
  '10s': { bg: 'from-lemon-900/60 to-charcoal-900', border: 'border-lemon-500/60', badge: 'bg-lemon-400 text-lemon-950' },
  '20s': { bg: 'from-blue-900/60 to-charcoal-900', border: 'border-blue-500/60', badge: 'bg-blue-600 text-blue-100' },
};

export function HitsterCard({
  song,
  isRevealed = true,
  status = 'neutral',
  onPlaySong,
  claimedBy,
}: HitsterCardProps) {
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const detachFadeRef = useRef<(() => void) | null>(null);
  const decadeStyle = DECADE_COLORS[song.decade] || DECADE_COLORS['80s'];

  useEffect(() => {
    return () => {
      detachFadeRef.current?.();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handlePlayCard = (e: React.MouseEvent) => {
    e.stopPropagation();

    // If already playing, pause it
    if (audioRef.current && isPlayingAudio) {
      fadeOutAndPause(audioRef.current);
      setIsPlayingAudio(false);
      return;
    }

    if (onPlaySong) {
      onPlaySong(song);
      return;
    }

    // Direct snippet playback fallback
    fetchSongAudioPreview(song).then((res) => {
      if (res.previewUrl) {
        if (!audioRef.current) {
          audioRef.current = new Audio(res.previewUrl);
          detachFadeRef.current = attachFadeEnvelope(audioRef.current);
        } else {
          audioRef.current.src = res.previewUrl;
        }
        audioRef.current.currentTime = 0;
        resetFade(audioRef.current);
        audioRef.current.play().then(() => {
          setIsPlayingAudio(true);
        }).catch(() => {
          setIsPlayingAudio(false);
        });

        audioRef.current.onended = () => setIsPlayingAudio(false);
      }
    });
  };

  return (
    <div
      id={`hitster-card-${song.id}`}
      className={`relative w-24 sm:w-28 h-32 overflow-hidden rounded-2xl p-2 flex flex-col justify-between select-none shadow-xl transition-all duration-300 transform group hover:-translate-y-1.5 hover:shadow-2xl border ${
        status === 'correct'
          ? 'ring-4 ring-emerald-500/80 border-emerald-400 bg-emerald-950/40'
          : status === 'wrong'
          ? 'ring-4 ring-rose-500/80 border-rose-400 bg-rose-950/40'
          : status === 'active'
          ? 'ring-4 ring-coral-500/90 border-coral-400 bg-coral-950/30 shadow-coral-500/20'
          : `${decadeStyle.border} bg-gradient-to-b ${decadeStyle.bg}`
      }`}
    >
      {/* Background vinyl texture sheen */}
      <div className="absolute inset-0 rounded-2xl bg-charcoal-900/30 backdrop-blur-sm pointer-events-none" />

      {/* Play / pause — fixed in the card's top-right corner */}
      <button
        onClick={handlePlayCard}
        className={`absolute top-1.5 right-1.5 z-20 flex items-center justify-center w-7 h-7 rounded-full border transition-colors shadow ${
          isPlayingAudio
            ? 'bg-coral-600 border-coral-400 text-white ring-2 ring-coral-500/40'
            : 'bg-charcoal-950/80 border-charcoal-600/70 text-white hover:bg-coral-950/80 hover:border-coral-500/60'
        }`}
        title={isPlayingAudio ? 'Pause sang' : 'Lyt til sang'}
      >
        {isPlayingAudio ? (
          <Pause className="w-3.5 h-3.5 fill-current" />
        ) : (
          <Play className="w-3.5 h-3.5 ml-0.5 fill-current" />
        )}
      </button>

      {/* Top: Year + decade & owner badges (kept clear of the play button) */}
      <div className="relative z-10 pr-8">
        {isRevealed ? (
          <span className="text-lg sm:text-xl font-black text-white tracking-tight drop-shadow font-display">
            {song.year}
          </span>
        ) : (
          <span className="text-base sm:text-lg font-black text-charcoal-400 font-mono tracking-widest">
            ????
          </span>
        )}
        <div className="flex flex-wrap items-center gap-1 mt-0.5">
          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${decadeStyle.badge}`}>
            {song.decade}
          </span>
          {claimedBy ? (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold border shadow-xs"
              style={{
                backgroundColor: `${claimedBy.color}25`,
                borderColor: `${claimedBy.color}70`,
                color: '#ffffff',
              }}
              title={`Vundet af ${claimedBy.name}`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: claimedBy.color }}
              />
              <span className="truncate max-w-[60px]">{claimedBy.name}</span>
            </div>
          ) : isRevealed ? (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-charcoal-900/80 border border-charcoal-700/70 text-charcoal-300"
              title="Fælles startkort på tidslinjen"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span>Startkort</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Optional result badge (only when a status is set, e.g. in modals) */}
      {(status === 'correct' || status === 'wrong') && (
        <div className="relative z-10 flex justify-center">
          {status === 'correct' ? (
            <div className="flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Korrekt!</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-rose-400 text-xs font-bold bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-500/40">
              <XCircle className="w-3.5 h-3.5" />
              <span>Forkert</span>
            </div>
          )}
        </div>
      )}

      {/* Bottom Info: Title & Artist — gets the room freed by removing the disc */}
      <div className="relative z-10 mt-auto pt-1.5 border-t border-charcoal-800/80">
        <h4 className="font-bold text-white text-sm leading-snug line-clamp-2 group-hover:text-coral-300 transition-colors">
          {song.title}
        </h4>
        <p className="text-charcoal-300 text-xs line-clamp-1 font-medium mt-0.5">
          {song.artist}
        </p>
      </div>
    </div>
  );
}
