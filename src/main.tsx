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
