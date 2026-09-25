import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, ExternalLink, Music2, Eye, EyeOff, Disc3, Shuffle, AlertTriangle, Trash2 } from 'lucide-react';
import { Song } from '../types';
import { appleMusicUrl, fetchSongAudioPreview, sfx } from '../services/audioService';
import { attachFadeEnvelope, fadeOutAndPause, resetFade } from '../services/audioFade';

interface TurntablePlayerProps {
  currentSong: Song | null;
  isRevealed: boolean;
  onPlaySong?: () => void;
  onOpenSongPicker?: () => void;
  onDrawRandomSong?: () => void;
  onMarkMissingMusic?: () => void;
  autoPlay?: boolean;
}

export function TurntablePlayer({
  currentSong,
  isRevealed,
  onPlaySong,
  onOpenSongPicker,
  onDrawRandomSong,
  onMarkMissingMusic,
  autoPlay = true,
}: TurntablePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(30);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [blindMode, setBlindMode] = useState(true); // Hide title & artist until placed by default

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  useEffect(() => {
    if (!audioRef.current) return;
    return attachFadeEnvelope(audioRef.current, () => volumeRef.current);
  }, []);

  // Load preview when currentSong changes
  useEffect(() => {
    let isCancelled = false;

    if (!currentSong) {
      setPreviewUrl(null);
      setArtworkUrl(null);
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    setCurrentTime(0);

    fetchSongAudioPreview(currentSong).then((res) => {
      if (isCancelled) return;
      setIsLoading(false);
      setPreviewUrl(res.previewUrl || null);
      setArtworkUrl(res.artworkUrl || null);

      if (autoPlay && res.previewUrl && audioRef.current) {
        audioRef.current.src = res.previewUrl;
        audioRef.current.currentTime = 0;
        resetFade(audioRef.current);
        audioRef.current.play().then(() => {
          setIsPlaying(true);
          sfx.playNeedleDrop();
        }).catch(() => {
          // Autoplay policy might require click
          setIsPlaying(false);
        });
      }
    });

    return () => {
      isCancelled = true;
      if (audioRef.current) {
        fadeOutAndPause(audioRef.current);
      }
    };
  }, [currentSong, autoPlay]);

  // Handle audio play/pause
  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      fadeOutAndPause(audioRef.current);
      setIsPlaying(false);
    } else {
      sfx.playNeedleDrop();
      if (onPlaySong) onPlaySong();

      if (previewUrl) {
        if (audioRef.current.src !== previewUrl) {
          audioRef.current.src = previewUrl;
        }
        resetFade(audioRef.current);
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setIsPlaying(false);
        });
      }
    }
  }, [isPlaying, previewUrl, onPlaySong]);

  const handleRestart = () => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = 0;
    setCurrentTime(0);
    if (!isPlaying) {
      resetFade(audioRef.current);
      audioRef.current.play().then(() => setIsPlaying(true));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (val > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioRef.current.muted = nextMuted;
  };

  const appleUrl = currentSong ? appleMusicUrl(currentSong.artist, currentSong.title) : '#';
  const spotifyUrl = currentSong 
    ? `https://open.spotify.com/search/${encodeURIComponent(currentSong.artist + ' ' + currentSong.title)}`
    : '#';
  const youtubeUrl = currentSong
    ? `https://www.youtube.com/results?search_query=${encodeURIComponent(currentSong.artist + ' ' + currentSong.title)}`
    : '#';

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div id="turntable-player" className="bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 md:p-3 shadow-2xl relative overflow-hidden backdrop-blur-md">
      {/* Background neon ambient lights */}
      <div className="absolute -top-20 -left-20 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        preload="auto"
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 items-center">
        {/* Left: Vinyl Turntable Graphic with Tone Arm */}
        <div className="hidden lg:flex md:col-span-2 flex-col items-center justify-center">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Turntable Platter Base */}
            <div className="absolute inset-0 rounded-full bg-slate-950/80 border-4 border-slate-800 shadow-inner flex items-center justify-center">
              {/* Slipmat dots */}
              <div className="absolute inset-2 rounded-full border border-dashed border-slate-700/40" />
            </div>

            {/* Vinyl Record */}
            <div
              className={`relative w-20 h-20 rounded-full shadow-2xl flex items-center justify-center transition-transform ${
                isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''
              }`}
              style={{
                background: 'radial-gradient(circle, #1e293b 0%, #0f172a 40%, #020617 75%, #000000 100%)',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7), inset 0 0 10px rgba(255, 255, 255, 0.1)'
              }}
            >
              {/* Vinyl Grooves concentric rings */}
              <div className="absolute inset-2 rounded-full border border-slate-700/20 pointer-events-none" />
              <div className="absolute inset-4 rounded-full border border-slate-700/25 pointer-events-none" />
              <div className="absolute inset-6 rounded-full border border-slate-700/20 pointer-events-none" />
              <div className="absolute inset-8 rounded-full border border-slate-700/30 pointer-events-none" />
              <div className="absolute inset-10 rounded-full border border-slate-700/20 pointer-events-none" />

              {/* Vinyl Center Label (Sticker) */}
              <div
                className="w-10 h-10 rounded-full border-2 border-slate-900 flex items-center justify-center relative overflow-hidden shadow-md"
                style={{
                  background: isRevealed && artworkUrl 
                    ? `url(${artworkUrl}) center/cover no-repeat` 
                    : 'radial-gradient(circle, #ec4899 0%, #a855f7 60%, #4f46e5 100%)'
                }}
              >
                {!isRevealed && (
                  <div className="text-[9px] font-black text-white tracking-widest text-center uppercase drop-shadow">
                    HITS
                  </div>
                )}
                {/* Spindle hole */}
                <div className="w-2.5 h-2.5 rounded-full bg-slate-950 border border-slate-600 shadow-inner z-10" />
              </div>
            </div>

            {/* Tone Arm Graphic */}
            <div
              className={`absolute top-1 right-1 w-6 h-20 origin-top-right transition-transform duration-700 pointer-events-none ${
                isPlaying ? 'rotate-[22deg]' : 'rotate-0'
              }`}
            >
              {/* Pivot */}
              <div className="w-3 h-3 rounded-full bg-slate-400 border border-slate-200 shadow ml-auto" />
              {/* Arm Rod */}
              <div className="w-1 h-14 bg-gradient-to-b from-slate-400 via-slate-300 to-slate-400 mx-auto rounded-full -mt-1 shadow-sm" />
              {/* Cartridge head */}
              <div className="w-2.5 h-4 bg-pink-500 rounded-sm mx-auto shadow -mt-1 border border-pink-400" />
            </div>
          </div>
        </div>

        {/* Center & Right: Player Controls, Song Metadata & Timeline Helpers */}
        <div className="md:col-span-12 lg:col-span-10 flex flex-col justify-between space-y-1.5">
          {/* Header Row: Category Badge & Blind Mode Toggle */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center gap-1.5">
                <Disc3 className={`w-3.5 h-3.5 ${isPlaying ? 'animate-spin' : ''}`} />
                {currentSong?.category === 'danish' ? '🇩🇰 Dansk Hit' : '🌍 Internationalt Hit'}
              </span>

              <span className="text-xs text-slate-400 bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-700/60">
                {currentSong?.genre || 'Pop / Rock'}
              </span>
            </div>

            {/* Blind mode switch for party & authentic Hitster play */}
            <button
              id="toggle-blind-mode-btn"
              onClick={() => setBlindMode(!blindMode)}
              className="text-xs flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
              title="I HITS gætter man ud fra lyden alene! Skjul eller vis titlen"
            >
              {blindMode ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-pink-400" />
                  <span>Skjul sangtitel (Blindt)</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Viser sangtitel</span>
                </>
              )}
            </button>
          </div>

          {/* Song Info (Blurred or Hidden if Blind Mode and not revealed) */}
          <div className="min-h-[30px] flex flex-col justify-center">
            {isRevealed ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 flex items-baseline gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-white tracking-tight font-display">
                  {currentSong?.title}
                </h3>
                <span className="text-base sm:text-lg font-extrabold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-lg border border-amber-400/30">
                  {currentSong?.year}
                </span>
                <span className="text-slate-300 text-sm font-medium">
                  {currentSong?.artist}
                </span>
              </div>
            ) : blindMode ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg sm:text-xl font-black text-slate-300 tracking-wide font-display">
                  🎵 Mysterie Sang
                </span>
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                  Årstal skjult: ????
                </span>
              </div>
            ) : (
              <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight font-display">
                  {currentSong?.title}
                </h3>
                <span className="text-slate-300 text-sm font-medium">
                  {currentSong?.artist} • <span className="text-amber-400 font-bold">Årstal: ????</span>
                </span>
              </div>
            )}
          </div>

          {/* Audio Scrubber / Progress Bar */}
          <div className="w-full bg-slate-800/80 rounded-full h-2 overflow-hidden relative cursor-pointer group">
            <div
              className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 h-full rounded-full transition-all duration-150"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Missing-music warning: iTunes returned no preview for this song */}
          {currentSong && !isLoading && !previewUrl && (
            <div className="flex items-center justify-between flex-wrap gap-2 px-3 py-2 rounded-xl bg-amber-950/40 border border-amber-700/50 text-amber-200 text-xs">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                Ingen musik fundet for denne sang.
              </span>
              {onMarkMissingMusic && (
                <button
                  id="mark-missing-music-btn"
                  onClick={onMarkMissingMusic}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white font-bold transition-colors"
                  title="Skjul sangen fra spillet og markér den til permanent fjernelse"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Markér som mangler musik
                </button>
              )}
            </div>
          )}

          {/* Action & Transport Controls */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              {/* Play / Pause Main Button */}
              <button
                id="play-pause-btn"
                onClick={togglePlay}
                disabled={isLoading}
                className={`flex items-center gap-2 px-5 py-2 rounded-2xl font-bold text-sm tracking-wide transition-all duration-200 shadow-lg ${
                  isPlaying
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 ring-4 ring-amber-500/20'
                    : 'bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white ring-4 ring-pink-500/20 hover:scale-[1.02]'
                } ${isLoading ? 'opacity-70 cursor-wait' : ''}`}
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                    <span>{currentTime > 0 ? 'Fortsæt' : 'Afspil sang'}</span>
                  </>
                )}
              </button>

              {/* Replay 30s button */}
              <button
                id="replay-song-btn"
                onClick={handleRestart}
                className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors border border-slate-700/80"
                title="Start sangen forfra"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Draw new random song button */}
              {onDrawRandomSong && (
                <button
                  id="draw-random-song-btn"
                  onClick={onDrawRandomSong}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-800/90 hover:bg-purple-950/70 text-slate-300 hover:text-purple-300 border border-slate-700 hover:border-purple-500/50 transition-colors text-xs font-bold"
                  title="Træk en ny tilfældig sang"
                >
                  <Shuffle className="w-4 h-4 text-purple-400" />
                  <span className="hidden sm:inline">Træk ny</span>
                </button>
              )}

              {/* Volume & Mute */}
              <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/80 rounded-2xl border border-slate-700/60">
                <button
                  id="mute-btn"
                  onClick={toggleMute}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  id="volume-slider"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
                />
              </div>
            </div>

            {/* External Links for Party Play */}
            <div className="flex items-center gap-2">
              <a
                id="apple-music-external-link"
                href={appleUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-pink-300 hover:text-pink-200 bg-pink-950/40 hover:bg-pink-950/70 border border-pink-800/50 px-3 py-1.5 rounded-xl transition-colors font-medium"
                title="Lyt til hele sangen på Apple Music"
              >
                <Music2 className="w-3.5 h-3.5" />
                <span>Apple Music</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>

              <a
                id="spotify-external-link"
                href={spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-800/50 px-3 py-1.5 rounded-xl transition-colors font-medium"
                title="Lyt til hele sangen på Spotify"
              >
                <Music2 className="w-3.5 h-3.5" />
                <span>Spotify</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>

              <a
                id="youtube-external-link"
                href={youtubeUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/50 px-3 py-1.5 rounded-xl transition-colors font-medium"
                title="Søg på YouTube"
              >
                <span>YouTube</span>
                <ExternalLink className="w-3 h-3 opacity-60" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
