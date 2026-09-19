/**
 * Vite dev-only middleware that powers the local /admin curation tool.
 *
 * It exposes /api/admin/* endpoints that read the candidate pool and WRITE
 * approved songs straight into src/data/songs.ts (and record approve/reject
 * decisions in candidate-status.json). Because it only runs inside `vite`
 * (dev), the deployed static site has no such API — the admin page is a
 * local-only authoring tool. Workflow: curate locally → git commit → deploy.
 */
import type { Plugin, Connect } from 'vite';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  readSongsSource,
  writeSongsSource,
  insertSong,
  songExists,
  type NewSong,
  type SongCategory,
} from './songsFile';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CANDIDATES_PATH = resolve(__dirname, '../src/data/candidates.json');
const STATUS_PATH = resolve(__dirname, '../src/data/candidate-status.json');

interface Candidate {
  id: string;
  title: string;
  artist: string;
  year: number;
  category: SongCategory;
  note?: string;
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

function countSongs(src: string): { total: number; danish: number; international: number } {
  const total = (src.match(/id: '/g) || []).length;
  const danish = (src.match(/category: 'danish'/g) || []).length;
  const international = (src.match(/category: 'international'/g) || []).length;
  return { total, danish, international };
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

export function adminApiPlugin(): Plugin {
  return {
    name: 'hitster-admin-api',
    apply: 'serve', // dev only — never part of the production build
    configureServer(server) {
      server.middlewares.use('/api/admin', async (req, res) => {
        const url = (req.originalUrl || req.url || '').split('?')[0];
        const path = url.replace(/^.*\/api\/admin/, '') || '/';

        try {
          // GET /state — pending candidates + catalog counts
          if (req.method === 'GET' && (path === '/state' || path === '/')) {
            const src = readSongsSource();
            const status = loadStatus();
            const candidates = loadCandidates();
            const pending = candidates.filter(
              (c) => !status[c.id] && !songExists(src, c.artist, c.title),
            );
            const approved = Object.values(status).filter((s) => s === 'approved').length;
            const rejected = Object.values(status).filter((s) => s === 'rejected').length;
            return sendJson(res, 200, {
              counts: countSongs(src),
              candidates: pending,
              totalCandidates: candidates.length,
              decided: { approved, rejected },
            });
          }

          // POST /approve — { candidateId?, ...song } → write into songs.ts
          if (req.method === 'POST' && path === '/approve') {
            const body = await readBody(req);
            const song = toNewSong(body);
            if (!song.title || !song.artist || !Number.isFinite(song.year)) {
              return sendJson(res, 400, { error: 'title, artist og year er påkrævet.' });
            }
            let src = readSongsSource();
            if (songExists(src, song.artist, song.title)) {
              if (body.candidateId) {
                const status = loadStatus();
                status[body.candidateId] = 'approved';
                saveStatus(status);
              }
              return sendJson(res, 200, { id: null, duplicate: true });
            }
            const result = insertSong(src, song);
            writeSongsSource(result.src);
            if (body.candidateId) {
              const status = loadStatus();
              status[body.candidateId] = 'approved';
              saveStatus(status);
            }
            return sendJson(res, 200, { id: result.id, duplicate: false });
          }

          // POST /reject — { candidateId }
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
