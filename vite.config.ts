import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
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
      proxy: {
        '/api/songs': { target: 'http://localhost:5099', changeOrigin: true },
        '/api/admin': { target: 'http://localhost:5099', changeOrigin: true },
        '/api/games': { target: 'http://localhost:5099', changeOrigin: true },
        '/gameHub': { target: 'http://localhost:5099', ws: true, changeOrigin: true },
      },
    },
  };
});
