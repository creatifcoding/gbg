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
