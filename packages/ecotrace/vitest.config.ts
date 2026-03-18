import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: false,
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/*.test.ts'],
    },
  },
})
