import { useEffect, useRef, useState, useCallback, type InputHTMLAttributes } from 'react';
import { fetchSongAudioPreview } from '../services/audioService';
import { SongCategory } from '../types';
import { AdminCatalog } from './AdminCatalog';

// Curation tool (route: /admin). Reads the candidate pool and writes approved songs
// to the catalog database via the .NET admin API (server/Admin/AdminEndpoints.cs).
// Works both locally and on the deployed site; requests carry the admin key
// (X-Admin-Key), which the user enters once and is remembered in localStorage.

const GOAL = 500;
const API = '/api/admin';
const KEY_STORAGE = 'hits-admin-key';

function readKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

// fetch with the admin key header, for any admin-protected endpoint
function keyedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': readKey(), ...init.headers },
  });
}

function adminFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return keyedFetch(`${API}${path}`, init);
}

interface Candidate {
  id: string;
  title: string;
  artist: string;
  year: number;
  category: SongCategory;
  note?: string;
}

interface AdminState {
  counts: { total: number; danish: number; international: number };
  candidates: Candidate[];
  totalCandidates: number;
  decided: { approved: number; rejected: number };
}

interface Draft {
  candidateId?: string;
  title: string;
  artist: string;
  year: string;
  category: SongCategory;
  genre: string;
  funFact: string;
}

const emptyDraft = (): Draft => ({
  title: '',
  artist: '',
  year: '',
  category: 'international',
  genre: '',
  funFact: '',
});

const draftFromCandidate = (c: Candidate): Draft => ({
  candidateId: c.id,
  title: c.title,
  artist: c.artist,
  year: String(c.year),
  category: c.category,
  genre: '',
  funFact: '',
});

export function AdminPage() {
  const [state, setState] = useState<AdminState | null>(null);
  const [queue, setQueue] = useState<Candidate[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [manualMode, setManualMode] = useState(false);
  const [preview, setPreview] = useState<{ url?: string; artwork?: string; loading: boolean; tried: boolean }>({
    loading: false,
    tried: false,
  });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsKey, setNeedsKey] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [tab, setTab] = useState<'candidates' | 'catalog'>('candidates');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const auditionToken = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const loadState = useCallback(async () => {
    try {
      const res = await adminFetch('/state');
      if (res.status === 401) {
        setNeedsKey(true);
        setError(readKey() ? 'Forkert admin-nøgle.' : null);
        return;
      }
      setNeedsKey(false);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `HTTP ${res.status}`);
      }
      const data: AdminState = await res.json();
      setState(data);
      setQueue(data.candidates);
      if (data.candidates.length > 0) setDraft(draftFromCandidate(data.candidates[0]));
      setError(null);
    } catch (e) {
      setError(`${(e as Error).message} — kunne ikke nå admin-API'et (kører backenden?).`);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const loadCounts = useCallback(async () => {
    const res = await adminFetch('/state').catch(() => null);
    if (!res?.ok) return;
    const data: AdminState = await res.json();
    setState((s) => (s ? { ...s, counts: data.counts } : data));
  }, []);

  const stopAudio = useCallback(() => {
    // Invalidate any in-flight audition so a late fetch can't start playback.
    auditionToken.current++;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  useEffect(() => stopAudio, [stopAudio]);

  const audition = useCallback(async () => {
    if (isPlaying) {
      stopAudio();
      return;
    }
    stopAudio();
    const token = auditionToken.current;
    setPreview({ loading: true, tried: false });
    const res = await fetchSongAudioPreview({ artist: draft.artist, title: draft.title });
    if (token !== auditionToken.current) return;
    setPreview({ url: res.previewUrl, artwork: res.artworkUrl, loading: false, tried: true });
    if (res.previewUrl) {
      const audio = new Audio(res.previewUrl);
      audioRef.current = audio;
      audio.addEventListener('ended', () => {
        if (audioRef.current === audio) stopAudio();
      });
      audio
        .play()
        .then(() => {
          if (audioRef.current === audio) setIsPlaying(true);
        })
        .catch(() => {
          if (audioRef.current === audio) stopAudio();
        });
    }
  }, [draft.artist, draft.title, isPlaying, stopAudio]);

  const advance = useCallback(
    (decidedId?: string) => {
      stopAudio();
      setPreview({ loading: false, tried: false });
      setManualMode(false);
      setQueue((prev) => {
        const next = decidedId ? prev.filter((c) => c.id !== decidedId) : prev.slice(1);
        setDraft(next.length > 0 ? draftFromCandidate(next[0]) : emptyDraft());
        if (next.length === 0 && !decidedId) setManualMode(true);
        return next;
      });
    },
    [stopAudio],
  );

  const skip = useCallback(() => {
    // Move current candidate to the back without recording a decision.
    stopAudio();
    setPreview({ loading: false, tried: false });
    setQueue((prev) => {
      if (prev.length <= 1) return prev;
      const [first, ...rest] = prev;
      const next = [...rest, first];
      setDraft(draftFromCandidate(next[0]));
      return next;
    });
  }, [stopAudio]);

  const approve = useCallback(async () => {
    if (!draft.title.trim() || !draft.artist.trim() || !draft.year.trim()) {
      setMessage('Titel, kunstner og årstal skal udfyldes.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      // Ensure we have a preview to bake in (audition if not done yet).
      let url = preview.url;
      let artwork = preview.artwork;
      if (!preview.tried) {
        const res = await fetchSongAudioPreview({ artist: draft.artist, title: draft.title });
        url = res.previewUrl;
        artwork = res.artworkUrl;
      }
      const res = await adminFetch('/approve', {
        method: 'POST',
        body: JSON.stringify({
          candidateId: draft.candidateId,
          title: draft.title.trim(),
          artist: draft.artist.trim(),
          year: Number(draft.year),
          category: draft.category,
          genre: draft.genre.trim() || undefined,
          funFact: draft.funFact.trim() || undefined,
          previewUrl: url,
          artworkUrl: artwork,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setMessage(
        data.duplicate
          ? `"${draft.title}" findes allerede — sprunget over.`
          : `Tilføjet som ${data.id}: ${draft.artist} – ${draft.title}`,
      );
      setState((s) =>
        s
          ? {
              ...s,
              counts: data.duplicate
                ? s.counts
                : {
                    total: s.counts.total + 1,
                    danish: s.counts.danish + (draft.category === 'danish' ? 1 : 0),
                    international: s.counts.international + (draft.category === 'international' ? 1 : 0),
                  },
              decided: { ...s.decided, approved: s.decided.approved + 1 },
            }
          : s,
      );
      if (manualMode) {
        stopAudio();
        setDraft(emptyDraft());
        setPreview({ loading: false, tried: false });
      } else {
        advance(draft.candidateId);
      }
    } catch (e) {
      setMessage(`Fejl: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [draft, preview, manualMode, advance, stopAudio]);

  const reject = useCallback(async () => {
    if (!draft.candidateId) {
      advance();
      return;
    }
    setBusy(true);
    try {
      await adminFetch('/reject', {
        method: 'POST',
        body: JSON.stringify({ candidateId: draft.candidateId }),
      });
      setState((s) => (s ? { ...s, decided: { ...s.decided, rejected: s.decided.rejected + 1 } } : s));
      advance(draft.candidateId);
    } finally {
      setBusy(false);
    }
  }, [draft.candidateId, advance]);

  const field = (label: string, value: string, onChange: (v: string) => void, extra?: InputHTMLAttributes<HTMLInputElement>) => (
    <label className="block">
      <span className="text-xs uppercase tracking-wide text-charcoal-400">{label}</span>
      <input
        className="mt-1 w-full rounded-lg bg-charcoal-800 px-3 py-2 text-charcoal-100 outline-none ring-1 ring-charcoal-700 focus:ring-coral-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...extra}
      />
    </label>
  );

  const total = state?.counts.total ?? 0;
  const pct = Math.min(100, Math.round((total / GOAL) * 100));
  const remaining = queue.length;

  return (
    <div className="min-h-screen bg-charcoal-950 px-4 py-8 text-charcoal-100">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold">
            🎛️ Sang-admin
          </h1>
          <p className="mt-1 text-sm text-charcoal-400">
            Auditionér kandidater og vælg hvilke der ryger i kataloget. Godkendte sange gemmes
            direkte i <code className="text-coral-400">databasen</code> og er live med det samme.
          </p>
        </header>

        {needsKey && (
          <form
            className="mb-4 flex gap-2 rounded-xl bg-charcoal-900 p-4 ring-1 ring-charcoal-800"
            onSubmit={(e) => {
              e.preventDefault();
              try {
                localStorage.setItem(KEY_STORAGE, keyInput.trim());
              } catch {}
              loadState();
            }}
          >
            <input
              type="password"
              placeholder="Admin-nøgle"
              className="flex-1 rounded-lg bg-charcoal-800 px-3 py-2 text-charcoal-100 outline-none ring-1 ring-charcoal-700 focus:ring-coral-500"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
            />
            <button className="rounded-lg bg-coral-600 px-4 py-2 font-semibold hover:bg-coral-500">Log ind</button>
          </form>
        )}

        {error && (
          <div className="rounded-xl bg-amber-950/60 p-4 text-amber-200 ring-1 ring-amber-800">{error}</div>
        )}

        {state && (
          <>
            <section className="mb-6 rounded-xl bg-charcoal-900 p-4 ring-1 ring-charcoal-800">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">
                  {total} / {GOAL} sange
                </span>
                <span className="text-charcoal-400">
                  🇩🇰 {state.counts.danish} · 🌍 {state.counts.international}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-charcoal-800">
                <div className="h-full bg-gradient-to-r from-coral-500 to-blue-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-charcoal-500">
                <span>{remaining} kandidater tilbage i køen</span>
                <span>
                  ✓ {state.decided.approved} godkendt · ✗ {state.decided.rejected} afvist
                </span>
              </div>
            </section>

            <div className="mb-4 flex gap-1 rounded-xl bg-charcoal-900 p-1 ring-1 ring-charcoal-800">
              {[
                { id: 'candidates' as const, label: `Kandidater (${remaining})` },
                { id: 'catalog' as const, label: `Katalog (${total})` },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    stopAudio();
                    setTab(t.id);
                  }}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                    tab === t.id ? 'bg-coral-600 text-white' : 'text-charcoal-400 hover:bg-charcoal-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'catalog' && <AdminCatalog request={keyedFetch} onChanged={loadCounts} />}

            {tab === 'candidates' && (
            <section className="rounded-xl bg-charcoal-900 p-5 ring-1 ring-charcoal-800">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold">
                  {manualMode ? 'Tilføj egen sang' : `Kandidat${draft.candidateId ? ` (${draft.candidateId})` : ''}`}
                </h2>
                <button
                  className="text-xs text-charcoal-400 underline hover:text-charcoal-200"
                  onClick={() => {
                    stopAudio();
                    setManualMode((m) => !m);
                    if (!manualMode) {
                      setDraft(emptyDraft());
                      setPreview({ loading: false, tried: false });
                    } else if (queue.length > 0) {
                      setDraft(draftFromCandidate(queue[0]));
                    }
                  }}
                >
                  {manualMode ? 'Tilbage til kandidater' : '+ Tilføj egen sang'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {field('Titel', draft.title, (v) => setDraft((d) => ({ ...d, title: v })))}
                {field('Kunstner', draft.artist, (v) => setDraft((d) => ({ ...d, artist: v })))}
                {field('Årstal', draft.year, (v) => setDraft((d) => ({ ...d, year: v })), {
                  type: 'number',
                  inputMode: 'numeric',
                })}
                <label className="block">
                  <span className="text-xs uppercase tracking-wide text-charcoal-400">Kategori</span>
                  <select
                    className="mt-1 w-full rounded-lg bg-charcoal-800 px-3 py-2 text-charcoal-100 outline-none ring-1 ring-charcoal-700 focus:ring-coral-500"
                    value={draft.category}
                    onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as SongCategory }))}
                  >
                    <option value="international">International</option>
                    <option value="danish">Dansk</option>
                  </select>
                </label>
                {field('Genre (valgfri)', draft.genre, (v) => setDraft((d) => ({ ...d, genre: v })))}
                {field('Fun fact (valgfri)', draft.funFact, (v) => setDraft((d) => ({ ...d, funFact: v })))}
              </div>

              {!manualMode && draft.candidateId && queue[0]?.note && (
                <p className="mt-3 text-xs text-charcoal-500">💡 {queue[0].note}</p>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={audition}
                  disabled={!isPlaying && (busy || preview.loading || !draft.title || !draft.artist)}
                  className="rounded-lg bg-charcoal-700 px-4 py-2 text-sm font-semibold hover:bg-charcoal-600 disabled:opacity-40"
                >
                  {preview.loading ? 'Henter…' : isPlaying ? '■ Stop preview' : '▶ Afspil preview'}
                </button>
                {preview.tried && !preview.url && (
                  <span className="text-sm text-amber-400">Ingen preview fundet hos iTunes</span>
                )}
                {preview.artwork && (
                  <img src={preview.artwork} alt="" className="h-10 w-10 rounded shadow" />
                )}
              </div>

              <div className="mt-5 flex gap-3">
                <button
                  onClick={approve}
                  disabled={busy}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 font-bold hover:bg-emerald-500 disabled:opacity-40"
                >
                  ✓ Tilføj til kataloget
                </button>
                {!manualMode && (
                  <>
                    <button
                      onClick={skip}
                      disabled={busy || queue.length <= 1}
                      className="rounded-lg bg-charcoal-700 px-4 py-3 font-semibold hover:bg-charcoal-600 disabled:opacity-40"
                    >
                      ↷ Spring over
                    </button>
                    <button
                      onClick={reject}
                      disabled={busy}
                      className="rounded-lg bg-rose-700 px-4 py-3 font-semibold hover:bg-rose-600 disabled:opacity-40"
                    >
                      ✗ Afvis
                    </button>
                  </>
                )}
              </div>

              {message && <p className="mt-4 text-sm text-charcoal-300">{message}</p>}
              {!manualMode && queue.length === 0 && (
                <p className="mt-4 text-sm text-emerald-400">
                  Alle kandidater er gennemgået! Tilføj evt. dine egne sange ovenfor.
                </p>
              )}
            </section>
            )}

            <p className="mt-6 text-center text-xs text-charcoal-600">
              Ændringer gemmes direkte i databasen — ingen commit eller deploy nødvendig.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
