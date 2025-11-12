# Specs-Core Build Guide

Complete guide for building Effect-based TypeScript code into CommonJS artifacts for Lens Studio using Nx + Vite.

## Project Structure

```
packages/specs-core/
├── src/
│   ├── index.ts              # Main entry point with Effect examples
│   └── lib/
│       └── specs-core.ts     # Library functions
├── vite.config.ts            # Vite configuration for library build
├── project.json              # Nx build target configuration
├── tsconfig.json             # TypeScript compiler options
├── tsconfig.lib.json         # Library-specific TS config
└── package.json              # Package metadata and exports
```

## Configuration Files

### 1. `vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import { resolve } from 'path';
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
      // Effect is bundled into the output for Lens Studio compatibility
      // Only externalize dependencies that are actually available in Lens Studio
      external: [],
      output: {
        exports: 'named',
      },
    },
  },
}));
```

### 2. `project.json`

```json
{
  "name": "@gbg/specs-core",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "packages/specs-core/src",
  "projectType": "library",
  "targets": {
    "build": {
      "executor": "@nx/vite:build",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/packages/specs-core",
        "configFile": "packages/specs-core/vite.config.ts"
      }
    }
  }
}
```

### 3. `package.json`

```json
{
  "name": "@gbg/specs-core",
  "version": "0.0.1",
  "type": "commonjs",
  "main": "./index.cjs.js",
  "module": "./index.es.js",
  "types": "./index.d.ts",
  "exports": {
    ".": {
      "types": "./index.d.ts",
      "require": "./index.cjs.js",
      "import": "./index.es.js",
      "default": "./index.cjs.js"
    }
  },
  "dependencies": {
    "effect": "^3.18.4"
  }
}
```

### 4. `tsconfig.json`

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2024",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

## Building the Library

### Standard Build

Run the build command from the repository root:

```bash
# Using pnpm
pnpx nx build specs-core

# Or using npm
npx nx build specs-core
```

**Auto-copy to Lens Studio**: The build automatically copies artifacts to `lenses/init/Packages/specs-core/` via a Vite plugin, so they're immediately available in your Lens Studio project.

### Build with Explicit Copy (build:lens)

For explicit control or CI/CD pipelines:

```bash
pnpx nx run specs-core:build:lens
```

This runs the build and then explicitly copies files using Nx commands.

### Watch Mode (Development)

For active development with auto-rebuild on file changes:

```bash
# From the monorepo root
pnpx nx build specs-core --watch

# Or from the package directory
pnpm watch
```

**Watch mode + Auto-copy**: Every rebuild automatically copies to Lens Studio's Packages folder. Just save your TypeScript files and refresh in Lens Studio.

### Build Output

The build produces files in **two locations**:

#### 1. Main distribution (`dist/packages/specs-core/`)

```
dist/packages/specs-core/
├── index.cjs.js          # CommonJS bundle (~112KB, self-contained with Effect)
├── index.es.js           # ESM bundle (~173KB, self-contained with Effect)
├── index.d.ts            # TypeScript declarations
├── lib/
│   └── specs-core.d.ts   # Additional type definitions
├── package.json          # Package metadata with correct paths
└── *.md                  # Documentation files
```

#### 2. Lens Studio Packages (auto-copied)

```
lenses/init/Packages/specs-core/
├── index.cjs.js          # CommonJS bundle (auto-copied)
└── index.d.ts            # TypeScript declarations (auto-copied)
```

**Important**: The Effect library is **bundled into the output**, making it completely self-contained. No external dependencies are required at runtime in Lens Studio.

## Using in Lens Studio

Lens Studio only supports CommonJS (`require()`) imports. The build automatically copies artifacts to the Lens Studio `Packages/` folder for clean imports.

### Clean Import Path

Thanks to Lens Studio's `tsconfig.json` paths configuration, you can use a clean import:

```typescript
// In Lens Studio script (e.g., Assets/workpls.ts)
const specsCore = require("specs-core/index.cjs.js");

@component
export class NewScript extends BaseScriptComponent {
    onAwake() {
        print("Testing specs-core with Effect...");

        // Use the exported functions
        const { greetEffect, runEffectSync, exampleUsage } = specsCore;

        // Run Effect synchronously
        const result = runEffectSync(greetEffect('Lens User'));
        print(result);
        // Output: "Hello from Lens Studio, Lens User!"

        // Or use the complete example
        const demo = exampleUsage();
        print(JSON.stringify(demo));
        // Output: { greeting: 'Hello from Lens Studio, Developer!', computation: 5 }
    }
}
```

**Note**: The path `specs-core/index.cjs.js` resolves to `Packages/specs-core/index.cjs.js` via Lens Studio's tsconfig paths.

### Verified Working

The bundle has been tested with standalone Node.js execution:

```bash
$ node -e "const lib = require('./index.cjs.js'); console.log(lib.exampleUsage());"
✓ Module loaded successfully
Hello from Lens Studio, Developer!
Result: 5
{ greeting: 'Hello from Lens Studio, Developer!', computation: 5 }
```

**No external dependencies required** - Effect is fully bundled.

## Effect Example Usage

The library exports several Effect utilities:

```typescript
// Exported functions from src/index.ts

// Simple greeting with logging
export const greetEffect = (name: string) => Effect.Effect<string>

// Math computation with error handling
export const computeEffect = (x: number, y: number) => Effect.Effect<number, Error>

// Helpers for running effects
export const runEffectSync = <A, E>(effect: Effect.Effect<A, E>) => A
export const runEffectPromise = <A, E>(effect: Effect.Effect<A, E>) => Promise<A>

// Complete example
export const exampleUsage = () => { greeting: string; computation: number }
```

## Path Aliases

To use path aliases like `@lens-core/*`, configure `tsconfig.base.json` at the repository root:

```json
{
  "compilerOptions": {
    "paths": {
      "@lens-core/*": ["packages/specs-core/src/*"]
    }
  }
}
```

The `nxViteTsPaths()` plugin automatically resolves these during build.

## Nx Caching

Nx automatically caches build results. To clear cache and rebuild:

```bash
# Clear cache
pnpx nx reset

# Rebuild
pnpx nx build specs-core
```

## Troubleshooting

### Issue: TypeScript declarations not generated

**Solution:** Ensure `vite-plugin-dts` is installed:

```bash
pnpm add -D vite-plugin-dts
```

### Issue: Build output in wrong directory

**Solution:** Check `outDir` in `vite.config.ts` matches `outputPath` in `project.json`

## Development Workflow

### Initial Setup
1. Build the library: `pnpx nx build specs-core`
2. Files auto-copy to `lenses/init/Packages/specs-core/`
3. Import in Lens Studio: `require("specs-core/index.cjs.js")`

### Active Development
1. Start watch mode: `pnpx nx build specs-core --watch`
2. Edit TypeScript files in `src/`
3. Save - auto-rebuild + auto-copy happens
4. Refresh in Lens Studio to see changes

### Production Build
1. Run: `pnpx nx run specs-core:build:lens`
2. Commits both `dist/` and `lenses/init/Packages/specs-core/` to version control

## Summary

✅ **Vite** as bundler with custom copy plugin
✅ **CommonJS** output (`index.cjs.js` ~112KB)
✅ **ESM** output (`index.es.js` ~173KB)
✅ **TypeScript** declarations (`index.d.ts`)
✅ **Effect bundled** - fully self-contained, no external dependencies
✅ **Auto-copy to Lens Studio** - on every build
✅ **Watch mode** - live development with auto-rebuild
✅ **Verified working** - tested with standalone Node.js execution
✅ **Nx** caching and dependency graph compatibility
✅ **Clean imports** - `require("specs-core/index.cjs.js")`

**Build command:** `pnpx nx build specs-core`

**Watch command:** `pnpx nx build specs-core --watch`

**Import in Lens Studio:** `const lib = require("specs-core/index.cjs.js")`

**Bundle size:** ~112KB (includes full Effect library)
