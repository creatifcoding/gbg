/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(() => ({
  root: path.resolve(__dirname, 'src-shell'),
  cacheDir: '../../node_modules/.vite/packages/tmnl-shell',
  resolve: {
    alias: {
      '@shell': path.resolve(__dirname, './src-shell'),
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
      'effect',
      'effect/Effect',
      'effect/Layer',
      'effect/Context',
      'effect/Schema',
      'motion/react',
    ],
  },
  clearScreen: false,
  server: {
    port: 1421,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1422,
        }
      : undefined,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-shell'),
    emptyOutDir: true,
    reportCompressedSize: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'src-shell/index.html'),
        calendar: path.resolve(__dirname, 'src-shell/calendar.html'),
        chronicle: path.resolve(__dirname, 'src-shell/chronicle.html'),
        command: path.resolve(__dirname, 'src-shell/command.html'),
      },
    },
  },
}));
