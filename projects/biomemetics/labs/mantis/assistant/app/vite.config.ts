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
        globPatterns: [
          'index.html',
          'manifest.webmanifest',
          'icons/**',
          'assets/index-*.js',
          'assets/index-*.css',
          'assets/virtual_pwa-register-*.js',
        ],
        globIgnores: ['**/copilotkit-*.js'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@copilotkit') || id.includes('node_modules/katex') || id.includes('node_modules/mermaid')) {
            return 'copilotkit';
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5178,
  },
  preview: {
    port: 5178,
  },
});
