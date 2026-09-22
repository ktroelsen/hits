import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {adminApiPlugin} from './scripts/adminServer';

export default defineConfig(() => {
  return {
    // adminApiPlugin only applies in dev (`vite`), giving /admin its local
    // write API. It is a no-op in `vite build`, so production stays static.
    plugins: [react(), tailwindcss(), adminApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // Proxy the backend API (and future SignalR hub) to the .NET server so the
      // frontend calls the same origin in both dev and production (no CORS/env needed).
      // Scoped so the existing /api/admin dev plugin (adminServer.ts) keeps working.
      proxy: {
        '/api/songs': { target: 'http://localhost:5099', changeOrigin: true },
        '/api/games': { target: 'http://localhost:5099', changeOrigin: true },
        '/gameHub': { target: 'http://localhost:5099', ws: true, changeOrigin: true },
      },
    },
  };
});
