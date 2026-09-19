import { useEffect, useRef, useState, useCallback, type InputHTMLAttributes } from 'react';
import { fetchSongAudioPreview } from '../services/audioService';
import { SongCategory } from '../types';

// Local-only curation tool (route: /admin). Reads the candidate pool and writes
// approved songs straight into src/data/songs.ts via the Vite dev API in
// scripts/adminServer.ts. It ONLY works under `npm run dev`; the deployed static
// site has no write API. Workflow: curate here → git commit → deploy.

const GOAL = 500;
const API = '/api/admin';

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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadState = useCallback(async () => {
    try {
      const res = await fetch(`${API}/state`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: AdminState = await res.json();
      setState(data);
      setQueue(data.candidates);
      if (data.candidates.length > 0) setDraft(draftFromCandidate(data.candidates[0]));
      setError(null);
    } catch {
      setError(
        'Kunne ikke nå admin-API\'et. Denne side virker kun lokalt via "npm run dev" — ' +
          'produktion er en ren statisk app uden skrive-adgang.',
      );
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, []);

  const audition = useCallback(async () => {
    stopAudio();
    setPreview({ loading: true, tried: false });
    const res = await fetchSongAudioPreview({ artist: draft.artist, title: draft.title });
    setPreview({ url: res.previewUrl, artwork: res.artworkUrl, loading: false, tried: true });
    if (res.previewUrl) {
      const audio = new Audio(res.previewUrl);
      audioRef.current = audio;
      audio.play().catch(() => {});
    }
  }, [draft.artist, draft.title, stopAudio]);

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
      const res = await fetch(`${API}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
  }, [draft, preview, manualMode, advance]);

  const reject = useCallback(async () => {
    if (!draft.candidateId) {
      advance();
      return;
    }
    setBusy(true);
    try {
      await fetch(`${API}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <input
        className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-pink-500"
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
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-extrabold">
            🎛️ Sang-admin <span className="text-slate-500 text-base font-normal">(kun lokalt)</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Auditionér kandidater og vælg hvilke der ryger i kataloget. Godkendte sange skrives
            direkte i <code className="text-pink-400">songs.ts</code> — husk at committe bagefter.
          </p>
        </header>

        {error && (
          <div className="rounded-xl bg-amber-950/60 p-4 text-amber-200 ring-1 ring-amber-800">{error}</div>
        )}

        {state && (
          <>
            <section className="mb-6 rounded-xl bg-slate-900 p-4 ring-1 ring-slate-800">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">
                  {total} / {GOAL} sange
                </span>
                <span className="text-slate-400">
                  🇩🇰 {state.counts.danish} · 🌍 {state.counts.international}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-gradient-to-r from-pink-500 to-blue-500" style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-slate-500">
                <span>{remaining} kandidater tilbage i køen</span>
                <span>
                  ✓ {state.decided.approved} godkendt · ✗ {state.decided.rejected} afvist
                </span>
              </div>
            </section>

            <section className="rounded-xl bg-slate-900 p-5 ring-1 ring-slate-800">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-bold">
                  {manualMode ? 'Tilføj egen sang' : `Kandidat${draft.candidateId ? ` (${draft.candidateId})` : ''}`}
                </h2>
                <button
                  className="text-xs text-slate-400 underline hover:text-slate-200"
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
                  <span className="text-xs uppercase tracking-wide text-slate-400">Kategori</span>
                  <select
                    className="mt-1 w-full rounded-lg bg-slate-800 px-3 py-2 text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-pink-500"
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
                <p className="mt-3 text-xs text-slate-500">💡 {queue[0].note}</p>
              )}

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={audition}
                  disabled={busy || !draft.title || !draft.artist}
                  className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-600 disabled:opacity-40"
                >
                  {preview.loading ? 'Henter…' : '▶ Afspil preview'}
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
                      className="rounded-lg bg-slate-700 px-4 py-3 font-semibold hover:bg-slate-600 disabled:opacity-40"
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

              {message && <p className="mt-4 text-sm text-slate-300">{message}</p>}
              {!manualMode && queue.length === 0 && (
                <p className="mt-4 text-sm text-emerald-400">
                  Alle kandidater er gennemgået! Tilføj evt. dine egne sange ovenfor.
                </p>
              )}
            </section>

            <p className="mt-6 text-center text-xs text-slate-600">
              Efter en session: <code className="text-slate-400">git add -A &amp;&amp; git commit</code> og deploy.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
