// Minimal service worker: it only exists so browsers treat HITS as an installable app.
// It deliberately caches nothing — the game needs the network anyway (API, SignalR and
// the iTunes previews), and a cache would risk serving a stale app after a deploy.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {
  // No respondWith: every request goes straight to the network as usual.
});
