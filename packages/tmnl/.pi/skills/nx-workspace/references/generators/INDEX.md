# NX Generators

> up: ../INDEX.md
> prereqs: ../plugins/local-plugin.md
> provides: generator-concept, generator-usage, generator-authoring
> children: registration.md, schema.md, tree-api.md

## What Generators Are

Generators are code-scaffolding functions that modify the workspace filesystem through a virtual `Tree`. They create files, update JSON configs, and install dependencies — all atomically. If anything fails, nothing is written.

Think of them as **imperative codemods with a dry-run mode**. They live inside plugins. A plugin can have zero or many generators.

```
Plugin (e.g., ./tools/nx-effect)
├── createNodesV2    ← infers targets from existing files
└── generators/      ← creates new files from templates
    └── effect-v4-lib ← one generator
```

The generator receives a `Tree` (virtual filesystem) and typed `options` (from schema.json). It writes files to the Tree. NX flushes the Tree to disk. If `--dry-run`, NX shows what *would* be written without touching disk.

## Using Generators

```bash
bunx nx g ./tools/nx-effect:effect-v4-lib my-lib          # positional name
bunx nx g ./tools/nx-effect:effect-v4-lib --name=my-lib    # explicit
bunx nx g ./tools/nx-effect:effect-v4-lib my-lib --dry-run  # preview
bunx nx list ./tools/nx-effect                              # list available
```

Format: `bunx nx g <plugin>:<generator> [positional-args] [--options]`

## Available Generators

| Plugin | Generator | Purpose |
|---|---|---|
| `./tools/nx-effect` | `effect-v4-lib` | Scaffold @tmnl/* Effect v4 library |
| `@nx/next` | `application` | Next.js app (defaults: tailwind, eslint) |
| `@nx/react` | `library` | React library (default: no test runner) |

## Writing a Generator

A generator is three files registered through a fourth:

| What | File | Reference |
|---|---|---|
| Registration | `generators.json` → maps name to factory + schema | `registration.md` |
| Options definition | `schema.json` → JSON Schema with NX extensions | `schema.md` |
| Implementation | `generator.ts` → `async (tree: Tree, options) => void` | `tree-api.md` |

Read them in this order. Registration explains where generators live. Schema explains what options they accept. Tree API explains how to write the implementation.

## Cross-References
- `../plugins/local-plugin.md` — generators live inside plugins; understand plugin file structure first
- `../plugins/nx-effect.md` — the specific plugin that owns `effect-v4-lib`
