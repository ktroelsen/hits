import { useState, useRef, useEffect } from 'react';
import { Play, Pause, CheckCircle2, XCircle } from 'lucide-react';
import { Song } from '../types';
import { fetchSongAudioPreview } from '../services/audioService';

interface HitsterCardProps {
  song: Song;
  isRevealed?: boolean;
  isWinningCard?: boolean;
  status?: 'correct' | 'wrong' | 'neutral' | 'active';
  showDetails?: boolean;
  onPlaySong?: (song: Song) => void;
  claimedBy?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

const DECADE_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  '60s': { bg: 'from-amber-900/60 to-slate-900', border: 'border-amber-700/60', badge: 'bg-amber-600 text-amber-100' },
  '70s': { bg: 'from-orange-900/60 to-slate-900', border: 'border-orange-700/60', badge: 'bg-orange-600 text-orange-100' },
  '80s': { bg: 'from-pink-900/60 to-purple-900/80', border: 'border-pink-600/60', badge: 'bg-pink-600 text-pink-100' },
  '90s': { bg: 'from-cyan-900/60 to-blue-900/80', border: 'border-cyan-600/60', badge: 'bg-cyan-600 text-cyan-100' },
  '00s': { bg: 'from-emerald-900/60 to-teal-900/80', border: 'border-emerald-600/60', badge: 'bg-emerald-600 text-emerald-100' },
  '10s': { bg: 'from-indigo-900/60 to-violet-900/80', border: 'border-indigo-600/60', badge: 'bg-indigo-600 text-indigo-100' },
  '20s': { bg: 'from-fuchsia-900/60 to-rose-900/80', border: 'border-fuchsia-600/60', badge: 'bg-fuchsia-600 text-fuchsia-100' },
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
  const decadeStyle = DECADE_COLORS[song.decade] || DECADE_COLORS['80s'];

  useEffect(() => {
    return () => {
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
      audioRef.current.pause();
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
        } else {
          audioRef.current.src = res.previewUrl;
        }
        audioRef.current.currentTime = 0;
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
          ? 'ring-4 ring-pink-500/90 border-pink-400 bg-pink-950/30 shadow-pink-500/20'
          : `${decadeStyle.border} bg-gradient-to-b ${decadeStyle.bg}`
      }`}
    >
      {/* Background vinyl texture sheen */}
      <div className="absolute inset-0 rounded-2xl bg-slate-900/30 backdrop-blur-sm pointer-events-none" />

      {/* Play / pause — fixed in the card's top-right corner */}
      <button
        onClick={handlePlayCard}
        className={`absolute top-1.5 right-1.5 z-20 flex items-center justify-center w-7 h-7 rounded-full border transition-colors shadow ${
          isPlayingAudio
            ? 'bg-pink-600 border-pink-400 text-white ring-2 ring-pink-500/40'
            : 'bg-slate-950/80 border-slate-600/70 text-white hover:bg-pink-950/80 hover:border-pink-500/60'
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
          <span className="text-base sm:text-lg font-black text-slate-400 font-mono tracking-widest">
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
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-semibold bg-slate-900/80 border border-slate-700/70 text-slate-300"
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
      <div className="relative z-10 mt-auto pt-1.5 border-t border-slate-800/80">
        <h4 className="font-bold text-white text-sm leading-snug line-clamp-2 group-hover:text-pink-300 transition-colors">
          {song.title}
        </h4>
        <p className="text-slate-300 text-xs line-clamp-1 font-medium mt-0.5">
          {song.artist}
        </p>
      </div>
    </div>
  );
}
