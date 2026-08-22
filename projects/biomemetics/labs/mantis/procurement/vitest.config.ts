import { defineConfig } from 'vitest/config';
import { aliases } from './aliases.ts';

export default defineConfig({
  resolve: {
    alias: aliases,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
