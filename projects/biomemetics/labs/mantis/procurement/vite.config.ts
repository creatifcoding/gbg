import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';

export default defineConfig({
  server: {
    port: 3000,
    host: true,
  },
  resolve: {
    tsconfigPaths: true,
  },
  ssr: {
    external: ['@electric-sql/pglite'],
  },
  plugins: [tanstackStart(), viteReact()],
});
