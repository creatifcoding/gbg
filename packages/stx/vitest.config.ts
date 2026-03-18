import { defineConfig } from 'vitest/config'
import path from 'path'
import type { Plugin } from 'vite'

// effect-atom-react-v4 (npm:@effect/atom-react@4.0.0-beta.23) internally
// imports from "effect/..." which resolves to effect v3 at test time.
// This plugin rewrites those imports to effect-v4's dist ONLY when the
// importer is @effect/atom-react.
function effectV4AliasForAtomReact(): Plugin {
  const effectV4Dist = path.resolve(
    __dirname, '../../node_modules/.bun/effect@4.0.0-beta.23/node_modules/effect/dist'
  )
  return {
    name: 'effect-v4-alias-for-atom-react',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null
      // Only intercept when importer is @effect/atom-react or the submodule source
      const isAtomReact = importer.includes('@effect/atom-react')
        || importer.includes('@effect+atom-react')
        || importer.includes('effect-smol/packages/atom/')
      if (!isAtomReact) return null
      // Don't intercept effect-v4's own internal imports
      if (importer.includes('effect@4.0.0-beta')) return null
      // Rewrite "effect/Foo" → absolute path to effect v4 dist
      if (source.startsWith('effect/')) {
        const subpath = source.slice('effect/'.length)
        return path.join(effectV4Dist, subpath + '.js')
      }
      return null
    }
  }
}

export default defineConfig({
  plugins: [effectV4AliasForAtomReact()],
  resolve: {
    alias: {
      '@tmnl/entity': path.resolve(__dirname, '../entity/src/index.ts'),
      '@tmnl/stx': path.resolve(__dirname, 'src/index.ts'),
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
