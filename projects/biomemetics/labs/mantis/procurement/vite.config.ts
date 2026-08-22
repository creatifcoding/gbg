import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  server: {
    port: 3000,
    host: true,
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      '@tmnl/stx': path.join(here, 'src/tmnl-stx.ts'),
    },
  },
  ssr: {
    external: ['@electric-sql/pglite'],
  },
  plugins: [tanstackStart(), viteReact()],
});
