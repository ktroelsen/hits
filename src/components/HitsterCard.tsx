import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, Sparkles, CheckCircle2, XCircle } from 'lucide-react';
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
    fetchSongAudioPreview(song.artist, song.title).then((res) => {
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
      className={`relative w-44 sm:w-48 h-64 sm:h-72 rounded-2xl p-4 flex flex-col justify-between select-none shadow-xl transition-all duration-300 transform group hover:-translate-y-1.5 hover:shadow-2xl border ${
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

      {/* Top Bar: Year & Origin Flag */}
      <div className="relative z-10 flex items-start justify-between">
        <div className="flex flex-col">
          {isRevealed ? (
            <div className="flex items-center gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-white tracking-tight drop-shadow font-display">
                {song.year}
              </span>
            </div>
          ) : (
            <div className="text-xl sm:text-2xl font-black text-slate-400 font-mono tracking-widest">
              ????
            </div>
          )}
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded mt-0.5 w-fit ${decadeStyle.badge}`}>
            {song.decade}
          </span>
        </div>

        {/* Right side: Claimed by team / starter card badge & Flag */}
        <div className="flex flex-col items-end gap-1">
          <span
            className="text-lg px-2 py-0.5 rounded-lg bg-slate-950/60 border border-slate-700/60 shadow-sm"
            title={song.category === 'danish' ? 'Dansk hit' : 'Internationalt hit'}
          >
            {song.category === 'danish' ? '🇩🇰' : '🌍'}
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
              <span className="truncate max-w-[65px]">{claimedBy.name}</span>
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

      {/* Center: Vinyl disc mini art or music icon */}
      <div className="relative z-10 my-auto flex flex-col items-center justify-center">
        <div className="relative w-16 h-16 rounded-full bg-slate-950 border-2 border-slate-700/80 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
          {/* Concentric lines */}
          <div className="absolute inset-2 rounded-full border border-slate-800 pointer-events-none" />
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-pink-500 to-amber-400 flex items-center justify-center">
            <div className="w-2 h-2 rounded-full bg-slate-950" />
          </div>

          {/* Quick Play Button on Card */}
          <button
            onClick={handlePlayCard}
            className={`absolute inset-0 rounded-full bg-slate-950/70 hover:bg-slate-950/40 flex items-center justify-center text-white transition-opacity backdrop-blur-xs ${
              isPlayingAudio ? 'opacity-100 ring-2 ring-pink-500' : 'opacity-0 group-hover:opacity-100'
            }`}
            title={isPlayingAudio ? 'Pause sang' : 'Lyt til sang'}
          >
            {isPlayingAudio ? (
              <Pause className="w-5 h-5 text-pink-400 fill-current" />
            ) : (
              <Play className="w-5 h-5 text-white ml-0.5 fill-current" />
            )}
          </button>
        </div>

        {status === 'correct' && (
          <div className="flex items-center gap-1 mt-2 text-emerald-400 text-xs font-bold bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-500/40">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Korrekt!</span>
          </div>
        )}

        {status === 'wrong' && (
          <div className="flex items-center gap-1 mt-2 text-rose-400 text-xs font-bold bg-rose-950/80 px-2 py-0.5 rounded-full border border-rose-500/40">
            <XCircle className="w-3.5 h-3.5" />
            <span>Forkert</span>
          </div>
        )}
      </div>

      {/* Bottom Info: Title, Artist & Trivia snippet */}
      <div className="relative z-10 mt-auto pt-2 border-t border-slate-800/80">
        <h4 className="font-bold text-white text-sm line-clamp-1 group-hover:text-pink-300 transition-colors">
          {song.title}
        </h4>
        <p className="text-slate-300 text-xs line-clamp-1 font-medium">
          {song.artist}
        </p>
        {song.funFact && (
          <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-tight italic">
            "{song.funFact}"
          </p>
        )}
      </div>
    </div>
  );
}
