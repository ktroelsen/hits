import { useCallback, useEffect, useRef, useState } from 'react';
import { SongCategory } from '../types';

// "AI-assistent" tab on /admin: describe a song collection ("Billboard: flest uger som
// nr. 1, top 50"), and Claude researches it on the web (server/Ai/AiResearch.cs). The
// proposal is shown for review — matched against the catalog, editable, rows can be
// deselected — and only the kept rows are imported: the tag gets numbers, existing songs
// get the tag and number, and new songs are created inactive (listen to them in Katalog
// before activating them).

type Request = (url: string, init?: RequestInit) => Promise<Response>;

const API = '/api/admin/ai';
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
  value: number;
  title: string;
  artist: string;
  year: number;
  category: SongCategory;
  source: string;
  uncertain: boolean;
  note: string;
  existing: Existing | null;
}

interface Proposal {
  tag: string;
  description: string;
  valuePrefix: string;
  valueSuffix: string;
  notes: string;
  tagExists: boolean;
  tagHasNumbers: boolean;
  items: Omit<Row, 'keep'>[];
}

interface JobState {
  id: string;
  status: 'running' | 'done' | 'failed';
  error: string | null;
  seconds: number;
  searches: number;
  inputTokens: number;
  outputTokens: number;
  proposal: Proposal | null;
}

const EXAMPLES = [
  'Billboard Hot 100: de 50 sange med flest uger som nr. 1',
  'Tjeklisten top 40 over danske sommerhits',
  'Rolling Stones liste over de 100 bedste sange nogensinde (2021)',
];

const inputBase =
  'rounded-lg bg-slate-800 px-2 py-1 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-pink-500';
const buttonCls =
  'rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40';
const labelCls = 'text-xs uppercase tracking-wide text-slate-400';

export function AdminAi({ request }: { request: Request }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [prompt, setPrompt] = useState('');
  const [job, setJob] = useState<JobState | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState({ tag: '', description: '', valuePrefix: '', valueSuffix: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    request(`${API}/status`)
      .then((r) => (r.ok ? r.json() : { configured: false }))
      .then((d) => setConfigured(!!d.configured))
      .catch(() => setConfigured(false));
    return () => {
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [request]);

  const poll = useCallback(
    async (id: string) => {
      try {
        const res = await request(`${API}/research/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: JobState = await res.json();
        setJob(data);
        if (data.status === 'running') {
          pollRef.current = window.setTimeout(() => poll(id), POLL_MS);
          return;
        }
        if (data.proposal) {
          const p = data.proposal;
          setMeta({ tag: p.tag, description: p.description, valuePrefix: p.valuePrefix, valueSuffix: p.valueSuffix });
          setRows(p.items.map((i) => ({ ...i, keep: true })));
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
      const res = await request(`${API}/research`, { method: 'POST', body: JSON.stringify({ prompt }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setJob({ id: data.id, status: 'running', error: null, seconds: 0, searches: 0, inputTokens: 0, outputTokens: 0, proposal: null });
      pollRef.current = window.setTimeout(() => poll(data.id), POLL_MS);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const kept = rows.filter((r) => r.keep);
  const keptNew = kept.filter((r) => !r.existing).length;

  const apply = async () => {
    if (!meta.tag.trim() || kept.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await request(`${API}/apply`, {
        method: 'POST',
        body: JSON.stringify({
          ...meta,
          items: kept.map((r) => ({
            value: r.value,
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
        `Importeret i "${data.tag}": ${data.updated} eksisterende sange fik tag og tal, ${data.created} nye sange oprettet som inaktive. ` +
          (data.created > 0 ? 'Find dem i Katalog (filtrér på tagget og "Kun inaktive"), lyt dem igennem og aktivér dem. ' : '') +
          (data.inactive ? 'Tagget er nyt og derfor inaktivt — aktivér det under Tags, når playlisten er færdig.' : ''),
      );
      setRows([]);
      setJob(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (v: number) => `${meta.valuePrefix}${v}${meta.valueSuffix}`;
  const running = job?.status === 'running';

  return (
    <section className="rounded-xl bg-slate-900 p-5 ring-1 ring-slate-800">
      <p className="mb-4 text-xs text-slate-400">
        Beskriv en samling sange, så finder AI'en listen på nettet med tal (placering, antal uger …), årstal og
        kategori. Du gennemgår forslaget, før noget gemmes. Eksisterende sange får tag og tal; nye sange oprettes som{' '}
        <strong>inaktive</strong>, så du kan lytte dem igennem først.
      </p>

      {configured === false && (
        <p className="mb-4 rounded-lg bg-amber-950/60 px-3 py-2 text-sm text-amber-200 ring-1 ring-amber-800">
          AI er ikke konfigureret på serveren. Sæt en Anthropic API-nøgle i <code>Anthropic__ApiKey</code> (eller{' '}
          <code>ANTHROPIC_API_KEY</code>) og genstart serveren.
        </p>
      )}

      <label className="block">
        <span className={labelCls}>Hvilke sange?</span>
        <textarea
          className={`${inputBase} mt-1 h-20 w-full px-3 py-2`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={EXAMPLES[0]}
          disabled={running}
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            className="rounded-full px-2.5 py-0.5 text-xs text-slate-400 ring-1 ring-slate-700 hover:ring-slate-500"
            onClick={() => setPrompt(ex)}
            disabled={running}
          >
            {ex}
          </button>
        ))}
        <button
          className="ml-auto rounded-lg bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-500 disabled:opacity-40"
          disabled={busy || running || configured === false || prompt.trim().length < 5}
          onClick={start}
        >
          {running ? 'Researcher…' : 'Find sangene'}
        </button>
      </div>

      {error && <p className="mt-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>}
      {result && <p className="mt-3 rounded-lg bg-emerald-950/60 px-3 py-2 text-sm text-emerald-200">{result}</p>}

      {job && (
        <p className="mt-3 text-xs text-slate-400">
          {running
            ? `AI'en søger og tjekker kilder … ${job.seconds} s (typisk 1–3 min)`
            : job.status === 'failed'
            ? `Fejlede efter ${job.seconds} s: ${job.error}`
            : `Færdig på ${job.seconds} s`}
          {job.searches > 0 && ` · ${job.searches} søgninger`}
          {job.outputTokens > 0 && ` · ${job.inputTokens.toLocaleString('da-DK')} / ${job.outputTokens.toLocaleString('da-DK')} tokens`}
        </p>
      )}

      {job?.proposal && rows.length > 0 && (
        <div className="mt-5">
          {job.proposal.notes && (
            <p className="mb-3 rounded-lg bg-sky-950/60 px-3 py-2 text-xs text-sky-200 ring-1 ring-sky-800">
              💡 {job.proposal.notes}
            </p>
          )}

          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2 block sm:col-span-1">
              <span className={labelCls}>Tag</span>
              <input className={`${inputBase} w-full`} value={meta.tag} onChange={(e) => setMeta({ ...meta, tag: e.target.value })} />
            </label>
            <label className="block">
              <span className={labelCls}>Før tallet</span>
              <input
                className={`${inputBase} w-full`}
                value={meta.valuePrefix}
                onChange={(e) => setMeta({ ...meta, valuePrefix: e.target.value })}
              />
            </label>
            <label className="block">
              <span className={labelCls}>Efter tallet</span>
              <input
                className={`${inputBase} w-full`}
                value={meta.valueSuffix}
                onChange={(e) => setMeta({ ...meta, valueSuffix: e.target.value })}
              />
            </label>
            <label className="col-span-2 block sm:col-span-4">
              <span className={labelCls}>Beskrivelse</span>
              <input
                className={`${inputBase} w-full`}
                value={meta.description}
                onChange={(e) => setMeta({ ...meta, description: e.target.value })}
              />
            </label>
          </div>
          {job.proposal.tagExists && (
            <p className="mb-3 text-xs text-amber-300">
              Tagget "{job.proposal.tag}" findes allerede{job.proposal.tagHasNumbers ? ' og har tal' : ''} — sangene lægges
              oven i, og eksisterende tal opdateres.
            </p>
          )}

          <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <span>
              {rows.length} forslag · {rows.filter((r) => r.existing).length} findes i kataloget ·{' '}
              {rows.filter((r) => r.uncertain).length} usikre
            </span>
            <button className="underline hover:text-slate-200" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, keep: true })))}>
              Vælg alle
            </button>
            <button className="underline hover:text-slate-200" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, keep: false })))}>
              Fravælg alle
            </button>
            <button
              className="underline hover:text-slate-200"
              onClick={() => setRows((rs) => rs.map((r) => (r.uncertain ? { ...r, keep: false } : r)))}
            >
              Fravælg usikre
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg ring-1 ring-slate-800">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-950/60 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2" />
                  <th className="px-2 py-2">Tal</th>
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
                      <input
                        className={`${inputBase} w-16`}
                        type="number"
                        value={r.value}
                        onChange={(e) => update(i, { value: Number(e.target.value) })}
                        title={fmt(r.value)}
                      />
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
                      {r.source && (
                        <a
                          href={r.source}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-0.5 block truncate text-xs text-slate-500 underline hover:text-slate-300"
                        >
                          {r.source}
                        </a>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {r.existing ? (
                        <span className={r.existing.year !== r.year ? 'text-amber-300' : 'text-slate-300'} title={r.existing.year !== r.year ? `AI foreslår ${r.year}` : undefined}>
                          {r.existing.year}
                          {r.existing.year !== r.year && <span className="text-xs"> (AI: {r.year})</span>}
                        </span>
                      ) : (
                        <input
                          className={`${inputBase} w-20 ${r.uncertain ? 'ring-amber-600' : ''}`}
                          type="number"
                          value={r.year}
                          onChange={(e) => update(i, { year: Number(e.target.value) })}
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
                      {r.uncertain && <span className="block text-amber-300">⚠ Usikker</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-400">
              {kept.length} valgt · {kept.length - keptNew} får tag og tal · {keptNew} oprettes som nye (inaktive)
            </span>
            <button
              className="ml-auto rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
              disabled={busy || kept.length === 0 || !meta.tag.trim()}
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
