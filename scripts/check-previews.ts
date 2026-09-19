/**
 * Offline validation of the song catalog against the iTunes Search API.
 *
 *   npm run check-songs                      # dry-run report: OK / MANGLER per song
 *   npm run prune-songs                      # remove songs with no preview from songs.ts
 *   npm run prune-songs -- --ids=dk-12,int-5 # also remove these explicit ids
 *   npm run bake-songs                       # write previewUrl + artworkUrl into songs.ts
 *
 * Uses the SAME query builder as the in-app player so matching is identical.
 *
 * bake-songs pre-resolves every preview once and stores it in songs.ts, so the
 * running app makes ZERO calls to Apple at runtime (see audioService #2). Re-run
 * it periodically (e.g. in CI) since preview URLs can eventually expire.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { HITSTER_SONGS } from '../src/data/songs';
import { buildItunesSearchUrl } from '../src/services/audioService';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SONGS_PATH = resolve(__dirname, '../src/data/songs.ts');

const args = process.argv.slice(2);
const doPrune = args.includes('--prune');
const doBake = args.includes('--bake');
const idsArg = args.find((a) => a.startsWith('--ids='));
const extraIds = idsArg ? idsArg.slice('--ids='.length).split(',').map((s) => s.trim()).filter(Boolean) : [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// iTunes Search allows only ~20 requests/minute; exceeding it returns HTTP 403
// with an empty body. We space calls out and retry on throttling so a rate-limit
// is never mistaken for a genuinely missing preview (which would wrongly prune it).
//
// The rate limit is a per-minute window, NOT a permanent ban — so the safe recovery
// from a 403 is simply to wait out the window. We stay well under the limit by
// default and, on any throttling, cool down for a full minute before retrying.
const BASE_DELAY = 4000;        // spacing between songs (~15 req/min, safely under 20)
const THROTTLE_COOLDOWN = 60000; // wait out the full rate-limit window on a 403/429
const MAX_RETRIES = 6;           // plenty of chances to recover from a throttle

type PreviewData = { previewUrl?: string; artworkUrl?: string };

// Resolve one song against iTunes. Returns:
//   PreviewData (possibly empty) on a definitive answer from Apple, or
//   null when we could not get a definitive answer (throttled/network) after retries.
async function fetchPreviewData(artist: string, title: string): Promise<PreviewData | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(buildItunesSearchUrl(artist, title));
      if (res.status === 403 || res.status === 429) {
        // Throttled — wait out the full per-minute window before retrying so we
        // never escalate the throttling. This resets the limit rather than fighting it.
        console.warn(`  (rate limit ramt — venter ${THROTTLE_COOLDOWN / 1000}s før nyt forsøg)`);
        await sleep(THROTTLE_COOLDOWN);
        continue;
      }
      if (!res.ok) return {};
      const data = await res.json();
      const match = data.results && data.results.length > 0 ? data.results[0] : null;
      if (!match || !match.previewUrl) return {};
      const artworkUrl: string | undefined = match.artworkUrl100
        ? String(match.artworkUrl100).replace('100x100bb', '600x600bb')
        : undefined;
      return { previewUrl: match.previewUrl, artworkUrl };
    } catch {
      await sleep(BASE_DELAY * (attempt + 2));
    }
  }
  return null;
}

async function hasPreview(artist: string, title: string): Promise<boolean> {
  const data = await fetchPreviewData(artist, title);
  if (data === null) {
    // Could not get a definitive answer — treat as "keep" to avoid false removal.
    console.warn(`  (kunne ikke verificere ${artist} – ${title}; beholdes)`);
    return true;
  }
  return Boolean(data.previewUrl);
}

/** Remove a song object (`{ ... id: '<id>' ... },`) from the raw songs.ts text. */
function removeSong(src: string, id: string): string {
  const mi = src.indexOf(`id: '${id}'`);
  if (mi < 0) return src;
  const open = src.lastIndexOf('\n  {', mi);
  const close = src.indexOf('\n  }', mi);
  if (open < 0 || close < 0) return src;
  let end = close + '\n  }'.length;
  if (src[end] === ',') end++;
  return src.slice(0, open) + src.slice(end);
}

/** Escape a value for embedding in a single-quoted TS string literal. */
function tsStr(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/**
 * Set (insert or replace) previewUrl/artworkUrl inside a song's object literal.
 * Idempotent: existing baked lines for the song are removed first, so re-running
 * bake refreshes rather than duplicates.
 */
function setBakedFields(src: string, id: string, data: PreviewData): string {
  const mi = src.indexOf(`id: '${id}'`);
  if (mi < 0) return src;
  const open = src.lastIndexOf('\n  {', mi);
  const close = src.indexOf('\n  }', mi);
  if (open < 0 || close < 0) return src;

  let block = src.slice(open, close);
  // Drop any previously baked fields (with or without trailing comma).
  block = block.replace(/\n {4}(?:previewUrl|artworkUrl): '(?:[^'\\]|\\.)*',?/g, '');

  const lines: string[] = [];
  if (data.previewUrl) lines.push(`    previewUrl: ${tsStr(data.previewUrl)}`);
  if (data.artworkUrl) lines.push(`    artworkUrl: ${tsStr(data.artworkUrl)}`);
  if (lines.length === 0) return src.slice(0, open) + block + src.slice(close);

  // Ensure the last existing property ends with a comma before we append ours.
  const trimmed = block.replace(/\s*$/, '');
  const withComma = trimmed.endsWith(',') ? trimmed : `${trimmed},`;
  const insertion = `\n${lines.join(',\n')}`;
  return src.slice(0, open) + withComma + insertion + src.slice(close);
}

async function runBake() {
  console.log(`Baker previews for ${HITSTER_SONGS.length} sange fra iTunes...\n`);
  let src = readFileSync(SONGS_PATH, 'utf8');
  let baked = 0;
  let missing = 0;
  let skipped = 0;

  for (const song of HITSTER_SONGS) {
    const data = await fetchPreviewData(song.artist, song.title);
    if (data === null) {
      console.log(`SKIP    ${song.id.padEnd(7)}  ${song.artist} – ${song.title} (kunne ikke verificere; uændret)`);
      skipped++;
    } else if (data.previewUrl) {
      src = setBakedFields(src, song.id, data);
      console.log(`BAGT    ${song.id.padEnd(7)}  ${song.artist} – ${song.title}`);
      baked++;
    } else {
      console.log(`MANGLER ${song.id.padEnd(7)}  ${song.artist} – ${song.title} (ingen preview)`);
      missing++;
    }
    await sleep(BASE_DELAY); // stay under iTunes' ~20 req/min limit
  }

  writeFileSync(SONGS_PATH, src, 'utf8');
  console.log(`\n--- Resultat ---`);
  console.log(`Bagt: ${baked}   Uden preview: ${missing}   Sprunget over: ${skipped}`);
  console.log(`Skrev opdateret songs.ts.`);
}

async function main() {
  if (doBake) {
    await runBake();
    return;
  }

  console.log(`Tjekker ${HITSTER_SONGS.length} sange mod iTunes...\n`);
  const missing: string[] = [];

  for (const song of HITSTER_SONGS) {
    const ok = await hasPreview(song.artist, song.title);
    console.log(`${ok ? 'OK     ' : 'MANGLER'}  ${song.id.padEnd(7)}  ${song.artist} – ${song.title}`);
    if (!ok) missing.push(song.id);
    await sleep(BASE_DELAY); // stay under iTunes' ~20 req/min limit
  }

  const toRemove = Array.from(new Set([...missing, ...extraIds]));

  console.log(`\n--- Resultat ---`);
  console.log(`Uden preview (${missing.length}): ${missing.join(', ') || 'ingen'}`);
  if (extraIds.length) console.log(`Ekstra via --ids (${extraIds.length}): ${extraIds.join(', ')}`);

  if (!doPrune) {
    console.log(`\nDry-run. Kør 'npm run prune-songs' for at fjerne dem permanent fra songs.ts.`);
    return;
  }

  if (toRemove.length === 0) {
    console.log(`\nIntet at fjerne.`);
    return;
  }

  let src = readFileSync(SONGS_PATH, 'utf8');
  for (const id of toRemove) src = removeSong(src, id);
  writeFileSync(SONGS_PATH, src, 'utf8');
  console.log(`\nFjernede ${toRemove.length} sang(e) fra songs.ts: ${toRemove.join(', ')}`);
}

main();
