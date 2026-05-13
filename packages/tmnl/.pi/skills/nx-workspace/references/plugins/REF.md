# NX Plugins — Conceptual Reference

> up: INDEX.md
> prereqs: none
> provides: plugin-mental-model, project-graph-mechanics, createNodesV2-lifecycle, target-inference-order
> children: none

## What Plugins Are

Plugins are functions that extend the NX project graph. They do two things:

1. **Discover projects** — scan for config files (e.g., `vite.config.ts`) and register project nodes in the graph
2. **Infer targets** — automatically add targets (build, test, lint) to discovered projects without explicit `project.json` config

A plugin exports up to three functions:

| Export | Purpose | When it runs |
|---|---|---|
| `createNodesV2` | Scan files → return project configs + targets | Graph construction |
| `createDependencies` | Add edges between projects | After nodes exist |
| `createMetadata` | Add arbitrary metadata to projects | After nodes + deps |

## How NX Resolves Plugins

```
nx.json plugins: ["./tools/nx-effect"]
                      │
                      ▼
1. require.resolve("./tools/nx-effect")
2. Read package.json → "main": "./src/index.ts"
3. Import createNodesV2, createDependencies from main
4. Read "generators": "./generators.json" for generator discovery
```

For npm plugins (`@nx/vite/plugin`), NX resolves from `node_modules`.
For local plugins (`./tools/nx-effect`), NX resolves relative to workspace root.

## createNodesV2 Lifecycle

```
1. NX reads nx.json → collects all plugins
2. For each plugin:
   a. Glob workspace for files matching plugin's pattern
      (e.g., "**/vitest.config.*")
   b. Apply include/exclude filters from nx.json
   c. Call createNodesV2(matchingFiles, options, context)
   d. Plugin returns: Array<[configFile, { projects, externalNodes }]>
3. Merge all project nodes into the graph
4. Call createDependencies for each plugin
5. Call createMetadata for each plugin
6. Validate graph (detect cycles, missing refs)
```

The `context` argument provides:
- `nxJsonConfiguration` — the full nx.json
- `workspaceRoot` — absolute path to repo root

## Target Inference Order: LAST WINS

**Critical:** If two plugins infer a target with the same name (e.g., both `@nx/vite` and `@nx/jest` infer `test`), the plugin listed **last** in `nx.json plugins` wins.

```json
{
  "plugins": [
    "@nx/jest/plugin",    // infers "test" → jest
    "@nx/vite/plugin"     // infers "test" → vitest ← THIS WINS
  ]
}
```

Our order matters. `@nx/vite/plugin` is listed after `@nx/jest/plugin`, so vitest wins for projects that have both configs.

## include/exclude

Each plugin entry can scope which files it processes:

```json
{
  "plugin": "@nx/vite/plugin",
  "include": ["packages/**/*"],
  "exclude": ["submodules/**", "receipts/**"]
}
```

The same plugin can be registered MULTIPLE times with different include/exclude to apply different options to different project sets.

## Metadata

Plugins can inject arbitrary metadata via `createMetadata` or by returning `metadata` in the project config from `createNodesV2`. This is visible via `bunx nx show project <name>` but does NOT affect targets or caching.

Our `nx-effect` plugin uses this to inject `effectVersion`, `aliasPackage`, `effectNpmVersion`.

## Project Graph Construction

The project graph has three node types:

| Type | What | Example |
|---|---|---|
| `ProjectGraphProjectNode` | Workspace project | `@tmnl/stx` |
| `ProjectGraphExternalNode` | npm dependency | `effect-v4` |
| `ProjectGraphDependency` | Edge between nodes | `@tmnl/stx → effect-v4` |

Dependency edges are computed from:
1. TypeScript static imports (file-level AST analysis)
2. `package.json` dependencies
3. `implicitDependencies` in project.json
4. Plugin `createDependencies` functions

## Caching & Hashing

NX hashes task inputs to determine cache hits:
- Source files of the project + upstream deps
- `nx.json` global config
- External dependency versions
- Environment variables (if configured)
- CLI flags
- Outputs of dependent tasks

Hash is computed by a native Rust hasher for performance.

## NX Daemon

The daemon keeps the graph in memory between commands:
- Watches filesystem via native Rust watcher
- Incrementally recomputes graph on file changes
- Debounces changes to prevent excessive rebuilds
- Falls back to full rebuild if project configs change

Disable for debugging: `NX_DAEMON=false bunx nx <cmd>`

---

## Re-Acquisition Protocol

If this reference becomes stale (NX major upgrade, API changes):

```
# Full re-research
deepwiki_ask_question("nrwl/nx", "How does createNodesV2 work end-to-end including project graph construction?")
deepwiki_ask_question("nrwl/nx", "How does NX plugin registration work? Resolution, options, include/exclude, processing order?")

# Quick validation
bunx nx --version                              # check current NX version
bunx nx show project @tmnl/stx                # verify metadata injection
bunx nx list ./tools/nx-effect                 # verify generator discovery

# Source of truth
https://nx.dev/extending-nx/creating-plugins
https://deepwiki.com/nrwl/nx (wiki pages 1.1, 3.4)
```

## Update Triggers

Re-research this doc when:
- NX major version changes (check `bunx nx --version`)
- `createNodesV2` signature changes (v3 announced)
- Plugin processing order semantics change
- New plugin types are added to the repo
- Cache/hash behavior changes affect CI

## Suggestions

- Consider writing a `createDependencies` function for `nx-effect` that adds graph edges from `effect:v4` packages to the `effect-v4` npm alias node. Currently these edges are inferred from source imports only.
- Monitor NX RFC for `createNodesV3` — batch API may evolve.
