// Web Audio Synthesizer for instant, zero-dependency sound effects
// and iTunes Search API integration for real 30-second music previews.
import { Song } from '../types';

class SoundEffectsService {
  private ctx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }

  public isEnabled(): boolean {
    return this.soundEnabled;
  }

  // Celebratory ascending chime
  public playSuccess() {
    if (!this.soundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);

      gain.gain.setValueAtTime(0, ctx.currentTime + idx * 0.08);
      gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.08);
      osc.stop(ctx.currentTime + idx * 0.08 + 0.35);
    });
  }

  // Subtle failure/miss sound
  public playError() {
    if (!this.soundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';

    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.35);
  }

  // Card flip / swoosh
  public playFlip() {
    if (!this.soundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.12);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.14);
  }

  // Vinyl needle drop / scratch
  public playNeedleDrop() {
    if (!this.soundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Filtered noise for needle click
    const bufferSize = ctx.sampleRate * 0.06;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, ctx.currentTime);
    filter.Q.setValueAtTime(3, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(ctx.currentTime);
  }

  // Token coin sound
  public playToken() {
    if (!this.soundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';

    osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
    osc.frequency.setValueAtTime(1318.51, ctx.currentTime + 0.07); // E6

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  }

  // Victory fanfare
  public playVictory() {
    if (!this.soundEnabled) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const chords = [
      { notes: [523.25, 659.25, 783.99], time: 0, dur: 0.2 },
      { notes: [587.33, 739.99, 880.00], time: 0.22, dur: 0.2 },
      { notes: [659.25, 830.61, 987.77], time: 0.44, dur: 0.2 },
      { notes: [783.99, 987.77, 1174.66, 1567.98], time: 0.68, dur: 0.8 },
    ];

    chords.forEach(({ notes, time, dur }) => {
      notes.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + time);

        gain.gain.setValueAtTime(0.18, ctx.currentTime + time);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + time + dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + time);
        osc.stop(ctx.currentTime + time + dur);
      });
    });
  }
}

export const sfx = new SoundEffectsService();

// iTunes Preview Cache
// Preview/artwork URLs are static per song, so once we've resolved a song we
// never need to hit the iTunes Search API again. The cache is persisted to
// localStorage (keyed + versioned) so it survives reloads — this is the main
// defence against iTunes' ~20 req/min rate limit for repeat players.
type PreviewEntry = { previewUrl?: string; artworkUrl?: string };

const PREVIEW_CACHE_KEY = 'hitster.previewCache.v1';

function loadPreviewCache(): Map<string, PreviewEntry> {
  const map = new Map<string, PreviewEntry>();
  if (typeof localStorage === 'undefined') return map;
  try {
    const raw = localStorage.getItem(PREVIEW_CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, PreviewEntry>;
      for (const [k, v] of Object.entries(obj)) map.set(k, v);
    }
  } catch {
    // ignore corrupt/unavailable storage — we just start with an empty cache
  }
  return map;
}

const previewCache = loadPreviewCache();

function persistPreviewCache() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      PREVIEW_CACHE_KEY,
      JSON.stringify(Object.fromEntries(previewCache))
    );
  } catch {
    // storage full or unavailable — the in-memory cache still works this session
  }
}

// Shared query builder — used by both the in-app player and the offline
// validation script (scripts/check-previews.ts) so matching stays identical.
export function buildItunesSearchUrl(artist: string, title: string): string {
  const cleanArtist = artist.replace(/ft\..*$/i, '').replace(/'/g, '').trim();
  const cleanTitle = title.replace(/\(.*?\)/g, '').replace(/ft\..*$/i, '').replace(/'/g, '').trim();
  const term = `${cleanArtist} ${cleanTitle}`;
  return `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&entity=song&limit=3`;
}

// Accept any object carrying at least artist + title (a full Song, or a lighter
// candidate from the admin tool). Only these fields are read.
type PreviewLookup = Pick<Song, 'artist' | 'title'> &
  Partial<Pick<Song, 'previewUrl' | 'artworkUrl' | 'customPreviewUrl'>>;

export async function fetchSongAudioPreview(
  song: PreviewLookup
): Promise<PreviewEntry> {
  const { artist, title } = song;

  // #2 Pre-baked URLs: if the catalog already carries a preview (baked in by
  // scripts/check-previews.ts, or a hand-set customPreviewUrl), use it directly
  // and never touch the network.
  const bakedPreview = song.previewUrl || song.customPreviewUrl;
  if (bakedPreview) {
    return { previewUrl: bakedPreview, artworkUrl: song.artworkUrl };
  }

  const cacheKey = `${artist.toLowerCase().trim()}_${title.toLowerCase().trim()}`;
  if (previewCache.has(cacheKey)) {
    return previewCache.get(cacheKey)!;
  }

  try {
    const url = buildItunesSearchUrl(artist, title);

    const res = await fetch(url);
    // 403/429 (and empty bodies) are how iTunes signals throttling. Don't cache
    // those as "no preview" — return an empty result but leave the cache untouched
    // so a later attempt can still resolve the song once the rate limit clears.
    if (!res.ok) throw new Error('Network response not ok');
    const data = await res.json();

    if (data.results && data.results.length > 0) {
      // Find closest match or first result
      const match = data.results[0];
      const previewUrl = match.previewUrl || undefined;
      let artworkUrl = match.artworkUrl100 || undefined;
      // Upgrade artwork from 100x100 to 600x600 for sharp vinyl cover display
      if (artworkUrl) {
        artworkUrl = artworkUrl.replace('100x100bb', '600x600bb');
      }

      const result = { previewUrl, artworkUrl };
      previewCache.set(cacheKey, result);
      persistPreviewCache();
      return result;
    }

    // Definitive answer from iTunes: genuinely no match. Safe to cache.
    const empty = { previewUrl: undefined, artworkUrl: undefined };
    previewCache.set(cacheKey, empty);
    persistPreviewCache();
    return empty;
  } catch (err) {
    // Network error or throttling — transient, so do NOT persist a negative result.
    console.warn('Could not fetch iTunes preview for:', artist, title, err);
    return { previewUrl: undefined, artworkUrl: undefined };
  }
}
