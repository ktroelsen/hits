import { useCallback, useEffect, useState } from 'react';

// "Install as app" support for the start screen. Chrome/Edge/Android fire
// `beforeinstallprompt` once per page load, which we keep so a button can open the
// install dialog later. iPhone Safari never fires it — there the user adds the app via
// Share → "Føj til hjemmeskærm", so we can only show a hint. Nothing is offered once
// the app already runs installed (standalone).

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Captured at module load rather than in a component, so the one-off event isn't lost
// when the start screen mounts later or is left and shown again.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep the browser's own mini-infobar from showing
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    installedNow = true;
    deferredPrompt = null;
    notify();
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, but has touch.
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  // Other iOS browsers (Chrome/Firefox/Edge) don't offer "Føj til hjemmeskærm" the same way.
  return ios && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export type InstallOption =
  | { kind: 'prompt'; install: () => void } // browser install dialog available
  | { kind: 'ios' } // show "Del → Føj til hjemmeskærm" hint
  | { kind: 'none' }; // already installed, or not installable here

export function useInstallOption(): InstallOption {
  const [, rerender] = useState(0);

  useEffect(() => {
    const listener = () => rerender((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const install = useCallback(() => {
    const prompt = deferredPrompt;
    if (!prompt) return;
    prompt.prompt().catch(() => {});
    // A prompt event can only be used once.
    prompt.userChoice.finally(() => {
      deferredPrompt = null;
      notify();
    });
  }, []);

  if (installedNow || isStandalone()) return { kind: 'none' };
  if (deferredPrompt) return { kind: 'prompt', install };
  if (isIosSafari()) return { kind: 'ios' };
  return { kind: 'none' };
}
