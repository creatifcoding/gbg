import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@tmnl/datagrid': path.resolve(__dirname, '../datagrid/src/index.ts'),
    },
  },
  test: {
    globals: false,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    environment: 'happy-dom',
  },
});
