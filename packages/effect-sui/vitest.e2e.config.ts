import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.test.ts'],
    globalSetup: ['test/e2e/utils/globalSetup.ts'],
    setupFiles: ['test/e2e/utils/setupEnv.ts'],
    hookTimeout: 1_000_000,
    testTimeout: 1_000_000,
    pool: 'forks',
    maxWorkers: 4,
    env: {
      NODE_ENV: 'test',
    },
  },
});
