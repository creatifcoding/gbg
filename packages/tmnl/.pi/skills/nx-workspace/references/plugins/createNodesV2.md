# createNodesV2 — Plugin Target Inference API

> up: INDEX.md
> prereqs: ../boundaries/INDEX.md
> provides: createNodesV2-api, plugin-writing
> children: none

## Type Signature

```ts
type CreateNodesV2<T = unknown> = [
  filePattern: string,
  (
    configFiles: readonly string[],
    options: T | undefined,
    context: CreateNodesContextV2
  ) => CreateNodesResultV2 | Promise<CreateNodesResultV2>
]

// context provides:
interface CreateNodesContextV2 {
  nxJsonConfiguration: NxJsonConfiguration
  workspaceRoot: string
}

// result is array of [file, { projects, externalNodes }]
type CreateNodesResultV2 = Array<[string, CreateNodesResult]>
```

## Pattern: createNodesFromFiles Helper

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

        const project = readJsonFile(fullPath)
        if (!project.tags?.includes("my-tag")) return {}

        return {
          projects: {
            [root]: {
              targets: { /* inferred targets */ },
              metadata: { /* arbitrary data */ },
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

## Return Shape Per Project

| Field | Type | Purpose |
|---|---|---|
| `targets` | Record<string, TargetConfig> | Additional/override targets |
| `tags` | string[] | Additional tags |
| `metadata` | Record<string, unknown> | Visible in `bunx nx show project` |

## v1 vs v2

| | v1 | v2 |
|---|---|---|
| Processing | One file at a time | Batch (all files) |
| Return | Single result | Array of results |
| Status | Deprecated NX 21+ | Current standard |
