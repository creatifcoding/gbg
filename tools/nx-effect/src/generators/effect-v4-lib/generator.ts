/**
 * NX Generator: scaffold a new Effect v4 library package.
 *
 * Usage:
 *   nx g @gbg/nx-effect:effect-v4-lib stx --domain=state --withXState --withReact
 *   nx g @gbg/nx-effect:effect-v4-lib layers --domain=ui --withReact
 *
 * Creates:
 *   packages/<name>/
 *   ├── package.json        (effect-v4 alias deps)
 *   ├── project.json        (effect:v4 tag, NX targets)
 *   ├── tsconfig.json
 *   ├── vitest.config.ts
 *   └── src/
 *       └── index.ts
 *
 * Also updates:
 *   tsconfig.base.json      (adds @tmnl/<name> path aliases)
 */

import {
  type Tree,
  formatFiles,
  installPackagesTask,
  updateJson,
  joinPathFragments,
  logger,
} from "@nx/devkit"
import type { EffectV4LibSchema } from "./schema"

// ─── Constants ──────────────────────────────────────

const EFFECT_V4_ALIAS = "effect-v4"
const EFFECT_V4_NPM = "npm:effect@4.0.0-beta.23"

const EFFECT_VITEST_V4_ALIAS = "effect-vitest-v4"
const EFFECT_VITEST_V4_NPM = "npm:@effect/vitest@4.0.0-beta.23"

const EFFECT_ATOM_REACT_V4_ALIAS = "effect-atom-react-v4"
const EFFECT_ATOM_REACT_V4_NPM = "npm:@effect/atom-react@4.0.0-beta.23"

// ─── Generator ──────────────────────────────────────

export default async function effectV4LibGenerator(
  tree: Tree,
  options: EffectV4LibSchema,
) {
  const name = options.name
  const projectRoot = `packages/${name}`
  const fullName = `@tmnl/${name}`
  const domain = options.domain ?? "lib"
  const withReact = options.withReact ?? true
  const withXState = options.withXState ?? false

  logger.info(`\n⚡ Scaffolding Effect v4 library: ${fullName}`)
  logger.info(`   Directory: ${projectRoot}/`)
  logger.info(`   Domain: ${domain}`)
  logger.info(`   React: ${withReact}, XState: ${withXState}\n`)

  // ── package.json ────────────────────────────────

  const deps: Record<string, string> = {
    [EFFECT_V4_ALIAS]: EFFECT_V4_NPM,
  }
  if (withXState) {
    deps["xstate"] = "^5.20.0"
  }

  const devDeps: Record<string, string> = {
    typescript: "^5.9.3",
    vitest: "^4.0.18",
    [EFFECT_VITEST_V4_ALIAS]: EFFECT_VITEST_V4_NPM,
  }
  if (withReact) {
    devDeps[EFFECT_ATOM_REACT_V4_ALIAS] = EFFECT_ATOM_REACT_V4_NPM
  }
  if (withXState) {
    devDeps["@xstate/react"] = "^6.1.0"
  }

  const peerDeps: Record<string, string> = {}
  const peerDepsMeta: Record<string, { optional: boolean }> = {}
  if (withReact) {
    peerDeps["react"] = ">=18.0.0"
    peerDeps["@effect/atom-react"] = ">=4.0.0-beta.0"
    peerDepsMeta["@effect/atom-react"] = { optional: true }
  }
  if (withXState) {
    peerDeps["@xstate/react"] = ">=4.0.0"
    peerDepsMeta["@xstate/react"] = { optional: true }
  }

  const packageJson: Record<string, unknown> = {
    name: fullName,
    version: "0.0.1",
    description: options.description || `${fullName} — Effect v4 library`,
    type: "module",
    main: "./dist/index.js",
    types: "./dist/index.d.ts",
    exports: {
      ".": {
        import: "./dist/index.js",
        types: "./dist/index.d.ts",
      },
    },
    files: ["dist", "README.md"],
    scripts: {
      build: "tsc",
      dev: "tsc --watch",
      test: "vitest",
      "test:run": "vitest run",
      "test:ci": "vitest run --reporter=junit --outputFile=reports/junit.xml",
      typecheck: "tsc --noEmit",
      clean: "rm -rf dist reports",
      prepublishOnly: "bun run clean && bun run build",
    },
    dependencies: deps,
    devDependencies: devDeps,
    ...(Object.keys(peerDeps).length > 0 ? { peerDependencies: peerDeps } : {}),
    ...(Object.keys(peerDepsMeta).length > 0 ? { peerDependenciesMeta: peerDepsMeta } : {}),
    publishConfig: { access: "public" },
    license: "MIT",
    author: "GBG",
    keywords: ["effect-ts", "effect-v4", name],
  }

  tree.write(
    joinPathFragments(projectRoot, "package.json"),
    JSON.stringify(packageJson, null, 2) + "\n",
  )

  // ── project.json ────────────────────────────────

  const projectJson = {
    name: fullName,
    $schema: "../../node_modules/nx/schemas/project-schema.json",
    sourceRoot: `${projectRoot}/src`,
    projectType: "library",
    tags: ["scope:tmnl", "type:lib", `domain:${domain}`, "effect:v4"],
    targets: {
      build: {
        executor: "nx:run-commands",
        options: { command: "bun run build", cwd: projectRoot },
        dependsOn: ["^build"],
        cache: true,
        inputs: ["default", "^default"],
        outputs: ["{projectRoot}/dist"],
      },
      test: {
        executor: "nx:run-commands",
        options: { command: "bun run test:run", cwd: projectRoot },
        cache: true,
        inputs: ["default", "^default"],
      },
      typecheck: {
        executor: "nx:run-commands",
        options: { command: "bun run typecheck", cwd: projectRoot },
        cache: true,
        inputs: ["default", "^default"],
      },
      clean: {
        executor: "nx:run-commands",
        options: { command: "bun run clean", cwd: projectRoot },
      },
    },
  }

  tree.write(
    joinPathFragments(projectRoot, "project.json"),
    JSON.stringify(projectJson, null, 2) + "\n",
  )

  // ── tsconfig.json ───────────────────────────────

  const tsconfig: Record<string, unknown> = {
    extends: "../../tsconfig.base.json",
    compilerOptions: {
      outDir: "./dist",
      rootDir: "./src",
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      module: "ESNext",
      moduleResolution: "bundler",
      target: "ES2022",
      lib: ["ES2022", ...(withReact ? ["DOM"] : [])],
      ...(withReact
        ? { jsx: "react-jsx", jsxImportSource: "react" }
        : {}),
    },
    include: ["src/**/*"],
    exclude: ["node_modules", "dist", "test", "**/*.test.ts"],
  }

  tree.write(
    joinPathFragments(projectRoot, "tsconfig.json"),
    JSON.stringify(tsconfig, null, 2) + "\n",
  )

  // ── vitest.config.ts ────────────────────────────

  tree.write(
    joinPathFragments(projectRoot, "vitest.config.ts"),
    [
      `import { defineConfig } from "vitest/config"`,
      ``,
      `export default defineConfig({`,
      `  test: {`,
      `    globals: true,`,
      `    environment: "node",`,
      `    include: ["src/**/*.test.ts", "test/**/*.test.ts"],`,
      `  },`,
      `})`,
      ``,
    ].join("\n"),
  )

  // ── src/index.ts ────────────────────────────────

  tree.write(
    joinPathFragments(projectRoot, "src/index.ts"),
    [
      `/**`,
      ` * ${fullName} — Effect v4 library`,
      ` *`,
      ` * @module`,
      ` */`,
      ``,
      `export {}`,
      ``,
    ].join("\n"),
  )

  // ── tsconfig.base.json path aliases ─────────────

  updateJson(tree, "tsconfig.base.json", (json) => {
    const paths = json.compilerOptions?.paths ?? {}
    paths[fullName] = [`${projectRoot}/src/index.ts`]
    paths[`${fullName}/*`] = [`${projectRoot}/src/*`]
    json.compilerOptions = { ...json.compilerOptions, paths }
    return json
  })

  // ── Format + install ────────────────────────────

  await formatFiles(tree)

  logger.info(`✅ ${fullName} scaffolded at ${projectRoot}/`)
  logger.info(`   Run: cd ${projectRoot} && bun install`)
  logger.info(`   Test: nx test ${fullName}`)
  logger.info(`   Build: nx build ${fullName}\n`)

  return () => {
    installPackagesTask(tree)
  }
}
