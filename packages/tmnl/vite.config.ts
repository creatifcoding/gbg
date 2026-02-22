/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';
import { VitePWA } from 'vite-plugin-pwa'; // Import VitePWA
import type { Plugin } from 'vite';
import { sourceExtractPlugin } from './vite-plugin-source-extract';
import importMetaUrlPlugin from '@codingame/esbuild-import-meta-url-plugin';

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
      // Node.js builtins shimmed for browser/Tauri builds.
      // Transitive deps (nats.ws, escalade, yargs, pg, @osdk/maker) import
      // these — shims provide browser-compatible stubs or Web API proxies.
      // See: docs/RCA_ROUTE_OPTIMIZATION.md (Phase B)
      // Shims for Node builtins that appear in the EAGER main chunk.
      // These must resolve to real modules (not externals) or WebKitGTK
      // will fail with unresolvable bare import at runtime.
      crypto: path.resolve(__dirname, './src/lib/polyfills/crypto-shim.ts'),
      path: path.resolve(__dirname, './src/lib/polyfills/node-builtins-shim.ts'),
      fs: path.resolve(__dirname, './src/lib/polyfills/fs-shim.ts'),
      util: path.resolve(__dirname, './src/lib/polyfills/util-shim.ts'),
      stream: path.resolve(__dirname, './src/lib/polyfills/stream-shim.ts'),
      net: path.resolve(__dirname, './src/lib/polyfills/net-shim.ts'),
      tls: path.resolve(__dirname, './src/lib/polyfills/net-shim.ts'),
      dns: path.resolve(__dirname, './src/lib/polyfills/net-shim.ts'),
      child_process: path.resolve(__dirname, './src/lib/polyfills/fs-shim.ts'),
      os: path.resolve(__dirname, './src/lib/polyfills/util-shim.ts'),
      url: path.resolve(__dirname, './src/lib/polyfills/url-shim.ts'),
      // Monaco/VSCode shim — vscode-languageclient requires("vscode") which must
      // resolve to the @codingame browser-compatible API. Bun only symlinks this
      // inside @typefox's nested node_modules, so we alias it globally.
      vscode: path.resolve(
        __dirname,
        '../../node_modules/.bun/@codingame+monaco-vscode-extension-api@25.1.2/node_modules/@codingame/monaco-vscode-extension-api',
      ),
    },
    dedupe: ['yjs', '@tiptap/pm', 'vscode'], // Ensure single instances for collaboration + Monaco vscode shim
  },
  optimizeDeps: {
    include: ['mermaid', 'yjs'],
    // Exclude packages that need special runtime loading
    exclude: [
      '@effect/wa-sqlite', // needs WASM at runtime
      // Monaco/VSCode ecosystem — these use import.meta.url, CSS imports,
      // and require("vscode") patterns that esbuild can't handle.
      // Let Vite serve them as ESM instead of pre-bundling.
      'monaco-editor',
      'monaco-languageclient',
      'vscode-languageclient',
      'vscode-jsonrpc',
      'vscode-languageserver-protocol',
      '@typefox/monaco-editor-react',
      '@codingame/monaco-vscode-api',
      '@codingame/monaco-vscode-editor-api',
      '@codingame/monaco-vscode-extension-api',
    ],
    esbuildOptions: {
      // Mirror resolve.alias into esbuild's dep optimization pass.
      // Vite's resolve.alias doesn't always propagate to esbuild,
      // causing "No matching export" errors when transitive deps
      // (y18n, escalade, etc.) import Node builtins like 'fs'.
      plugins: [
        // @codingame/monaco-vscode-api uses import.meta.url for worker loading;
        // esbuild needs this plugin to resolve those references during dep optimization
        importMetaUrlPlugin,
        {
          name: 'node-builtins-shim',
          setup(build) {
            const shimMap: Record<string, string> = {
              fs: path.resolve(__dirname, './src/lib/polyfills/fs-shim.ts'),
              path: path.resolve(__dirname, './src/lib/polyfills/node-builtins-shim.ts'),
              crypto: path.resolve(__dirname, './src/lib/polyfills/crypto-shim.ts'),
              util: path.resolve(__dirname, './src/lib/polyfills/util-shim.ts'),
              stream: path.resolve(__dirname, './src/lib/polyfills/stream-shim.ts'),
              net: path.resolve(__dirname, './src/lib/polyfills/net-shim.ts'),
              tls: path.resolve(__dirname, './src/lib/polyfills/net-shim.ts'),
              dns: path.resolve(__dirname, './src/lib/polyfills/net-shim.ts'),
              child_process: path.resolve(__dirname, './src/lib/polyfills/fs-shim.ts'),
              os: path.resolve(__dirname, './src/lib/polyfills/util-shim.ts'),
              url: path.resolve(__dirname, './src/lib/polyfills/url-shim.ts'),
            }
            build.onResolve(
              { filter: /^(fs|path|crypto|util|stream|net|tls|dns|child_process|os|url)$/ },
              (args) => ({ path: shimMap[args.path] }),
            )
            // Map bare 'vscode' to @codingame browser-compatible shim
            // vscode-languageclient does require("vscode") which must resolve
            // to the @codingame/monaco-vscode-extension-api package
            build.onResolve({ filter: /^vscode$/ }, () => ({
              path: path.resolve(
                __dirname,
                '../../node_modules/.bun/@codingame+monaco-vscode-extension-api@25.1.2/node_modules/@codingame/monaco-vscode-extension-api/extension.api.js',
              ),
            }))
          },
        },
      ],
    },
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
      workbox: {
        // Tauri embeds assets in binary — large chunks are expected and fine.
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 30MB
      },
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
    rollupOptions: {
      // Node.js builtins shimmed as empty modules for browser bundle.
      // These leak in via transitive deps (escalade, yargs, pg, nats.ws, etc.).
      // Using resolve.alias (not external!) — external leaves bare imports that
      // WebKitGTK can't resolve. Shims return empty objects/no-ops.
      // See: docs/RCA_ROUTE_OPTIMIZATION.md (Phase B — Production Build)
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