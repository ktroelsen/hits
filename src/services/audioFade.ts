// Fades song previews in at the start and out towards the end, plus a
// short fade-out when playback is stopped manually.

const FADE_IN_SEC = 1.5;
const FADE_OUT_SEC = 2.5;
const STOP_FADE_MS = 400;

// Extra multiplier per element, used for the manual stop fade.
const gains = new WeakMap<HTMLAudioElement, number>();

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Keeps the element's volume following a fade-in/fade-out envelope based on
 * its playback position. Returns a cleanup function.
 */
export function attachFadeEnvelope(
  audio: HTMLAudioElement,
  getBaseVolume: () => number = () => 1,
): () => void {
  let frame = 0;

  const tick = () => {
    const t = audio.currentTime;
    const d = audio.duration;
    let env = clamp01(t / FADE_IN_SEC);
    if (d && isFinite(d)) env = Math.min(env, clamp01((d - t) / FADE_OUT_SEC));
    audio.volume = clamp01(getBaseVolume() * env * (gains.get(audio) ?? 1));
    frame = requestAnimationFrame(tick);
  };

  tick();
  return () => cancelAnimationFrame(frame);
}

// Bumped to cancel an in-flight stop fade (e.g. when playback restarts).
const generations = new WeakMap<HTMLAudioElement, number>();

/** Cancels any running stop fade. Call before (re)starting playback. */
export function resetFade(audio: HTMLAudioElement) {
  generations.set(audio, (generations.get(audio) ?? 0) + 1);
  gains.delete(audio);
}

/** Fades the element out quickly, then pauses it. */
export function fadeOutAndPause(audio: HTMLAudioElement, ms = STOP_FADE_MS): Promise<void> {
  if (audio.paused) return Promise.resolve();
  const gen = (generations.get(audio) ?? 0) + 1;
  generations.set(audio, gen);
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      if (generations.get(audio) !== gen) return resolve();
      const p = clamp01((now - start) / ms);
      gains.set(audio, 1 - p);
      if (p < 1) {
        requestAnimationFrame(step);
      } else {
        audio.pause();
        gains.delete(audio);
        resolve();
      }
    };
    requestAnimationFrame(step);
  });
}
