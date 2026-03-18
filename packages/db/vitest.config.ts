import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@tmnl/stx': path.resolve(__dirname, '../stx/src/index.ts'),
      '@tmnl/entity': path.resolve(__dirname, '../entity/src/index.ts'),
    },
  },
  test: {
    globals: false,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
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
