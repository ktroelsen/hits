import { useEffect, useRef, useState } from 'react';

// Preview section of the song editor in /admin → Katalog. The iTunes search's first hit
// isn't always the right recording (a cover, a live or karaoke version …), so the admin
// can search iTunes, listen to the hits and pick the right one — or paste an Apple Music
// link. The picked track's id is saved on the song (iTunesTrackId), so the weekly preview
// refresh (server/Catalog/PreviewRefresher.cs) keeps that exact track instead of searching
// again. A custom audio URL, if set, wins over iTunes altogether.

export interface PreviewChoice {
  previewUrl?: string;
  artworkUrl?: string;
  iTunesTrackId?: number | null;
  customPreviewUrl?: string;
}

interface Track {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: string;
  releaseDate?: string;
  previewUrl?: string;
  artworkUrl100?: string;
}

const inputCls =
  'w-full rounded-lg bg-slate-800 px-2 py-1.5 text-sm text-slate-100 outline-none ring-1 ring-slate-700 focus:ring-pink-500';
// Same look without the full width, for inputs sharing a row with buttons.
const rowInputCls = inputCls.replace('w-full ', '');
const buttonCls =
  'rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-200 ring-1 ring-slate-700 hover:bg-slate-700 disabled:opacity-40';

const bigArtwork = (url?: string) => url?.replace('100x100bb', '600x600bb');

// "https://music.apple.com/dk/album/navn/123?i=456" → 456, ".../song/navn/456" → 456, "456" → 456
export function trackIdFromLink(text: string): number | null {
  const t = text.trim();
  if (/^\d+$/.test(t)) return Number(t);
  const i = /[?&]i=(\d+)/.exec(t);
  if (i) return Number(i[1]);
  const song = /\/song\/[^/]*\/(\d+)/.exec(t) ?? /\/song\/(\d+)/.exec(t);
  return song ? Number(song[1]) : null;
}

async function itunes(url: string): Promise<Track[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(res.status === 403 || res.status === 429 ? 'iTunes har for travlt — prøv igen om et minut.' : `HTTP ${res.status}`);
  const data = await res.json();
  return ((data.results ?? []) as Track[]).filter((r) => r.trackId && r.previewUrl);
}

export function AdminPreviewPicker({
  artist,
  title,
  value,
  onChange,
}: {
  artist: string;
  title: string;
  value: PreviewChoice;
  onChange: (patch: PreviewChoice) => void;
}) {
  const [term, setTerm] = useState(`${artist} ${title}`.trim());
  const [country, setCountry] = useState<'dk' | 'us'>('dk');
  const [results, setResults] = useState<Track[] | null>(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null); // preview URL being played
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = (url?: string) => {
    if (!url) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    if (playing === url) {
      audio.pause();
      setPlaying(null);
      return;
    }
    audio.src = url;
    audio.onended = () => setPlaying(null);
    audio.play().then(() => setPlaying(url)).catch(() => setPlaying(null));
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const search = () =>
    run(async () => {
      const q = encodeURIComponent(term.trim());
      setResults(await itunes(`https://itunes.apple.com/search?term=${q}&entity=song&limit=15&country=${country}`));
    });

  const pick = (t: Track) => {
    onChange({ previewUrl: t.previewUrl, artworkUrl: bigArtwork(t.artworkUrl100), iTunesTrackId: t.trackId });
  };

  const useLink = () =>
    run(async () => {
      const id = trackIdFromLink(link);
      if (!id) throw new Error('Kunne ikke finde et sang-id i linket. Brug et link til selve sangen (med ?i=… eller /song/…).');
      const found = (await itunes(`https://itunes.apple.com/lookup?id=${id}&entity=song&country=dk`))[0]
        ?? (await itunes(`https://itunes.apple.com/lookup?id=${id}&entity=song`))[0];
      if (!found) throw new Error('Sangen blev ikke fundet i iTunes, eller den har ingen preview.');
      pick(found);
      setResults([found]);
      setLink('');
    });

  const current = value.customPreviewUrl || value.previewUrl;

  return (
    <div className="col-span-2 rounded-lg bg-slate-950/50 p-3 ring-1 ring-slate-800">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Preview</span>
        {current ? (
          <button type="button" className={buttonCls} onClick={() => toggle(current)}>
            {playing === current ? '⏸ Stop' : '▶ Afspil nuværende'}
          </button>
        ) : (
          <span className="text-xs text-amber-300">Ingen preview</span>
        )}
        <span className="text-xs text-slate-500">
          {value.customPreviewUrl
            ? 'Egen lyd-URL bruges'
            : value.iTunesTrackId
            ? `Valgt iTunes-sang (#${value.iTunesTrackId}) — holdes ved lige automatisk`
            : 'Første iTunes-søgeresultat'}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          className={`${rowInputCls} min-w-0 flex-1`}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())}
          placeholder="Søg i iTunes"
        />
        <select
          className={rowInputCls}
          value={country}
          onChange={(e) => setCountry(e.target.value as 'dk' | 'us')}
          title="iTunes-butik"
        >
          <option value="dk">DK</option>
          <option value="us">US</option>
        </select>
        <button type="button" className={buttonCls} disabled={busy || !term.trim()} onClick={search}>
          Find versioner
        </button>
      </div>

      {results && (
        <ul className="mt-2 max-h-72 divide-y divide-slate-800 overflow-y-auto rounded-lg ring-1 ring-slate-800">
          {results.length === 0 && <li className="px-3 py-2 text-xs text-slate-500">Ingen sange med preview fundet.</li>}
          {results.map((t) => {
            // Only a picked track id identifies a version: Apple reuses one preview clip for
            // several releases of a song, so an equal URL only says "same audio".
            const chosen = value.iTunesTrackId === t.trackId;
            const sameAudio = !chosen && !!value.previewUrl && value.previewUrl === t.previewUrl;
            return (
              <li key={t.trackId} className={`flex items-center gap-2 px-2 py-1.5 text-sm ${chosen ? 'bg-emerald-950/40' : ''}`}>
                {t.artworkUrl100 && <img src={t.artworkUrl100} alt="" className="h-9 w-9 flex-none rounded" />}
                <button type="button" className={buttonCls} onClick={() => toggle(t.previewUrl)}>
                  {playing === t.previewUrl ? '⏸' : '▶'}
                </button>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-200">
                    {t.artistName} – {t.trackName}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {t.collectionName}
                    {t.releaseDate && ` · ${t.releaseDate.slice(0, 4)}`}
                    {sameAudio && <span className="text-emerald-400"> · nuværende lyd</span>}
                  </span>
                </span>
                {chosen ? (
                  <span className="text-xs font-bold text-emerald-300">✓ Valgt</span>
                ) : (
                  <button type="button" className={buttonCls} onClick={() => pick(t)}>
                    Vælg
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap gap-2">
        <input
          className={`${rowInputCls} min-w-0 flex-1`}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="…eller indsæt et Apple Music-link til sangen"
        />
        <button type="button" className={buttonCls} disabled={busy || !link.trim()} onClick={useLink}>
          Brug link
        </button>
      </div>

      <label className="mt-2 block">
        <span className="text-xs text-slate-500">Egen lyd-URL (valgfri — bruges i stedet for iTunes)</span>
        <input
          className={inputCls}
          value={value.customPreviewUrl ?? ''}
          onChange={(e) => onChange({ customPreviewUrl: e.target.value.trim() || undefined })}
          placeholder="https://…/sang.mp3"
        />
      </label>

      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {value.iTunesTrackId && !value.customPreviewUrl && (
        <button
          type="button"
          className="mt-2 text-xs text-slate-500 underline hover:text-slate-300"
          onClick={() => onChange({ iTunesTrackId: null })}
        >
          Glem det valgte (brug første søgeresultat igen ved næste fornyelse)
        </button>
      )}
    </div>
  );
}
