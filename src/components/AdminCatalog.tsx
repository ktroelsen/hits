import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSongAudioPreview } from '../services/audioService';
import { Song, SongCategory } from '../types';

// "Katalog" tab on /admin: every song in the database, with search, preview,
// edit and delete. Reads GET /api/songs and writes via PUT/DELETE /api/songs/{id}
// (both require the admin key, which `request` adds).

type Request = (url: string, init?: RequestInit) => Promise<Response>;

interface AdminCatalogProps {
  request: Request;
  /** Called after a change so the page can refresh its song counts. */
  onChanged?: () => void;
}

const inputCls =
  'w-full rounded-lg bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-pink-500';

export function AdminCatalog({ request, onChanged }: AdminCatalogProps) {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | SongCategory>('all');
  const [editing, setEditing] = useState<Song | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/songs');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSongs(await res.json());
      setError(null);
    } catch (e) {
      setError(`Kunne ikke hente kataloget: ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    load();
    return () => audioRef.current?.pause();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (songs ?? []).filter(
      (s) =>
        (category === 'all' || s.category === category) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          String(s.year).includes(q)),
    );
  }, [songs, query, category]);

  const togglePlay = async (song: Song) => {
    audioRef.current?.pause();
    if (playingId === song.id) {
      setPlayingId(null);
      return;
    }
    const res = await fetchSongAudioPreview(song);
    if (!res.previewUrl) {
      setError(`Ingen preview fundet for "${song.title}".`);
      return;
    }
    const audio = new Audio(res.previewUrl);
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(song.id);
    audio.play().catch(() => setPlayingId(null));
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.title.trim() || !editing.artist.trim() || !editing.year) {
      setError('Titel, kunstner og årstal skal udfyldes.');
      return;
    }
    setBusy(true);
    try {
      const res = await request(`/api/songs/${encodeURIComponent(editing.id)}`, {
        method: 'PUT',
        body: JSON.stringify(editing),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved: Song = await res.json();
      setSongs((list) => list?.map((s) => (s.id === saved.id ? saved : s)) ?? null);
      setEditing(null);
      setError(null);
      onChanged?.();
    } catch (e) {
      setError(`Kunne ikke gemme: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (song: Song) => {
    if (!window.confirm(`Slet "${song.title}" af ${song.artist} fra kataloget?`)) return;
    setBusy(true);
    try {
      const res = await request(`/api/songs/${encodeURIComponent(song.id)}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
      setSongs((list) => list?.filter((s) => s.id !== song.id) ?? null);
      if (editing?.id === song.id) setEditing(null);
      setError(null);
      onChanged?.();
    } catch (e) {
      setError(`Kunne ikke slette: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl bg-slate-900 p-5 ring-1 ring-slate-800">
      <div className="mb-4 flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Søg titel, kunstner eller år…"
          className={`${inputCls} flex-1 min-w-[12rem] py-2`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className={`${inputCls} w-auto py-2`}
          value={category}
          onChange={(e) => setCategory(e.target.value as 'all' | SongCategory)}
        >
          <option value="all">Alle</option>
          <option value="danish">🇩🇰 Danske</option>
          <option value="international">🌍 Internationale</option>
        </select>
      </div>

      {error && <p className="mb-3 text-sm text-amber-400">{error}</p>}
      {!songs && !error && <p className="text-sm text-slate-400">Henter katalog…</p>}
      {songs && (
        <p className="mb-2 text-xs text-slate-500">
          Viser {filtered.length} af {songs.length} sange
        </p>
      )}

      <ul className="divide-y divide-slate-800">
        {filtered.map((song) =>
          editing?.id === song.id ? (
            <li key={song.id} className="space-y-2 py-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  className={inputCls}
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Titel"
                />
                <input
                  className={inputCls}
                  value={editing.artist}
                  onChange={(e) => setEditing({ ...editing, artist: e.target.value })}
                  placeholder="Kunstner"
                />
                <input
                  className={inputCls}
                  type="number"
                  inputMode="numeric"
                  value={editing.year || ''}
                  onChange={(e) => setEditing({ ...editing, year: Number(e.target.value) })}
                  placeholder="Årstal"
                />
                <select
                  className={inputCls}
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value as SongCategory })}
                >
                  <option value="international">International</option>
                  <option value="danish">Dansk</option>
                </select>
                <input
                  className={inputCls}
                  value={editing.genre ?? ''}
                  onChange={(e) => setEditing({ ...editing, genre: e.target.value || undefined })}
                  placeholder="Genre (valgfri)"
                />
                <input
                  className={inputCls}
                  value={editing.funFact ?? ''}
                  onChange={(e) => setEditing({ ...editing, funFact: e.target.value || undefined })}
                  placeholder="Fun fact (valgfri)"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={busy}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-bold hover:bg-emerald-500 disabled:opacity-40"
                >
                  Gem
                </button>
                <button
                  onClick={() => setEditing(null)}
                  disabled={busy}
                  className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-semibold hover:bg-slate-600"
                >
                  Annullér
                </button>
              </div>
            </li>
          ) : (
            <li key={song.id} className="flex items-center gap-3 py-2">
              <button
                onClick={() => togglePlay(song)}
                title="Afspil preview"
                className="h-8 w-8 shrink-0 rounded-full bg-slate-800 text-sm hover:bg-slate-700"
              >
                {playingId === song.id ? '⏸' : '▶'}
              </button>
              {song.artworkUrl ? (
                <img src={song.artworkUrl} alt="" className="h-9 w-9 shrink-0 rounded" />
              ) : (
                <div className="h-9 w-9 shrink-0 rounded bg-slate-800" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{song.title}</p>
                <p className="truncate text-xs text-slate-400">
                  {song.artist} · {song.category === 'danish' ? '🇩🇰' : '🌍'}
                </p>
              </div>
              <span className="font-mono text-sm font-black text-pink-400">{song.year}</span>
              <button
                onClick={() => setEditing({ ...song })}
                disabled={busy}
                className="rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                Redigér
              </button>
              <button
                onClick={() => remove(song)}
                disabled={busy}
                className="rounded-lg px-2 py-1 text-xs text-rose-400 hover:bg-rose-950/60"
              >
                Slet
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}
