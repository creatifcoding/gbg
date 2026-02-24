/// <reference types='vitest' />
import { defineConfig } from 'vite'
import * as path from 'path'
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin'

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/sparkplug-client',
  plugins: [nxViteTsPaths()],
  build: {
    outDir: '../../dist/packages/sparkplug-client',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: 'src/index.ts',
      name: 'sparkplug-client',
      fileName: 'index',
      formats: ['es' as const],
    },
    rollupOptions: {
      external: ['effect', 'mqtt', 'sparkplug-payload'],
    },
  },
  test: {
    name: 'sparkplug-client',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,test}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/packages/sparkplug-client',
      provider: 'v8' as const,
    },
  },
}))
