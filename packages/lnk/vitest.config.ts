import { defineConfig } from 'vitest/config'
import path from 'path'
import type { Plugin } from 'vite'

// effect-atom-react-v4 (npm:@effect/atom-react@4.0.0-beta.59) internally
// imports from "effect/..." which resolves to effect v3 at test time in this
// monorepo. This plugin rewrites those imports to effect-v4's dist ONLY when
// the importer is @effect/atom-react. Mirrors the pattern used by @tmnl/stx.
function effectV4AliasForAtomReact(): Plugin {
  const effectV4Dist = path.resolve(
    __dirname,
    '../../node_modules/.bun/effect@4.0.0-beta.59/node_modules/effect/dist',
  )
  return {
    name: 'effect-v4-alias-for-atom-react',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer) return null
      const isAtomReact =
        importer.includes('@effect/atom-react') ||
        importer.includes('@effect+atom-react') ||
        importer.includes('effect-smol/packages/atom/')
      if (!isAtomReact) return null
      // Don't intercept effect-v4's own internal imports.
      if (importer.includes('effect@4.0.0-beta')) return null
      if (source.startsWith('effect/')) {
        const subpath = source.slice('effect/'.length)
        return path.join(effectV4Dist, subpath + '.js')
      }
      return null
    },
  }
}

export default defineConfig({
  plugins: [effectV4AliasForAtomReact()],
  resolve: {
    alias: {
      '@tmnl/lnk': path.resolve(__dirname, 'src/index.ts'),
      '@tmnl/lnk/contracts': path.resolve(
        __dirname,
        'src/contracts/index.ts',
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
