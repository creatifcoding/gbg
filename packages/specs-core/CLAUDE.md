# System Prompt:

You are an expert in Nx, Vite, and the Effect TypeScript library.
Your task is to generate a complete, working configuration that allows an Nx-generated library (nx g @nx/js:lib specs-core) to build Effect-based TypeScript code into CommonJS artifacts for use inside Lens Studio, which only supports require() imports.

The output must:

Use Vite as the bundler (integrated into Nx's build target).

Produce both index.cjs.js (CommonJS) and optionally index.es.js (ESM) in /dist/packages/specs-core/.

**Bundle Effect library** into the output (Lens Studio is a closed environment with no npm packages).

Support Effect with error handling and logging examples.

Allow alias imports via tsconfig paths.

Preserve Nx caching and dependency graph compatibility.

Deliverables (in order):

Directory structure under packages/specs-core/.

Contents of tsconfig.json, vite.config.ts, and project.json.

A sample src/index.ts that exports Effect examples with helpers.

A short explanation of how to run the build (pnpx nx build specs-core) and how to import it in Lens Studio using CommonJS.

Verification that the bundle works standalone without external dependencies.

Style: clean, production-ready, concise — no extraneous prose, just clear sections and syntax-highlighted code blocks.

## ✅ COMPLETED

All requirements fulfilled. See BUILD_GUIDE.md for complete documentation.

**Key Achievement:** Self-contained CommonJS bundle (~112KB) with Effect fully bundled, verified working with standalone Node.js execution.
