/**
 * Text-level helpers for editing src/data/songs.ts safely from Node (the admin
 * dev-server and the preview scripts). We manipulate the source as text rather
 * than parsing/regenerating it so the file's hand-written funFacts, comments and
 * ordering are preserved exactly — only the targeted song is touched.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SONGS_PATH = resolve(__dirname, '../src/data/songs.ts');

export type Decade = '50s' | '60s' | '70s' | '80s' | '90s' | '00s' | '10s' | '20s';
export type SongCategory = 'danish' | 'international';

export interface NewSong {
  title: string;
  artist: string;
  year: number;
  category: SongCategory;
  genre?: string;
  funFact?: string;
  previewUrl?: string;
  artworkUrl?: string;
}

export function readSongsSource(): string {
  return readFileSync(SONGS_PATH, 'utf8');
}

export function writeSongsSource(src: string): void {
  writeFileSync(SONGS_PATH, src, 'utf8');
}

export function decadeForYear(year: number): Decade {
  if (year < 1960) return '50s';
  if (year < 1970) return '60s';
  if (year < 1980) return '70s';
  if (year < 1990) return '80s';
  if (year < 2000) return '90s';
  if (year < 2010) return '00s';
  if (year < 2020) return '10s';
  return '20s';
}

/** Next free id for a category, e.g. "dk-73" or "int-58". */
export function nextId(src: string, category: SongCategory): string {
  const prefix = category === 'danish' ? 'dk' : 'int';
  const re = new RegExp(`id: '${prefix}-(\\d+)'`, 'g');
  let max = 0;
  for (const m of src.matchAll(re)) {
    const n = Number(m[1]);
    if (n > max) max = n;
  }
  return `${prefix}-${max + 1}`;
}

/** True if a song with the same artist+title (case-insensitive) already exists. */
export function songExists(src: string, artist: string, title: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const artists = [...src.matchAll(/artist: '((?:[^'\\]|\\.)*)'/g)].map((m) =>
    norm(m[1].replace(/\\'/g, "'")),
  );
  const titles = [...src.matchAll(/title: '((?:[^'\\]|\\.)*)'/g)].map((m) =>
    norm(m[1].replace(/\\'/g, "'")),
  );
  const a = norm(artist);
  const t = norm(title);
  for (let i = 0; i < titles.length; i++) {
    if (titles[i] === t && artists[i] === a) return true;
  }
  return false;
}

function tsStr(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

/** Render one song as a `songs.ts` object literal (2-space array indent). */
export function songLiteral(id: string, song: NewSong): string {
  const lines: string[] = [
    `    id: ${tsStr(id)}`,
    `    title: ${tsStr(song.title)}`,
    `    artist: ${tsStr(song.artist)}`,
    `    year: ${song.year}`,
    `    category: ${tsStr(song.category)}`,
    `    decade: ${tsStr(decadeForYear(song.year))}`,
  ];
  if (song.genre) lines.push(`    genre: ${tsStr(song.genre)}`);
  if (song.funFact) lines.push(`    funFact: ${tsStr(song.funFact)}`);
  if (song.previewUrl) lines.push(`    previewUrl: ${tsStr(song.previewUrl)}`);
  if (song.artworkUrl) lines.push(`    artworkUrl: ${tsStr(song.artworkUrl)}`);
  return `  {\n${lines.join(',\n')}\n  }`;
}

/**
 * Append a new song to the HITSTER_SONGS array. Returns the updated source and
 * the id assigned. Inserts before the array's closing `];`, adding a trailing
 * comma to the previous last element as needed.
 */
export function insertSong(src: string, song: NewSong): { src: string; id: string } {
  const id = nextId(src, song.category);
  const literal = songLiteral(id, song);

  // Find the closing of the array literal (the last `];` in the file).
  const closeIdx = src.lastIndexOf('];');
  if (closeIdx < 0) throw new Error('Kunne ikke finde HITSTER_SONGS-array (mangler "];").');

  let head = src.slice(0, closeIdx).replace(/\s*$/, '');
  if (head.endsWith('}')) head += ','; // previous last element needs a comma
  const tail = src.slice(closeIdx); // starts at "];"

  const updated = `${head}\n${literal}\n${tail}`;
  return { src: updated, id };
}
