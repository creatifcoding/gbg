import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      'effect-v4': 'effect-v4',
      '@tmnl/stx': path.resolve(__dirname, '../stx/src/index.ts'),
    },
  },
})
