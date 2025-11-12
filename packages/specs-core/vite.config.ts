import { defineConfig } from 'vite';
import { resolve } from 'path';
import { mkdirSync, copyFileSync, existsSync } from 'fs';
import dts from 'vite-plugin-dts';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';
import { nxCopyAssetsPlugin } from '@nx/vite/plugins/nx-copy-assets.plugin';

export default defineConfig(() => ({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/packages/specs-core',
  plugins: [
    nxViteTsPaths(),
    nxCopyAssetsPlugin(['*.md']),
    dts({
      entryRoot: 'src',
      tsconfigPath: resolve(__dirname, 'tsconfig.lib.json'),
    }),
    {
      name: 'copy-to-lens-studio',
      closeBundle() {
        const lensPackagesDir = resolve(__dirname, 'lenses/init/Packages/specs-core');
        const distDir = resolve(__dirname, '../../dist/packages/specs-core');

        // Create directory if it doesn't exist
        if (!existsSync(lensPackagesDir)) {
          mkdirSync(lensPackagesDir, { recursive: true });
        }

        // Copy build artifacts
        try {
          copyFileSync(
            resolve(distDir, 'index.cjs.js'),
            resolve(lensPackagesDir, 'index.cjs.js')
          );
          copyFileSync(
            resolve(distDir, 'index.d.ts'),
            resolve(lensPackagesDir, 'index.d.ts')
          );
          console.log('\n✓ Copied build artifacts to Lens Studio Packages folder');
        } catch (err) {
          console.error('Failed to copy to Lens Studio:', err);
        }
      },
    },
  ],

  build: {
    outDir: '../../dist/packages/specs-core',
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'SpecsCore',
      fileName: (format) => {
        if (format === 'cjs') return 'index.cjs.js';
        if (format === 'es') return 'index.es.js';
        return `index.${format}.js`;
      },
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      // Only externalize dependencies that will actually be available in Lens Studio
      // Effect must be bundled since Lens Studio won't have it
      external: [
        // Keep these external only if Lens Studio provides them
        // Otherwise, remove them to bundle everything
      ],
      output: {
        // Ensure proper CommonJS output
        exports: 'named',
      },
    },
  },

  test: {
    name: 'specs-core',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/packages/specs-core',
      provider: 'v8' as const,
    },
  },
}));
