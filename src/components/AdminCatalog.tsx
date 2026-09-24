import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSongAudioPreview } from '../services/audioService';
import { Song, SongCategory } from '../types';

// "Katalog" tab on /admin: every song in the database, with search, preview,
// edit, delete and active toggle. Reads GET /api/songs and writes via PUT/DELETE
// /api/songs/{id} and POST /api/songs/active (all require the admin key, which
// `request` adds). Only active songs are dealt into games.

type Request = (url: string, init?: RequestInit) => Promise<Response>;

interface AdminCatalogProps {
  request: Request;
  /** Called after a change so the page can refresh its song counts. */
  onChanged?: () => void;
}

// Mirrors PreviewRefresher.Status on the server (server/Catalog/PreviewRefresher.cs).
interface RefreshStatus {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  checked: number;
  refreshed: number;
  missing: number;
  skipped: number;
  lastCompletedAt: string | null;
}

const REFRESH_URL = '/api/admin/previews/refresh';

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('da-DK', { dateStyle: 'short', timeStyle: 'short' });

const isActive = (s: Song) => s.active !== false;

const inputCls =
  'w-full rounded-lg bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-pink-500';

export function AdminCatalog({ request, onChanged }: AdminCatalogProps) {
  const [songs, setSongs] = useState<Song[] | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | SongCategory>('all');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [editing, setEditing] = useState<Song | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState<RefreshStatus | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
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

  const loadRefreshStatus = useCallback(async () => {
    try {
      const res = await request(REFRESH_URL);
      if (res.ok) setRefresh(await res.json());
    } catch {
      // status is informational only
    }
  }, [request]);

  useEffect(() => {
    loadRefreshStatus();
  }, [loadRefreshStatus]);

  // Poll while a full refresh runs; reload the catalog once it finishes.
  const running = refresh?.running ?? false;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(loadRefreshStatus, 3000);
    return () => {
      window.clearInterval(timer);
      load();
    };
  }, [running, loadRefreshStatus, load]);

  const startRefresh = async () => {
    try {
      const res = await request(REFRESH_URL, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRefresh(await res.json());
      setError(null);
    } catch (e) {
      setError(`Kunne ikke starte fornyelse: ${(e as Error).message}`);
    }
  };

  const refreshSong = async (song: Song) => {
    setRefreshingId(song.id);
    try {
      const res = await request(`${REFRESH_URL}/${encodeURIComponent(song.id)}`, { method: 'POST' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body: { song: Song; outcome: 'Found' | 'NotFound' | 'Unknown' } = await res.json();
      setSongs((list) => list?.map((s) => (s.id === body.song.id ? body.song : s)) ?? null);
      setError(
        body.outcome === 'Found'
          ? null
          : body.outcome === 'NotFound'
            ? `iTunes har ingen preview for "${song.title}" — uændret.`
            : `iTunes svarede ikke (rate limit?) — prøv igen om et minut.`,
      );
    } catch (e) {
      setError(`Kunne ikke forny: ${(e as Error).message}`);
    } finally {
      setRefreshingId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (songs ?? []).filter(
      (s) =>
        (category === 'all' || s.category === category) &&
        (status === 'all' || (status === 'active') === isActive(s)) &&
        (!q ||
          s.title.toLowerCase().includes(q) ||
          s.artist.toLowerCase().includes(q) ||
          String(s.year).includes(q)),
    );
  }, [songs, query, category, status]);

  const activeCount = useMemo(() => (songs ?? []).filter(isActive).length, [songs]);

  const setActive = async (targets: Song[], active: boolean) => {
    const ids = targets.filter((s) => isActive(s) !== active).map((s) => s.id);
    if (ids.length === 0) return;
    if (ids.length > 1 && !window.confirm(`${active ? 'Aktivér' : 'Deaktivér'} ${ids.length} sange?`)) return;
    setBusy(true);
    try {
      const res = await request('/api/songs/active', {
        method: 'POST',
        body: JSON.stringify({ ids, active }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const changed = new Set(ids);
      setSongs((list) => list?.map((s) => (changed.has(s.id) ? { ...s, active } : s)) ?? null);
      setError(null);
      onChanged?.();
    } catch (e) {
      setError(`Kunne ikke ændre aktiv-status: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

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
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-slate-800/60 px-3 py-2">
        <button
          onClick={startRefresh}
          disabled={running}
          className="rounded-lg bg-pink-600 px-3 py-1.5 text-sm font-bold hover:bg-pink-500 disabled:opacity-40"
        >
          {running ? 'Fornyer…' : 'Forny previews'}
        </button>
        <p className="text-xs text-slate-400">
          {running && refresh
            ? `Tjekker… ${refresh.checked} sange gennemgået, ${refresh.refreshed} fornyet`
            : refresh?.finishedAt
              ? `Sidst kørt ${formatTime(refresh.finishedAt)}: ${refresh.refreshed} fornyet, ${refresh.missing} uden preview, ${refresh.skipped} sprunget over`
              : refresh?.lastCompletedAt
                ? `Sidst kørt ${formatTime(refresh.lastCompletedAt)} · kører automatisk hver uge`
                : 'Døde preview-links fornyes automatisk hver uge.'}
        </p>
      </div>

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
        <select
          className={`${inputCls} w-auto py-2`}
          value={status}
          onChange={(e) => setStatus(e.target.value as 'all' | 'active' | 'inactive')}
        >
          <option value="all">Aktive og inaktive</option>
          <option value="active">Kun aktive</option>
          <option value="inactive">Kun inaktive</option>
        </select>
      </div>

      {error && <p className="mb-3 text-sm text-amber-400">{error}</p>}
      {!songs && !error && <p className="text-sm text-slate-400">Henter katalog…</p>}
      {songs && (
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <p className="flex-1">
            Viser {filtered.length} af {songs.length} sange · {activeCount} aktive i spillene
          </p>
          <button
            onClick={() => setActive(filtered, true)}
            disabled={busy || filtered.every(isActive)}
            className="rounded-lg px-2 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            Aktivér viste
          </button>
          <button
            onClick={() => setActive(filtered, false)}
            disabled={busy || !filtered.some(isActive)}
            className="rounded-lg px-2 py-1 text-slate-300 hover:bg-slate-800 disabled:opacity-40"
          >
            Deaktivér viste
          </button>
        </div>
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
            <li key={song.id} className={`flex items-center gap-3 py-2 ${isActive(song) ? '' : 'opacity-50'}`}>
              <input
                type="checkbox"
                checked={isActive(song)}
                onChange={(e) => setActive([song], e.target.checked)}
                disabled={busy}
                title={isActive(song) ? 'Aktiv — spilles i spillene' : 'Inaktiv — spilles ikke'}
                className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-500"
              />
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
                onClick={() => refreshSong(song)}
                disabled={busy || refreshingId !== null}
                title="Slå preview og cover op i iTunes igen"
                className="rounded-lg px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40"
              >
                {refreshingId === song.id ? '…' : 'Forny'}
              </button>
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
