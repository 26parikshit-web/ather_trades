import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Dev: proxy /api and /ws to the AETHER backend (no CORS needed).
// Prod: set VITE_API_URL / VITE_WS_URL to your deployed backend.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'AETHER — Neo Market Intelligence',
        short_name: 'AETHER',
        description: 'Neo NSE market dashboard, AI signals, and news intelligence',
        theme_color: '#EAF7F0',
        background_color: '#EAF7F0',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
