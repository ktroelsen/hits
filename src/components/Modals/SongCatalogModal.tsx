import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { X, Search, Play, Pause, Disc, Trash2, ClipboardCopy } from 'lucide-react';
import { getActiveSongs } from '../../services/songsService';
import { getRemovedIds, clearRemoved } from '../../services/removalStore';
import { fetchSongAudioPreview } from '../../services/audioService';
import { Song } from '../../types';

interface SongCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMarkMissingMusic?: (song: Song) => void;
  removedTick?: number;
}

export function SongCatalogModal({
  isOpen,
  onClose,
  onMarkMissingMusic,
  removedTick = 0,
}: SongCatalogModalProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'danish' | 'international'>('all');
  const [decade, setDecade] = useState<string>('all');
  const [localTick, setLocalTick] = useState(0);

  // Inline 30s preview playback (auditions a song without leaving the library)
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopPreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  // Stop audio when the modal closes or unmounts.
  useEffect(() => {
    if (!isOpen) stopPreview();
    return () => stopPreview();
  }, [isOpen, stopPreview]);

  const togglePreview = useCallback(
    (song: Song) => {
      if (playingId === song.id) {
        stopPreview();
        return;
      }
      stopPreview();
      fetchSongAudioPreview(song).then((res) => {
        if (!res.previewUrl) return;
        const audio = new Audio(res.previewUrl);
        audioRef.current = audio;
        audio.onended = () => setPlayingId(null);
        audio.play().then(() => setPlayingId(song.id)).catch(() => setPlayingId(null));
      });
    },
    [playingId, stopPreview]
  );

  const activeSongs = useMemo(() => getActiveSongs(), [removedTick, localTick]);
  const removedIds = useMemo(() => [...getRemovedIds()], [removedTick, localTick]);

  const filteredSongs = useMemo(() => {
    return activeSongs.filter((s) => {
      const matchSearch =
        search === '' ||
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.artist.toLowerCase().includes(search.toLowerCase()) ||
        s.year.toString().includes(search);
      const matchCat = category === 'all' || s.category === category;
      const matchDec = decade === 'all' || s.decade === decade;
      return matchSearch && matchCat && matchDec;
    }).sort((a, b) => a.year - b.year);
  }, [activeSongs, search, category, decade]);

  const copyRemovedIds = () => {
    try {
      navigator.clipboard?.writeText(removedIds.join(','));
    } catch {
      // ignore
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-charcoal-900 border border-charcoal-800 rounded-3xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-charcoal-800">
          <div>
            <h3 className="text-xl font-black text-white font-display flex items-center gap-2">
              <Disc className="w-5 h-5 text-coral-400" />
              HITS Sangbibliotek ({activeSongs.length} sange)
            </h3>
            <p className="text-xs text-charcoal-400">
              Søg i biblioteket og lyt til 30-sekunders uddrag
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-charcoal-400 hover:text-white hover:bg-charcoal-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="py-4 space-y-3 border-b border-charcoal-800">
          <div className="relative">
            <Search className="w-4 h-4 text-charcoal-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søg på sangtitel, kunstner eller årstal..."
              className="w-full bg-charcoal-950 border border-charcoal-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-charcoal-100 placeholder-charcoal-500 focus:outline-none focus:border-coral-500"
            />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              {(['all', 'danish', 'international'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg font-bold border transition-colors ${
                    category === cat
                      ? 'bg-coral-600 border-coral-500 text-white'
                      : 'bg-charcoal-950/60 border-charcoal-800 text-charcoal-400 hover:text-charcoal-200'
                  }`}
                >
                  {cat === 'all' ? 'Alle' : cat === 'danish' ? '🇩🇰 Danske' : '🌍 Internationale'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1">
              {['all', '50s', '60s', '70s', '80s', '90s', '00s', '10s', '20s'].map((dec) => (
                <button
                  key={dec}
                  onClick={() => setDecade(dec)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                    decade === dec
                      ? 'bg-lemon-400 border-lemon-300 text-charcoal-950 font-bold'
                      : 'bg-charcoal-950/40 border-charcoal-800 text-charcoal-400 hover:text-charcoal-200'
                  }`}
                >
                  {dec === 'all' ? 'Alle årtier' : dec}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Songs List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-2 pr-1">
          {filteredSongs.length === 0 ? (
            <div className="text-center py-12 text-charcoal-500 text-sm">
              Ingen sange matchede dine søgekriterier.
            </div>
          ) : (
            filteredSongs.map((song) => (
              <div
                key={song.id}
                className="flex items-center justify-between p-3 rounded-xl bg-charcoal-950/50 border border-charcoal-800/80 hover:border-charcoal-700 transition-colors group flex-wrap sm:flex-nowrap gap-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-base font-black text-amber-400 font-mono w-14 text-center bg-charcoal-900 px-2 py-1 rounded border border-charcoal-800 shrink-0">
                    {song.year}
                  </span>

                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-charcoal-100 group-hover:text-coral-300 transition-colors truncate">
                      {song.title}
                    </span>
                    <span className="text-xs text-charcoal-400 truncate">
                      {song.artist} • {song.category === 'danish' ? '🇩🇰 Dansk' : '🌍 International'} • {song.genre}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  <button
                    onClick={() => togglePreview(song)}
                    className={`p-2 rounded-xl transition-all ${
                      playingId === song.id
                        ? 'bg-coral-600 text-white ring-2 ring-coral-500/40'
                        : 'bg-charcoal-800 hover:bg-lemon-400 text-charcoal-300 hover:text-charcoal-950'
                    }`}
                    title={playingId === song.id ? 'Pause forhåndsvisning' : 'Spil forhåndsvisning'}
                  >
                    {playingId === song.id ? (
                      <Pause className="w-4 h-4 fill-current" />
                    ) : (
                      <Play className="w-4 h-4 fill-current" />
                    )}
                  </button>

                  {onMarkMissingMusic && (
                    <button
                      onClick={() => onMarkMissingMusic(song)}
                      className="p-2 rounded-xl bg-charcoal-800 hover:bg-rose-600 text-charcoal-400 hover:text-white transition-all"
                      title="Markér som mangler musik og skjul fra spillet"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Songs marked for removal — copy ids to run `npm run prune-songs -- --ids=...` */}
        {removedIds.length > 0 && (
          <div className="mt-3 pt-3 border-t border-charcoal-800">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-rose-300">
                Markeret til fjernelse ({removedIds.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyRemovedIds}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-200 text-[11px] font-bold transition-colors"
                  title="Kopiér id-listen til npm run prune-songs -- --ids=..."
                >
                  <ClipboardCopy className="w-3.5 h-3.5" />
                  Kopiér id-liste
                </button>
                <button
                  onClick={() => {
                    clearRemoved();
                    setLocalTick((t) => t + 1);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-charcoal-800 hover:bg-charcoal-700 text-charcoal-400 text-[11px] font-bold transition-colors"
                  title="Fortryd alle markeringer (gendan sangene)"
                >
                  Nulstil
                </button>
              </div>
            </div>
            <code className="block text-[11px] text-charcoal-400 font-mono break-all bg-charcoal-950/60 rounded-lg px-2.5 py-1.5 border border-charcoal-800">
              {removedIds.join(', ')}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
