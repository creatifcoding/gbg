# NX Generators — Conceptual Reference

> up: INDEX.md
> prereqs: ../plugins/REF.md
> provides: generator-lifecycle, tree-api, template-interpolation, devkit-utilities
> children: none

## What Generators Are

Generators are **atomic filesystem transformations** with dry-run. They operate on a virtual `Tree` (in-memory FS), and NX only flushes to disk after the generator succeeds. If anything throws, nothing is written.

They are NOT build tools. They scaffold code and config files. Think of them as "codemods with templates."

## Generator Lifecycle (End-to-End)

```
CLI: bunx nx g ./tools/nx-effect:effect-v4-lib my-lib
                    │
                    ▼
1. Parse plugin path → resolve ./tools/nx-effect
2. Read generators.json → find "effect-v4-lib" entry
3. Read schema.json → validate + combine options with defaults
4. Prompt for missing required options (if interactive)
5. Create FsTree (virtual filesystem = snapshot of workspace)
6. Call generator function: async (tree: Tree, options) => void
7. Generator reads/writes/deletes on the Tree
8. tree.listChanges() → collect all modifications
9. If --dry-run: print changes, write NOTHING
10. If not dry-run: flushChanges(workspaceRoot, changes)
11. If generator returns a callback: execute it (e.g., installPackagesTask)
```

The callback return is important — `installPackagesTask` runs AFTER files are flushed, because `bun install` needs the package.json on disk.

## Tree API

The `Tree` is the core abstraction. Every file operation goes through it.

| Method | Signature | Notes |
|---|---|---|
| `tree.read` | `(path: string, encoding?: string) => Buffer \| string \| null` | Returns null if file doesn't exist |
| `tree.write` | `(path: string, content: string \| Buffer) => void` | Creates or overwrites |
| `tree.exists` | `(path: string) => boolean` | Files AND directories |
| `tree.delete` | `(path: string) => void` | Files and directories (recursive) |
| `tree.rename` | `(from: string, to: string) => void` | Move/rename |
| `tree.listChanges` | `() => FileChange[]` | All staged changes: CREATE, UPDATE, DELETE |
| `tree.children` | `(dirPath: string) => string[]` | List directory contents |

`FileChange` shape: `{ path: string; type: 'CREATE' | 'UPDATE' | 'DELETE'; content: Buffer | null }`

## generateFiles vs tree.write

| | `tree.write` | `generateFiles` |
|---|---|---|
| Scope | One file | Directory of templates |
| Interpolation | None — raw content | EJS + filename vars |
| Use when | Programmatic content, JSON manipulation | Scaffolding file trees from templates |

### generateFiles

```ts
import { generateFiles, joinPathFragments } from '@nx/devkit'

generateFiles(
  tree,                                              // Tree
  joinPathFragments(__dirname, './files'),            // template source dir
  joinPathFragments('packages', options.name),        // destination
  {                                                   // template variables
    name: options.name,
    domain: options.domain,
    tmpl: '',                                         // strips __tmpl__ from filenames
  }
)
```

### Template Interpolation

**In file content** (EJS syntax):
```
// <%= name %> generates the value
// <%- name %> generates unescaped HTML
```

**In filenames**:
- `__name__` → replaced with the `name` variable value
- `__tmpl__` → stripped entirely (marks "this is a template file")

Example: `src/__name__/index.ts__tmpl__` with `{name: 'stx', tmpl: ''}` becomes `src/stx/index.ts`

## Essential @nx/devkit Utilities

| Utility | What it does |
|---|---|
| `readProjectConfiguration(tree, name)` | Read project.json config from Tree |
| `updateProjectConfiguration(tree, name, config)` | Write project.json config to Tree |
| `addProjectConfiguration(tree, name, config)` | Create new project entry |
| `readJson(tree, path)` / `writeJson(tree, path, obj)` | Type-safe JSON read/write |
| `updateJson(tree, path, updater)` | Read-modify-write JSON atomically |
| `addDependenciesToPackageJson(tree, deps, devDeps)` | Merge deps into root package.json |
| `formatFiles(tree)` | Run prettier on all changed files |
| `installPackagesTask` | Returns callback to run `bun install` after flush |
| `names(name)` | Generate `{ name, className, propertyName, constantName, fileName }` |
| `joinPathFragments(...parts)` | Path.join but normalized |
| `offsetFromRoot(path)` | Relative `../../..` from project root to workspace root |

## Generator Function Signature

```ts
import { Tree, formatFiles, installPackagesTask } from '@nx/devkit'
import type { MySchemaOptions } from './schema'

export default async function myGenerator(tree: Tree, options: MySchemaOptions) {
  // 1. Read existing state
  const existing = readJson(tree, 'tsconfig.base.json')

  // 2. Write new files
  generateFiles(tree, join(__dirname, 'files'), `packages/${options.name}`, { ...options, tmpl: '' })

  // 3. Update existing files
  updateJson(tree, 'tsconfig.base.json', (json) => {
    json.compilerOptions.paths[`@tmnl/${options.name}`] = [`packages/${options.name}/src/index.ts`]
    return json
  })

  // 4. Format
  await formatFiles(tree)

  // 5. Return post-flush callback
  return () => { installPackagesTask(tree) }
}
```

## Composition

Generators can call other generators:

```ts
import { libraryGenerator } from '@nx/js'

export default async function myGenerator(tree: Tree, options: MyOptions) {
  // Compose: first scaffold a standard JS library
  await libraryGenerator(tree, { name: options.name, /* ... */ })

  // Then add our custom files on top
  generateFiles(tree, join(__dirname, 'files'), `packages/${options.name}`, options)
}
```

Changes from composed generators accumulate on the same Tree. Atomicity is preserved.

---

## Re-Acquisition Protocol

If this reference becomes stale (NX major upgrade, devkit API changes):

```
# Full re-research
deepwiki_ask_question("nrwl/nx", "How does the NX Tree API work in generators? generateFiles, template interpolation, devkit utilities?")
deepwiki_ask_question("nrwl/nx", "What is the full lifecycle of an NX generator from CLI invocation to file system changes?")

# Quick validation
bunx nx g ./tools/nx-effect:effect-v4-lib test-pkg --dry-run   # verify generator still works
grep -r "from '@nx/devkit'" tools/nx-effect/                     # audit which devkit APIs we use

# Source of truth
https://nx.dev/extending-nx/recipes/local-generators
https://nx.dev/nx-api/devkit/documents/nx_devkit
https://deepwiki.com/nrwl/nx (wiki page on generators)
```

## Update Triggers

Re-research this doc when:
- NX major version changes
- `@nx/devkit` API breaks (check NX migration guide)
- Tree API methods change
- `generateFiles` template syntax changes
- New devkit utilities appear that simplify our generator

## Suggestions

- Our `effect-v4-lib` generator uses `tree.write` for everything. Consider migrating to `generateFiles` with a `files/` template directory for cleaner scaffolding.
- Consider adding a `--withTests` option that scaffolds a test file with `effect-vitest-v4` imports.
- `addDependenciesToPackageJson` could replace our manual `updateJson(tree, packageJsonPath, ...)` calls.
