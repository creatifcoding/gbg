# NX Plugins — createNodesV2 & Local Plugin Architecture

> Back to: `../SKILL.md`

## Plugin Structure

```
tools/my-plugin/
├── package.json          # { "generators": "./generators.json", "main": "./src/index.ts" }
├── generators.json       # Registers generators (see references/generators.md)
└── src/
    └── index.ts          # Exports: createNodesV2, createDependencies
```

## Registration

In `nx.json`:
```json
{
  "plugins": [
    {
      "plugin": "./tools/nx-effect",
      "exclude": ["submodules/**", "node_modules/**"],
      "options": { "extraTags": ["custom"] }
    }
  ]
}
```

NX resolves the plugin via `"main"` in its package.json.

## createNodesV2

The primary plugin API. Scans files matching a glob, returns project configuration.

### Type Signature

```ts
type CreateNodesV2<T = unknown> = [
  filePattern: string,
  (
    configFiles: readonly string[],
    options: T | undefined,
    context: CreateNodesContextV2
  ) => CreateNodesResultV2 | Promise<CreateNodesResultV2>
]
```

`CreateNodesContextV2` provides:
- `nxJsonConfiguration` — parsed nx.json
- `workspaceRoot` — absolute path to repo root

`CreateNodesResultV2` — array of `[configFilePath, { projects, externalNodes }]`

### Pattern: Using createNodesFromFiles

```ts
import {
  type CreateNodesV2,
  createNodesFromFiles,
  readJsonFile,
  joinPathFragments,
} from "@nx/devkit"
import { existsSync } from "node:fs"

export const createNodesV2: CreateNodesV2<MyOptions> = [
  "**/project.json",
  async (configFiles, options, context) => {
    return createNodesFromFiles(
      (configFile, opts, ctx) => {
        const root = configFile.replace("/project.json", "")
        const fullPath = joinPathFragments(ctx.workspaceRoot, configFile)

        if (!existsSync(fullPath)) return {}

        const projectJson = readJsonFile(fullPath)
        const tags: string[] = projectJson.tags ?? []

        if (!tags.includes("my-tag")) return {}

        return {
          projects: {
            [root]: {
              metadata: { myPlugin: true },
              // Can also add targets, tags, etc.
            },
          },
        }
      },
      configFiles,
      options,
      context,
    )
  },
]
```

### What You Can Return

Per project, you can provide:
- `targets` — additional inferred targets
- `tags` — additional tags
- `metadata` — arbitrary metadata (visible in `bunx nx show project`)
- `root`, `name`, `sourceRoot`, `projectType` — overrides (rare)

### createNodes v1 vs v2

| v1 (`createNodes`) | v2 (`createNodesV2`) |
|---|---|
| Processes one file at a time | Batch processes all files |
| Returns single result | Returns array of results |
| Deprecated in NX 21+ | Current standard |

NX 21+ only supports v2. For compatibility, export both using the same v2 logic.

## createDependencies

Optional. Adds implicit dependencies to the project graph.

```ts
import { type CreateDependencies } from "@nx/devkit"

export const createDependencies: CreateDependencies = (options, context) => {
  // Return array of { source, target, type } dependency objects
  return []
}
```

Use for: cross-language deps, convention-based deps, validation-only deps.

## Our Plugin: @gbg/nx-effect

**Location**: `tools/nx-effect/`

**What it does**:
1. `createNodesV2` — scans for `effect:v4` tagged projects, injects metadata
2. `createDependencies` — placeholder for future v3/v4 boundary validation
3. Generator `effect-v4-lib` — scaffolds new @tmnl/* v4 packages

**Metadata injected** on `effect:v4` projects:
```json
{
  "effectVersion": "v4",
  "aliasPackage": "effect-v4",
  "effectNpmVersion": "4.0.0-beta.23"
}
```

Visible via `bunx nx show project @tmnl/stx` under `metadata`.
