/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { VitePWA } from 'vite-plugin-pwa'; // Import VitePWA
import type { Plugin } from 'vite';
import { sourceExtractPlugin } from './vite-plugin-source-extract';

const host = process.env.TAURI_DEV_HOST;

function tmnlCursorChatPlugin(): Plugin {
  return {
    name: 'tmnl-cursor-chat',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/cursor/chat', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        try {
          // Dynamic import to avoid bundling server code
          const { handleChatRequest } = await import('./src/lib/cursor/api/chat-handler');
          await handleChatRequest(req, res);
        } catch (error) {
          console.error('[cursor/chat] Handler error:', error);
          res.statusCode = 500;
          res.end(JSON.stringify({ error: 'Chat handler failed' }));
        }
      });
    },
  };
}

function tmnlBrowserLogPlugin(): Plugin {
  return {
    name: 'tmnl-browser-log',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__tmnl/browser-log', (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          try {
            const evt = JSON.parse(body || '{}') as {
              level?: string;
              message?: string;
              stack?: string;
              href?: string;
              timestamp?: number;
            };

            const prefix = `[browser:${evt.level ?? 'log'}]`;
            // eslint-disable-next-line no-console
            console.log(prefix, evt.message ?? '', evt.href ? `(${evt.href})` : '');
            if (evt.stack) {
              // eslint-disable-next-line no-console
              console.log(evt.stack);
            }
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log('[browser:log] (failed to parse payload)', e);
          }

          res.statusCode = 204;
          res.end();
        });
      });
    },
  };
}

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/tmnl',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Polyfill crypto for AI SDK browser compatibility
      // The AI SDK uses crypto.randomUUID which is available natively in browsers
      // but Vite externalizes the Node crypto module
      crypto: path.resolve(__dirname, './src/lib/polyfills/crypto-shim.ts'),
    },
    dedupe: ['yjs', '@tiptap/pm'], // Ensure single instances for collaboration
  },
  optimizeDeps: {
    include: ['mermaid', 'yjs'],
    // Exclude wa-sqlite from optimization - it needs to load WASM at runtime
    exclude: ['@effect/wa-sqlite'],
  },
  // Ensure WASM files are served with correct MIME type
  assetsInclude: ['**/*.wasm'],
  plugins: [
    react(),
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    tmnlCursorChatPlugin(),
    tmnlBrowserLogPlugin(),
    sourceExtractPlugin(), // Extract ComponentBox sources for testbed
    VitePWA({ // Add VitePWA plugin
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'TMNL App',
        short_name: 'TMNL',
        description: 'Terminal & Multi-Modal Navigation Layer',
        theme_color: '#000000',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  // Tauri-specific settings
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Exclude heavy directories from file watching to prevent ENOSPC
      ignored: [
        '**/src-tauri/**',
        '**/.direnv/**',
        '**/.git/**',
        '**/node_modules/.cache/**',
        '**/.nix-profile/**',
        '**/result/**',
      ],
    },
    // Proxy requests to avoid CORS issues in development
    proxy: {
      '/y-sweet': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/y-sweet/, ''),
        ws: true,
      },
      // Cursor chat server (Claude Code backend)
      '/api/chat': {
        target: 'http://localhost:7682',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/api/ui-generate': {
        target: 'http://localhost:7682',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/api/chart-style': {
        target: 'http://localhost:7682',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/api/pi-orchestrator': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [ nxViteTsPaths() ],
  // },
  // Configuration for building Tauri app
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
  test: {
    name: 'tmnl',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/packages/tmnl',
      provider: 'v8' as const,
    },
  },
}));