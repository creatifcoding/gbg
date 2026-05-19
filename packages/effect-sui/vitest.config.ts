import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'test/unit/**/*.test.ts',
      'test/property/**/*.test.ts',
      'test/integration/**/*.test.ts',
    ],
    exclude: ['dist/**', 'test/e2e/**'],
  },
});
