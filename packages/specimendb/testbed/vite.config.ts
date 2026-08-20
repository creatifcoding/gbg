import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  root: __dirname,
  appType: 'spa',
  plugins: [react()],
  resolve: {
    alias: {
      '@tmnl/stx': path.resolve(__dirname, '../../stx/src/index.ts'),
    },
  },
  server: {
    host: true,
    port: 4177,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4177,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, '../../tmp/specimendb-testbed'),
    emptyOutDir: true,
  },
});
