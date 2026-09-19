import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {AdminPage} from './components/AdminPage.tsx';
import './index.css';

// Unlisted local curation tool. Reachable only by typing /admin; its write API
// exists only under `npm run dev`, so it is inert on the deployed static site.
const isAdmin = window.location.pathname.replace(/\/+$/, '') === '/admin';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? <AdminPage /> : <App />}
  </StrictMode>,
);
