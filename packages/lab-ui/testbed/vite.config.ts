import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  appType: 'spa',
  plugins: [react()],
  resolve: {
    alias: {
      '@tmnl/datagrid': path.resolve(__dirname, '../../datagrid/src/index.ts'),
    },
  },
  server: {
    host: true,
    port: 4178,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 4178,
    strictPort: true,
  },
  build: {
    outDir: path.resolve(__dirname, '../.testbed-dist'),
    emptyOutDir: true,
  },
});
