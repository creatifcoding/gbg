import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { aliases } from './aliases.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: here,
  server: {
    port: 3000,
    host: true,
  },
  resolve: {
    tsconfigPaths: true,
    alias: aliases,
  },
  ssr: {
    external: ['@electric-sql/pglite'],
    noExternal: [
      '@gbg/lab-ui',
      'ag-grid-community',
      'ag-grid-react',
      '@tanstack/react-table',
    ],
  },
  optimizeDeps: {
    include: ['ag-grid-community', 'ag-grid-react', '@tanstack/react-table'],
  },
  plugins: [tanstackStart(), viteReact()],
});
