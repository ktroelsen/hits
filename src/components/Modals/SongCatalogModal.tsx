import { useState, useMemo } from 'react';
import { X, Search, Play, Disc, Trash2, ClipboardCopy } from 'lucide-react';
import { getActiveSongs } from '../../services/songsService';
import { getRemovedIds, clearRemoved } from '../../services/removalStore';
import { Song } from '../../types';

interface SongCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlaySong: (song: Song) => void;
  onSelectAsQuizSong?: (song: Song) => void;
  onMarkMissingMusic?: (song: Song) => void;
  removedTick?: number;
}

export function SongCatalogModal({
  isOpen,
  onClose,
  onPlaySong,
  onSelectAsQuizSong,
  onMarkMissingMusic,
  removedTick = 0,
}: SongCatalogModalProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'all' | 'danish' | 'international'>('all');
  const [decade, setDecade] = useState<string>('all');
  const [localTick, setLocalTick] = useState(0);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-xl font-black text-white font-display flex items-center gap-2">
              <Disc className="w-5 h-5 text-pink-400" />
              Hitster Sangbibliotek ({activeSongs.length} sange)
            </h3>
            <p className="text-xs text-slate-400">
              Søg og vælg en bestemt sang til gætteleg eller lyt til uddrag
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filters and Search Bar */}
        <div className="py-4 space-y-3 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Søg på sangtitel, kunstner eller årstal..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-pink-500"
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
                      ? 'bg-pink-600 border-pink-500 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {cat === 'all' ? 'Alle' : cat === 'danish' ? '🇩🇰 Danske' : '🌍 Internationale'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1">
              {['all', '60s', '70s', '80s', '90s', '00s', '10s', '20s'].map((dec) => (
                <button
                  key={dec}
                  onClick={() => setDecade(dec)}
                  className={`px-2 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                    decade === dec
                      ? 'bg-purple-600 border-purple-500 text-white font-bold'
                      : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:text-slate-200'
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
            <div className="text-center py-12 text-slate-500 text-sm">
              Ingen sange matchede dine søgekriterier.
            </div>
          ) : (
            filteredSongs.map((song) => (
              <div
                key={song.id}
                className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800/80 hover:border-slate-700 transition-colors group flex-wrap sm:flex-nowrap gap-2"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-base font-black text-amber-400 font-mono w-14 text-center bg-slate-900 px-2 py-1 rounded border border-slate-800 shrink-0">
                    {song.year}
                  </span>

                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-bold text-slate-100 group-hover:text-pink-300 transition-colors truncate">
                      {song.title}
                    </span>
                    <span className="text-xs text-slate-400 truncate">
                      {song.artist} • {song.category === 'danish' ? '🇩🇰 Dansk' : '🌍 International'} • {song.genre}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  {onSelectAsQuizSong && (
                    <button
                      onClick={() => onSelectAsQuizSong(song)}
                      className="px-3 py-1.5 rounded-xl bg-pink-600/20 hover:bg-pink-600 text-pink-300 hover:text-white border border-pink-500/40 transition-all text-xs font-bold"
                      title="Vælg denne sang som aktiv quiz-sang hvor I gætter årstallet"
                    >
                      Vælg til quiz
                    </button>
                  )}

                  <button
                    onClick={() => onPlaySong(song)}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-purple-600 text-slate-300 hover:text-white transition-all"
                    title="Spil forhåndsvisning"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>

                  {onMarkMissingMusic && (
                    <button
                      onClick={() => onMarkMissingMusic(song)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white transition-all"
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
          <div className="mt-3 pt-3 border-t border-slate-800">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-rose-300">
                Markeret til fjernelse ({removedIds.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={copyRemovedIds}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold transition-colors"
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
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-[11px] font-bold transition-colors"
                  title="Fortryd alle markeringer (gendan sangene)"
                >
                  Nulstil
                </button>
              </div>
            </div>
            <code className="block text-[11px] text-slate-400 font-mono break-all bg-slate-950/60 rounded-lg px-2.5 py-1.5 border border-slate-800">
              {removedIds.join(', ')}
            </code>
          </div>
        )}
      </div>
    </div>
  );
}
