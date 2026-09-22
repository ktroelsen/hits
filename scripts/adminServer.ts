/**
 * Vite dev-only middleware that powers the local /admin curation tool.
 *
 * Approved songs are now written to the backend catalog database via the
 * ASP.NET Core API (POST /api/songs → SQLite), instead of being edited into
 * src/data/songs.ts. This means songs added/removed here appear everywhere
 * without a redeploy (issue 10). The candidate pool (candidates.json) and the
 * approve/reject decisions (candidate-status.json) remain local authoring files.
 *
 * Requires the backend to be running (default http://localhost:5099, override
 * with BACKEND_URL). It still only runs under `vite` (dev), so the deployed
 * static site has no write API of its own.
 */
import type { Plugin, Connect } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { decadeForYear, type NewSong, type SongCategory } from './songsFile';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CANDIDATES_PATH = resolve(__dirname, '../src/data/candidates.json');
const STATUS_PATH = resolve(__dirname, '../src/data/candidate-status.json');

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:5099').replace(/\/$/, '');

interface Candidate {
  id: string;
  title: string;
  artist: string;
  year: number;
  category: SongCategory;
  note?: string;
}

// Shape returned by the backend GET /api/songs.
interface CatalogSong {
  id: string;
  title: string;
  artist: string;
  year: number;
  category: SongCategory;
}

type Decision = 'approved' | 'rejected';
type StatusMap = Record<string, Decision>;

function loadCandidates(): Candidate[] {
  if (!existsSync(CANDIDATES_PATH)) return [];
  try {
    return JSON.parse(readFileSync(CANDIDATES_PATH, 'utf8')) as Candidate[];
  } catch {
    return [];
  }
}

function loadStatus(): StatusMap {
  if (!existsSync(STATUS_PATH)) return {};
  try {
    return JSON.parse(readFileSync(STATUS_PATH, 'utf8')) as StatusMap;
  } catch {
    return {};
  }
}

function saveStatus(status: StatusMap): void {
  writeFileSync(STATUS_PATH, JSON.stringify(status, null, 2) + '\n', 'utf8');
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

// Fetches the live catalog from the backend database.
async function fetchCatalog(): Promise<CatalogSong[]> {
  const res = await fetch(`${BACKEND_URL}/api/songs`);
  if (!res.ok) throw new Error(`Backend GET /api/songs → HTTP ${res.status}`);
  return (await res.json()) as CatalogSong[];
}

function catalogHas(catalog: CatalogSong[], artist: string, title: string): boolean {
  const a = norm(artist);
  const t = norm(title);
  return catalog.some((s) => norm(s.artist) === a && norm(s.title) === t);
}

function countSongs(catalog: CatalogSong[]): { total: number; danish: number; international: number } {
  let danish = 0;
  let international = 0;
  for (const s of catalog) {
    if (s.category === 'danish') danish++;
    else if (s.category === 'international') international++;
  }
  return { total: catalog.length, danish, international };
}

function readBody(req: Connect.IncomingMessage): Promise<any> {
  return new Promise((resolveBody, reject) => {
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      try {
        resolveBody(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: any, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function toNewSong(body: any): NewSong {
  const category: SongCategory = body.category === 'danish' ? 'danish' : 'international';
  return {
    title: String(body.title || '').trim(),
    artist: String(body.artist || '').trim(),
    year: Number(body.year),
    category,
    genre: body.genre ? String(body.genre).trim() : undefined,
    funFact: body.funFact ? String(body.funFact).trim() : undefined,
    previewUrl: body.previewUrl ? String(body.previewUrl) : undefined,
    artworkUrl: body.artworkUrl ? String(body.artworkUrl) : undefined,
  };
}

const BACKEND_HINT =
  'Kunne ikke nå backend-API\'et. Start .NET-serveren (cd server && dotnet run) — ' +
  'admin skriver nu til databasen, ikke til songs.ts.';

export function adminApiPlugin(): Plugin {
  return {
    name: 'hitster-admin-api',
    apply: 'serve', // dev only — never part of the production build
    configureServer(server) {
      server.middlewares.use('/api/admin', async (req, res) => {
        const url = (req.originalUrl || req.url || '').split('?')[0];
        const path = url.replace(/^.*\/api\/admin/, '') || '/';

        try {
          // GET /state — pending candidates + catalog counts (from the DB)
          if (req.method === 'GET' && (path === '/state' || path === '/')) {
            let catalog: CatalogSong[];
            try {
              catalog = await fetchCatalog();
            } catch (e) {
              return sendJson(res, 502, { error: BACKEND_HINT + ` (${(e as Error).message})` });
            }
            const status = loadStatus();
            const candidates = loadCandidates();
            const pending = candidates.filter(
              (c) => !status[c.id] && !catalogHas(catalog, c.artist, c.title),
            );
            const approved = Object.values(status).filter((s) => s === 'approved').length;
            const rejected = Object.values(status).filter((s) => s === 'rejected').length;
            return sendJson(res, 200, {
              counts: countSongs(catalog),
              candidates: pending,
              totalCandidates: candidates.length,
              decided: { approved, rejected },
            });
          }

          // POST /approve — { candidateId?, ...song } → POST to backend DB
          if (req.method === 'POST' && path === '/approve') {
            const body = await readBody(req);
            const song = toNewSong(body);
            if (!song.title || !song.artist || !Number.isFinite(song.year)) {
              return sendJson(res, 400, { error: 'title, artist og year er påkrævet.' });
            }

            let catalog: CatalogSong[];
            try {
              catalog = await fetchCatalog();
            } catch (e) {
              return sendJson(res, 502, { error: BACKEND_HINT + ` (${(e as Error).message})` });
            }

            if (catalogHas(catalog, song.artist, song.title)) {
              if (body.candidateId) {
                const status = loadStatus();
                status[body.candidateId] = 'approved';
                saveStatus(status);
              }
              return sendJson(res, 200, { id: null, duplicate: true });
            }

            // Write to the backend catalog database. Let the API assign the id.
            const createRes = await fetch(`${BACKEND_URL}/api/songs`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: song.title,
                artist: song.artist,
                year: song.year,
                category: song.category,
                decade: decadeForYear(song.year),
                genre: song.genre,
                funFact: song.funFact,
                previewUrl: song.previewUrl,
                artworkUrl: song.artworkUrl,
              }),
            });
            if (!createRes.ok) {
              return sendJson(res, 502, {
                error: `Backend POST /api/songs → HTTP ${createRes.status}`,
              });
            }
            const created = (await createRes.json()) as { id: string };

            if (body.candidateId) {
              const status = loadStatus();
              status[body.candidateId] = 'approved';
              saveStatus(status);
            }
            return sendJson(res, 200, { id: created.id, duplicate: false });
          }

          // POST /reject — { candidateId } (local decision tracking)
          if (req.method === 'POST' && path === '/reject') {
            const body = await readBody(req);
            if (!body.candidateId) return sendJson(res, 400, { error: 'candidateId mangler.' });
            const status = loadStatus();
            status[body.candidateId] = 'rejected';
            saveStatus(status);
            return sendJson(res, 200, { ok: true });
          }

          return sendJson(res, 404, { error: 'Ukendt admin-endpoint.' });
        } catch (err) {
          return sendJson(res, 500, { error: String((err as Error).message || err) });
        }
      });
    },
  };
}
