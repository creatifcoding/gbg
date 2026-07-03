import { defineConfig } from 'vitest/config'
import path from 'path'

// Canonical `effect` resolves to v4 monorepo-wide (canonical-path inversion,
// 2026-07-03). @effect/atom-react's internal "effect/..." imports now resolve
// correctly without interception — the effectV4AliasForAtomReact plugin that
// previously rewrote them is retired.

export default defineConfig({
  resolve: {
    alias: {
      '@tmnl/lnk': path.resolve(__dirname, 'src/index.ts'),
      '@tmnl/lnk/contracts': path.resolve(
        __dirname,
        'src/contracts/index.ts',
      ),
      '@tmnl/msh/diagnostics': path.resolve(
        __dirname,
        '../msh/src/diagnostics/index.ts',
      ),
      '@tmnl/msh/nats': path.resolve(__dirname, '../msh/src/nats/index.ts'),
      '@tmnl/msh': path.resolve(__dirname, '../msh/src/index.ts'),
      '@tmnl/stx': path.resolve(__dirname, '../stx/src/index.ts'),
    },
  },
  test: {
    globals: false,
    include: ['test/**/*.test.ts', 'test/**/*.test.tsx'],
    exclude: ['**/node_modules/**'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    reporters: ['default'],
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/index.ts', 'src/**/*.test.ts'],
    },
  },
})
