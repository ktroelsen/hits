import { useCallback, useEffect, useMemo, useState } from 'react';
import { Song } from '../types';
import { formatRank, RankedTag } from '../services/rankedTags';

// "Tags med tal" tab on /admin: tags whose songs also have a number, e.g. "top 100"
// (placement) or "billboard uger" (weeks at #1). The tag decides which songs are in the
// collection; the number lets it be played as a placement game. Giving a song a number
// here also gives it the tag, and "Fjern" takes off both. Reads GET /api/ranked-tags and
// /api/songs; writes via the admin-keyed endpoints in server/Tags/RankedTagEndpoints.cs.

type Request = (url: string, init?: RequestInit) => Promise<Response>;

interface ImportResult {
  matched: { line: number; value: number; songId: string; artist: string; title: string; year: number }[];
  unmatched: { line: number; text: string; reason: string }[];
}

const API = '/api/ranked-tags';
const inputBase =
  'rounded-lg bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-pink-500';
const inputCls = `w-full ${inputBase}`;
const buttonCls =
  'rounded-lg bg-slate-800 px-3 py-1.5 text-sm text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40';
const labelCls = 'text-xs uppercase tracking-wide text-slate-400';

const enc = encodeURIComponent;
const emptyMeta = { tag: '', description: '', valuePrefix: '#', valueSuffix: '' };

export function AdminRankedTags({ request }: { request: Request }) {
  const [ranked, setRanked] = useState<RankedTag[] | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [meta, setMeta] = useState(emptyMeta);
  const [search, setSearch] = useState('');
  const [newValue, setNewValue] = useState('');
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([fetch(API), fetch('/api/songs')]);
      if (!r.ok || !s.ok) throw new Error(`HTTP ${r.ok ? s.status : r.status}`);
      setRanked(await r.json());
      setSongs(await s.json());
      setError(null);
    } catch (e) {
      setError(`Kunne ikke hente tags med tal: ${(e as Error).message}`);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = ranked?.find((t) => t.tag === selected) ?? null;
  useEffect(() => {
    if (current) {
      setMeta({
        tag: current.tag,
        description: current.description ?? '',
        valuePrefix: current.valuePrefix,
        valueSuffix: current.valueSuffix,
      });
    }
    setImportResult(null);
    // only when switching tag
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  // Runs an admin request and reloads; returns the parsed body, or undefined on error.
  const send = async (url: string, init: RequestInit, reload = true): Promise<unknown> => {
    setBusy(true);
    setError(null);
    try {
      const res = await request(url, init);
      const data = res.status === 204 ? null : await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      if (reload) await load();
      return data;
    } catch (e) {
      setError((e as Error).message);
      return undefined;
    } finally {
      setBusy(false);
    }
  };

  // Tags in the catalog that don't have numbers yet (suggestions for "+ Giv et tag tal").
  const plainTags = useMemo(() => {
    const rankedNames = new Set(ranked?.map((t) => t.tag));
    return [...new Set(songs.flatMap((s) => s.tags ?? []))].filter((t) => !rankedNames.has(t)).sort();
  }, [songs, ranked]);

  // The songs with the selected tag, numbered ones first (by number), then those missing one.
  const rows = useMemo(() => {
    if (!current) return [];
    const valueById = new Map(current.values.map((v) => [v.songId, v.value]));
    return songs
      .filter((s) => s.tags?.includes(current.tag))
      .map((s) => ({ song: s, value: valueById.get(s.id) }))
      .sort((a, b) => (a.value ?? Infinity) - (b.value ?? Infinity) || a.song.artist.localeCompare(b.song.artist, 'da'));
  }, [current, songs]);
  const missing = rows.filter((r) => r.value === undefined).length;

  const searchHits = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2 || !current) return [];
    const numbered = new Set(current.values.map((v) => v.songId));
    return songs
      .filter((s) => !numbered.has(s.id) && `${s.artist} ${s.title}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [search, songs, current]);

  const saveMeta = async () => {
    const body = JSON.stringify(meta);
    const ok = creating
      ? await send(API, { method: 'POST', body })
      : await send(`${API}/${enc(current!.tag)}`, { method: 'PUT', body });
    if (ok === undefined) return;
    if (creating) {
      setCreating(false);
      setSelected((ok as RankedTag).tag);
    }
  };

  const removeNumbers = async () => {
    if (!current || !confirm(`Fjern tallene fra "${current.tag}"? Sangene beholder tagget.`)) return;
    if ((await send(`${API}/${enc(current.tag)}`, { method: 'DELETE' })) !== undefined) setSelected(null);
  };

  const setValue = (songId: string, value: number) =>
    send(`${API}/${enc(current!.tag)}/values/${enc(songId)}`, { method: 'PUT', body: JSON.stringify({ value }) });

  const removeSong = (songId: string) => send(`${API}/${enc(current!.tag)}/values/${enc(songId)}`, { method: 'DELETE' });

  const addSong = async (songId: string) => {
    if (newValue.trim() === '' || !Number.isFinite(Number(newValue))) return;
    if ((await setValue(songId, Number(newValue))) === undefined) return;
    setSearch('');
    setNewValue('');
  };

  const runImport = async (dryRun: boolean) => {
    const data = (await send(
      `${API}/${enc(current!.tag)}/import`,
      { method: 'POST', body: JSON.stringify({ text: importText, dryRun }) },
      !dryRun,
    )) as ImportResult | undefined;
    if (!data) return;
    setImportResult(data);
    if (!dryRun && data.unmatched.length === 0) setImportText('');
  };

  if (!ranked) return <p className="text-sm text-slate-400">{error ?? 'Henter tags med tal…'}</p>;

  return (
    <section className="rounded-xl bg-slate-900 p-5 ring-1 ring-slate-800">
      <p className="mb-4 text-xs text-slate-400">
        Et tag med tal er en samling, hvor hver sang også har et tal, fx placering på DR's top 100 eller antal uger
        som nr. 1. Samlingen kan spilles efter årstal som alle andre tags, eller som placeringsspil, hvor sangene
        lægges efter tallet. Giver du en sang et tal her, får den også tagget.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {ranked.map((t) => (
          <button
            key={t.tag}
            onClick={() => {
              setCreating(false);
              setSelected(t.tag);
            }}
            className={`rounded-full px-3 py-1 text-sm ring-1 ${
              t.tag === selected && !creating
                ? 'bg-pink-600 text-white ring-pink-500'
                : 'text-slate-300 ring-slate-700 hover:ring-slate-500'
            }`}
          >
            {t.tag} ({t.values.length})
          </button>
        ))}
        <button
          onClick={() => {
            setCreating(true);
            setSelected(null);
            setMeta(emptyMeta);
          }}
          className="rounded-full px-3 py-1 text-sm text-cyan-300 ring-1 ring-cyan-800 hover:ring-cyan-600"
        >
          + Giv et tag tal
        </button>
      </div>

      {error && <p className="mb-3 rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-200">{error}</p>}

      {(creating || current) && (
        <div className="mb-5 grid grid-cols-2 gap-3">
          <label className="col-span-2 block sm:col-span-1">
            <span className={labelCls}>Tag</span>
            {creating ? (
              <>
                <input
                  list="ranked-plain-tags"
                  className={inputCls}
                  value={meta.tag}
                  placeholder="Eksisterende eller nyt tag, fx billboard uger"
                  onChange={(e) => setMeta({ ...meta, tag: e.target.value })}
                />
                <datalist id="ranked-plain-tags">
                  {plainTags.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </>
            ) : (
              <p className="py-1.5 text-sm font-bold text-slate-100">{current?.tag}</p>
            )}
          </label>
          <label className="col-span-2 block sm:col-span-1">
            <span className={labelCls}>Beskrivelse</span>
            <input
              className={inputCls}
              value={meta.description}
              onChange={(e) => setMeta({ ...meta, description: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Før tallet</span>
            <input
              className={inputCls}
              value={meta.valuePrefix}
              placeholder="#"
              onChange={(e) => setMeta({ ...meta, valuePrefix: e.target.value })}
            />
          </label>
          <label className="block">
            <span className={labelCls}>Efter tallet</span>
            <input
              className={inputCls}
              value={meta.valueSuffix}
              placeholder=" uger"
              onChange={(e) => setMeta({ ...meta, valueSuffix: e.target.value })}
            />
          </label>
          <div className="col-span-2 flex flex-wrap items-center gap-3">
            <span className="text-xs text-slate-500">Vises som: {formatRank(meta, 12)}</span>
            <div className="ml-auto flex gap-2">
              {current && (
                <button className={buttonCls} disabled={busy} onClick={removeNumbers}>
                  Fjern tal
                </button>
              )}
              <button
                className="rounded-lg bg-pink-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-pink-500 disabled:opacity-40"
                disabled={busy || !meta.tag.trim()}
                onClick={saveMeta}
              >
                {creating ? 'Giv tagget tal' : 'Gem'}
              </button>
            </div>
          </div>
        </div>
      )}

      {current && (
        <>
          <h3 className="mb-2 text-sm font-bold text-slate-200">Tilføj sang</h3>
          <div className="mb-2 flex gap-2">
            <input
              className={`${inputBase} w-24 flex-none`}
              type="number"
              inputMode="numeric"
              placeholder="Tal"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
            />
            <input
              className={inputCls}
              placeholder="Søg kunstner eller titel i kataloget"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {searchHits.length > 0 && (
            <ul className="mb-4 divide-y divide-slate-800 rounded-lg ring-1 ring-slate-800">
              {searchHits.map((s) => (
                <li key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <span className="flex-1 truncate text-slate-300">
                    {s.artist} – {s.title} <span className="text-slate-500">({s.year})</span>
                  </span>
                  <button className={buttonCls} disabled={busy || newValue.trim() === ''} onClick={() => addSong(s.id)}>
                    Tilføj{newValue.trim() !== '' ? ` som ${formatRank(current, Number(newValue))}` : ''}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <details className="mb-5 rounded-lg bg-slate-950/50 p-3 ring-1 ring-slate-800">
            <summary className="cursor-pointer text-sm font-bold text-slate-200">Masseimport</summary>
            <p className="mt-2 text-xs text-slate-400">
              Én sang pr. linje: <code>tal;kunstner;titel</code> (tab virker også). Sangene skal findes i kataloget; de
              får tagget, og eksisterende tal opdateres.
            </p>
            <textarea
              className={`${inputCls} mt-2 h-32 font-mono`}
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={'1;Alberte;Lyse nætter\n2;Gasolin\';Kvinde Min'}
            />
            <div className="mt-2 flex gap-2">
              <button className={buttonCls} disabled={busy || !importText.trim()} onClick={() => runImport(true)}>
                Forhåndsvis
              </button>
              <button className={buttonCls} disabled={busy || !importText.trim()} onClick={() => runImport(false)}>
                Importér
              </button>
            </div>
            {importResult && (
              <div className="mt-3 text-xs">
                <p className="text-emerald-300">{importResult.matched.length} matchet</p>
                {importResult.unmatched.length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-amber-300">
                    {importResult.unmatched.map((u) => (
                      <li key={u.line}>
                        Linje {u.line}: {u.text} — {u.reason}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </details>

          <h3 className="mb-2 text-sm font-bold text-slate-200">
            Sange med tagget ({rows.length}
            {missing > 0 && <span className="text-amber-300"> · {missing} mangler tal</span>})
          </h3>
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">Ingen sange endnu.</p>
          ) : (
            <ul className="divide-y divide-slate-800 rounded-lg ring-1 ring-slate-800">
              {rows.map(({ song, value }) => (
                <li key={song.id} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                  <input
                    key={`${song.id}-${value}`}
                    className={`${inputBase} w-20 flex-none ${value === undefined ? 'ring-amber-700' : ''}`}
                    type="number"
                    placeholder="Tal"
                    defaultValue={value}
                    onBlur={(ev) => {
                      const v = Number(ev.target.value);
                      if (ev.target.value !== '' && Number.isFinite(v) && v !== value) setValue(song.id, v);
                    }}
                  />
                  <span className={`flex-1 truncate ${song.active === false ? 'text-slate-500' : 'text-slate-300'}`}>
                    {song.artist} – {song.title} <span className="text-slate-500">({song.year})</span>
                    {song.active === false && <span className="text-slate-500"> · inaktiv</span>}
                    {value === undefined && <span className="text-amber-300"> · mangler tal</span>}
                  </span>
                  <button
                    className="text-xs text-slate-500 hover:text-red-300"
                    disabled={busy}
                    title="Fjerner tagget og tallet fra sangen"
                    onClick={() => removeSong(song.id)}
                  >
                    Fjern
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
