import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/keeper.svg'],
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,webmanifest,json,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'document',
            handler: 'NetworkFirst',
            options: { cacheName: 'keeper-pages' },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5178,
  },
  preview: {
    port: 5178,
  },
});
