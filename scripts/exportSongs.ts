// Exports the existing hardcoded catalog (src/data/songs.ts) to server/seed/songs.json,
// which the ASP.NET Core backend seeds into SQLite on first run. Reuses the song data
// verbatim so nothing is retyped. Re-run with: npm run export-songs
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HITSTER_SONGS } from '../src/data/songs';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../server/seed/songs.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(HITSTER_SONGS, null, 2), 'utf8');
console.log(`Wrote ${HITSTER_SONGS.length} songs to ${out}`);
