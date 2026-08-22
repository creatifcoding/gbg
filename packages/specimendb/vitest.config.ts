import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@tmnl/stx': path.resolve(__dirname, '../stx/src/index.ts'),
      '@gbg/lab-ui': path.resolve(__dirname, '../lab-ui/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts', 'test/**/*.test.tsx'],
    environmentMatchGlobs: [['**/*.tsx', 'happy-dom']],
    fileParallelism: false,
  },
});
