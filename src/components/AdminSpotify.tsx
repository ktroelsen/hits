import { useCallback, useEffect, useRef, useState } from 'react';
import { SongCategory } from '../types';

// "Spotify" tab on /admin: paste a link to a public Spotify playlist. The server reads
// its songs (server/Spotify/SpotifyPlaylist.cs) and Claude finds each song's original
// release year — Spotify only knows the album's, often a remaster or compilation. The
// rows are shown for review (years editable, rows can be deselected) and the kept ones
// are imported as a tag: existing songs get the tag, new songs are created inactive
// (listen to them in Katalog before activating them), and a new tag starts inactive.

type Request = (url: string, init?: RequestInit) => Promise<Response>;

const API = '/api/admin/spotify';
const POLL_MS = 3000;

interface Existing {
  id: string;
  title: string;
  artist: string;
  year: number;
  active: boolean;
  tags: string[];
}

interface Row {
  keep: boolean;
  title: string;
  artist: string;
  year: number;
  category: SongCategory;
  uncertain: boolean;
  note: string;
  existing: Existing | null;
}

interface JobState {
  id: string;
  status: 'running' | 'done' | 'failed';
  error: string | null;
  seconds: number;
  searches: number;
  inputTokens: number;
  outputTokens: number;
  aiConfigured: boolean;
  name: string;
  tag: string;
  tagExists: boolean;
  trackCount: number;
  truncated: boolean;
  rows: Omit<Row, 'keep'>[] | null;
}

const inputBase =
  'rounded-lg bg-slate-800 px-2 py-1 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-pink-500';
const buttonCls =
  'rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40';
const labelCls = 'text-xs uppercase tracking-wide text-slate-400';

const validYear = (y: number) => y >= 1900 && y <= 2100;

export function AdminSpotify({ request }: { request: Request }) {
  const [url, setUrl] = useState('');
  const [job, setJob] = useState<JobState | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [tag, setTag] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    },
    [],
  );

  const poll = useCallback(
    async (id: string) => {
      try {
        const res = await request(`${API}/job/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: JobState = await res.json();
        setJob(data);
        if (data.status === 'running') {
          pollRef.current = window.setTimeout(() => poll(id), POLL_MS);
          return;
        }
        if (data.rows) {
          setTag(data.tag);
          setRows(data.rows.map((r) => ({ ...r, keep: true })));
        }
      } catch (e) {
        setError(`Kunne ikke hente status: ${(e as Error).message}`);
      }
    },
    [request],
  );

  const start = async () => {
    setError(null);
    setResult(null);
    setRows([]);
    setJob(null);
    setBusy(true);
    try {
      const res = await request(`${API}/preview`, { method: 'POST', body: JSON.stringify({ url }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      await poll(data.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const kept = rows.filter((r) => r.keep);
  const keptNew = kept.filter((r) => !r.existing);
  // New songs need a year before they can be created.
  const missingYears = keptNew.filter((r) => !validYear(r.year)).length;

  const apply = async () => {
    if (!tag.trim() || kept.length === 0 || missingYears > 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await request(`${API}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          tag,
          items: kept.map((r) => ({
            title: r.title,
            artist: r.artist,
            year: r.year,
            category: r.category,
            existingId: r.existing?.id ?? null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setResult(
        `Importeret i "${data.tag}": ${data.updated} eksisterende sange fik tagget, ${data.created} nye sange oprettet som inaktive. ` +
          (data.created > 0 ? 'Find dem i Katalog (filtrér på tagget og "Kun inaktive"), lyt dem igennem og aktivér dem. ' : '') +
          (data.inactive ? 'Tagget er nyt og derfor inaktivt — aktivér det under Tags, når listen er færdig.' : ''),
      );
      setRows([]);
      setJob(null);
      setUrl('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const running = job?.status === 'running';

  return (
    <section className="rounded-xl bg-slate-900 p-5 ring-1 ring-slate-800">
      <p className="mb-4 text-xs text-slate-400">
        Indsæt et link til en <strong>offentlig</strong> Spotify-playliste. Sangene hentes, og AI'en finder hver sangs
        oprindelige udgivelsesår. Du gennemgår listen, før noget gemmes. Sangene samles i et tag (en liste, man kan
        vælge i spillet); eksisterende sange får tagget, nye oprettes som <strong>inaktive</strong>, så du kan lytte dem
        igennem først.
      </p>

      <label className="block">
        <span className={labelCls}>Playliste-link</span>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row">
          <input
            className={`${inputBase} w-full px-3 py-2`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && url.trim() && !busy && !running && start()}
            placeholder="https://open.spotify.com/playlist/…"
            disabled={running}
          />
          <button
            className="shrink-0 rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-500 disabled:opacity-40"
            disabled={busy || running || !url.trim()}
            onClick={start}
          >
            {busy ? 'Henter…' : running ? 'Finder årstal…' : 'Hent playliste'}
          </button>
        </div>
      </label>

      {error && <p className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>}
      {result && <p className="mt-3 rounded-lg bg-emerald-950/60 px-3 py-2 text-sm text-emerald-200">{result}</p>}

      {job && (
        <p className="mt-3 text-xs text-slate-400">
          <strong className="text-slate-200">{job.name}</strong> · {job.trackCount} sange ·{' '}
          {running
            ? `AI'en finder årstal … ${job.seconds} s (typisk 1–3 min)`
            : job.status === 'failed'
            ? `Årsopslag fejlede efter ${job.seconds} s: ${job.error} — udfyld årene selv.`
            : !job.aiConfigured
            ? 'AI er ikke konfigureret på serveren — udfyld årene selv.'
            : `Årstal fundet på ${job.seconds} s`}
          {job.searches > 0 && ` · ${job.searches} søgninger`}
          {job.outputTokens > 0 && ` · ${job.inputTokens.toLocaleString('da-DK')} / ${job.outputTokens.toLocaleString('da-DK')} tokens`}
        </p>
      )}
      {job?.truncated && (
        <p className="mt-2 rounded-lg bg-amber-950/60 px-3 py-2 text-xs text-amber-200 ring-1 ring-amber-800">
          Spotify viser kun de første {job.trackCount} sange af en offentlig playliste. Er listen længere, så del den op i
          flere playlister med højst {job.trackCount} sange og importér dem i samme tag.
        </p>
      )}

      {job && !running && rows.length > 0 && (
        <div className="mt-5">
          <label className="mb-3 block max-w-sm">
            <span className={labelCls}>Tag (listens navn)</span>
            <input className={`${inputBase} w-full`} value={tag} onChange={(e) => setTag(e.target.value)} />
          </label>
          {job.tagExists && tag.trim().toLowerCase() === job.tag && (
            <p className="mb-3 text-xs text-amber-300">Tagget "{job.tag}" findes allerede — sangene lægges oven i.</p>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>
              {rows.length} sange · {rows.filter((r) => r.existing).length} findes i kataloget ·{' '}
              {rows.filter((r) => !r.existing && r.uncertain).length} usikre år
            </span>
            <button className="underline hover:text-slate-200" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, keep: true })))}>
              Vælg alle
            </button>
            <button className="underline hover:text-slate-200" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, keep: false })))}>
              Fravælg alle
            </button>
            <button
              className="underline hover:text-slate-200"
              onClick={() => setRows((rs) => rs.map((r) => (!r.existing && r.uncertain ? { ...r, keep: false } : r)))}
            >
              Fravælg usikre
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg ring-1 ring-slate-800">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-950/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2" />
                  <th className="px-2 py-2">Kunstner – titel</th>
                  <th className="px-2 py-2">År</th>
                  <th className="px-2 py-2">Kategori</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((r, i) => (
                  <tr key={i} className={r.keep ? '' : 'opacity-40'}>
                    <td className="px-2 py-1.5 align-top">
                      <input type="checkbox" checked={r.keep} onChange={(e) => update(i, { keep: e.target.checked })} />
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {r.existing ? (
                        <span className="text-slate-200">
                          {r.existing.artist} – {r.existing.title}
                        </span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          <input className={`${inputBase} w-full`} value={r.artist} onChange={(e) => update(i, { artist: e.target.value })} />
                          <input className={`${inputBase} w-full`} value={r.title} onChange={(e) => update(i, { title: e.target.value })} />
                        </div>
                      )}
                      {r.note && <p className="mt-0.5 text-xs text-amber-300">{r.note}</p>}
                      {r.existing && r.existing.tags.length > 0 && (
                        <p className="mt-0.5 text-xs text-slate-500">{r.existing.tags.join(', ')}</p>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {r.existing ? (
                        <span
                          className={r.year && r.existing.year !== r.year ? 'text-amber-300' : 'text-slate-300'}
                          title={r.year && r.existing.year !== r.year ? `AI foreslår ${r.year}` : undefined}
                        >
                          {r.existing.year}
                          {r.year > 0 && r.existing.year !== r.year && <span className="text-xs"> (AI: {r.year})</span>}
                        </span>
                      ) : (
                        <input
                          className={`${inputBase} w-20 ${!validYear(r.year) ? 'ring-red-600' : r.uncertain ? 'ring-amber-600' : ''}`}
                          type="number"
                          value={r.year || ''}
                          placeholder="År"
                          onChange={(e) => update(i, { year: Number(e.target.value), uncertain: false })}
                        />
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {r.existing ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <select
                          className={inputBase}
                          value={r.category}
                          onChange={(e) => update(i, { category: e.target.value as SongCategory })}
                        >
                          <option value="international">International</option>
                          <option value="danish">Dansk</option>
                        </select>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top text-xs">
                      {r.existing ? (
                        <span className="text-emerald-300">✓ Findes{r.existing.active ? '' : ' (inaktiv)'}</span>
                      ) : (
                        <span className="text-cyan-300">+ Ny</span>
                      )}
                      {!r.existing && r.uncertain && <span className="block text-amber-300">⚠ Tjek året</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-400">
              {kept.length} valgt · {kept.length - keptNew.length} får tagget · {keptNew.length} oprettes som nye (inaktive)
              {missingYears > 0 && <span className="text-red-300"> · {missingYears} nye mangler år</span>}
            </span>
            <button
              className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
              disabled={busy || kept.length === 0 || !tag.trim() || missingYears > 0}
              onClick={apply}
            >
              Importér {kept.length} sange
            </button>
            <button className={buttonCls} disabled={busy} onClick={() => setRows([])}>
              Kassér
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
