/**
 * Offline validation of the song catalog against the iTunes Search API.
 *
 *   npm run check-songs                      # dry-run report: OK / MANGLER per song
 *   npm run prune-songs                      # remove songs with no preview from songs.ts
 *   npm run prune-songs -- --ids=dk-12,int-5 # also remove these explicit ids
 *
 * Uses the SAME query builder as the in-app player so matching is identical.
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
const idsArg = args.find((a) => a.startsWith('--ids='));
const extraIds = idsArg ? idsArg.slice('--ids='.length).split(',').map((s) => s.trim()).filter(Boolean) : [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// iTunes Search allows only ~20 requests/minute; exceeding it returns HTTP 403
// with an empty body. We space calls out and retry on throttling so a rate-limit
// is never mistaken for a genuinely missing preview (which would wrongly prune it).
const BASE_DELAY = 3000;
const MAX_RETRIES = 4;

async function hasPreview(artist: string, title: string): Promise<boolean> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(buildItunesSearchUrl(artist, title));
      if (res.status === 403 || res.status === 429) {
        // throttled — back off and retry
        await sleep(BASE_DELAY * (attempt + 2));
        continue;
      }
      if (!res.ok) return false;
      const data = await res.json();
      return Boolean(data.results && data.results.length > 0 && data.results[0].previewUrl);
    } catch {
      await sleep(BASE_DELAY * (attempt + 2));
    }
  }
  // Could not get a definitive answer — treat as "keep" to avoid false removal.
  console.warn(`  (kunne ikke verificere ${artist} – ${title}; beholdes)`);
  return true;
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

async function main() {
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
