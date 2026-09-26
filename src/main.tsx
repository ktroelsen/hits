import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AdminPage} from './components/AdminPage.tsx';
import {OnlineHostScreen} from './online/OnlineHostScreen.tsx';
import {OnlinePlayerScreen} from './online/OnlinePlayerScreen.tsx';
import './index.css';

// Lightweight pathname routing (no router dependency):
//   /admin        → unlisted local curation tool (write API only under `npm run dev`)
//   /game         → online host / big-screen (create + drive the game)
//   /game/{code}  → player join + answer screen
//   everything else → the single-device game
const path = window.location.pathname.replace(/\/+$/, '');
const gameMatch = path.match(/^\/game\/([^/]+)$/);

function Root() {
  if (path === '/admin') return <AdminPage />;
  if (gameMatch) return <OnlinePlayerScreen code={decodeURIComponent(gameMatch[1])} />;
  if (path === '/game') return <OnlineHostScreen />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);

// Makes the site installable as an app (see public/sw.js). Production only, so the
// Vite dev server is never served through a service worker.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('/sw.js').catch(() => {
    /* not installable here (e.g. plain http) — the site works the same without it */
  });
}
