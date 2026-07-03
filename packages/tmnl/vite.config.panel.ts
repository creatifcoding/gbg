/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  root: path.resolve(__dirname, 'src-panel'),
  cacheDir: '../../node_modules/.vite/packages/tmnl-panel',
  resolve: {
    alias: {
      '@panel': path.resolve(__dirname, './src-panel'),
      '@': path.resolve(__dirname, './src'),  // Share main app's lib/
      // Workspace packages — mirror main Vite config because panel imports shared src/ modules.
      '@tmnl/datagrid': path.resolve(__dirname, '../datagrid/src/index.ts'),
      '@tmnl/stx': path.resolve(__dirname, '../stx/src/index.ts'),
      '@tmnl/mathkernel/wasm': path.resolve(__dirname, '../mathkernel/dist/mathkernel.js'),
      '@tmnl/mathkernel': path.resolve(__dirname, '../mathkernel/dist/index.js'),
      // Browser shims for Node builtins that can appear through shared main-app modules.
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
      vscode: path.resolve(
        __dirname,
        '../../node_modules/.bun/@codingame+monaco-vscode-extension-api@25.1.2/node_modules/@codingame/monaco-vscode-extension-api',
      ),
    },
  },
  plugins: [react()],
  optimizeDeps: {
    include: [
      '@tauri-apps/api/core',
      '@tauri-apps/api/event',
      '@tauri-apps/api/window',
      '@effect-atom/atom-react',
      '@effect-atom/atom-react/RegistryContext',
      '@legendapp/state',
      '@legendapp/state/react',
      'effect',
      'effect/Effect',
      'motion/react',
    ],
  },
  clearScreen: false,
  server: {
    port: 1422,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1423,
        }
      : undefined,
    proxy: {
      '/api/harness': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-panel'),
    emptyOutDir: true,
    reportCompressedSize: true,
    rollupOptions: {
      input: {
        panel: path.resolve(__dirname, 'src-panel/panel.html'),
      },
    },
  },
}));
