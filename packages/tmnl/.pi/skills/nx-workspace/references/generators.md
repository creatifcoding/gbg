# NX Generators — Writing & Using

> Back to: `../SKILL.md`
> For plugin-level details → `plugins.md`

## Using Generators

```bash
bunx nx g ./tools/nx-effect:effect-v4-lib my-lib          # positional name
bunx nx g ./tools/nx-effect:effect-v4-lib --name=my-lib    # explicit
bunx nx g ./tools/nx-effect:effect-v4-lib my-lib --dry-run  # preview only
bunx nx list ./tools/nx-effect                              # list available
```

## File Structure

```
tools/my-plugin/
├── package.json          # { "generators": "./generators.json" }
├── generators.json       # name → { factory, schema, description }
└── src/generators/<name>/
    ├── schema.json       # JSON Schema for options
    ├── schema.d.ts       # TypeScript interface
    └── generator.ts      # default export: async (tree, options) => void
```

## generators.json

```json
{
  "generators": {
    "effect-v4-lib": {
      "factory": "./src/generators/effect-v4-lib/generator",
      "schema": "./src/generators/effect-v4-lib/schema.json",
      "description": "Scaffold an Effect v4 library",
      "x-type": "library"
    }
  }
}
```

NX resolves via `package.json` → `"generators"` field → this file → `factory` path.

## schema.json

```json
{
  "$schema": "https://json-schema.org/schema",
  "$id": "MyGenerator",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "$default": { "$source": "argv", "index": 0 },
      "x-prompt": "What name?"
    }
  },
  "required": ["name"]
}
```

NX extensions: `$default.$source: "argv"` (positional), `x-prompt` (interactive).

## Generator Function

```ts
import {
  type Tree,
  formatFiles,
  installPackagesTask,
  updateJson,
  joinPathFragments,
  logger,
} from "@nx/devkit"

export default async function myGenerator(tree: Tree, options: MySchema) {
  // Write
  tree.write("packages/foo/index.ts", "export {}")

  // Read
  const content = tree.read("path/to/file.ts")?.toString()

  // Update JSON (read-modify-write)
  updateJson(tree, "tsconfig.base.json", (json) => {
    json.compilerOptions.paths["@tmnl/foo"] = ["packages/foo/src/index.ts"]
    return json
  })

  // Format all changed files
  await formatFiles(tree)

  // Post-install callback (runs after tree is flushed)
  return () => { installPackagesTask(tree) }
}
```

## Tree API Quick Reference

| Method | Purpose |
|---|---|
| `tree.write(path, content)` | Create or overwrite |
| `tree.read(path)` | Read (Buffer \| null) |
| `tree.delete(path)` | Delete |
| `tree.exists(path)` | Check existence |
| `tree.rename(from, to)` | Move/rename |
| `tree.children(dir)` | List directory |
| `tree.listChanges()` | All pending changes |

## Utility Functions

| Function | Purpose |
|---|---|
| `joinPathFragments(a, b)` | Path join |
| `names("my-lib")` | `{ name, className, fileName, propertyName, constantName }` |
| `offsetFromRoot("libs/x")` | `"../../"` |
| `generateFiles(tree, src, dest, vars)` | Template files with EJS substitution |
| `readProjectConfiguration(tree, name)` | Read project.json |
| `updateProjectConfiguration(tree, name, config)` | Update project.json |
| `addDependenciesToPackageJson(tree, deps, devDeps)` | Add deps to root |
| `getProjects(tree)` | Map of all projects |
