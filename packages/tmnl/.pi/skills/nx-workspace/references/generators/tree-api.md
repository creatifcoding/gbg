# Generator Tree API & Utilities

> Back to: `INDEX.md`

## Generator Function Signature

```ts
import { type Tree, formatFiles, installPackagesTask } from "@nx/devkit"

export default async function myGenerator(tree: Tree, options: MySchema) {
  // ... modify tree ...
  await formatFiles(tree)
  return () => { installPackagesTask(tree) }
}
```

Default export. Async. Receives virtual filesystem (`Tree`) and typed options.

## Tree Methods

| Method | Purpose |
|---|---|
| `tree.write(path, content)` | Create or overwrite file |
| `tree.read(path)` | Read file → `Buffer \| null` |
| `tree.delete(path)` | Delete file |
| `tree.exists(path)` | Check existence → boolean |
| `tree.rename(from, to)` | Move/rename |
| `tree.children(dir)` | List directory → string[] |
| `tree.listChanges()` | All pending changes |

## Key Utilities (@nx/devkit)

```ts
import {
  // Paths
  joinPathFragments,        // join path segments
  offsetFromRoot,           // offsetFromRoot("libs/x") → "../../"
  names,                    // names("my-lib") → { name, className, fileName, propertyName, constantName }

  // JSON
  updateJson,               // updateJson(tree, path, (json) => { ...; return json })
  readJsonFile,             // read JSON from disk (not tree)

  // Templates
  generateFiles,            // generateFiles(tree, srcDir, destDir, substitutions)
                            // EJS: <%= name %>, __name__ in filenames

  // Projects
  readProjectConfiguration, // readProjectConfiguration(tree, projectName)
  updateProjectConfiguration,
  getProjects,              // Map<string, ProjectConfiguration>

  // Dependencies
  addDependenciesToPackageJson,
  removeDependenciesFromPackageJson,

  // NX config
  readNxJson,
  updateNxJson,

  // Lifecycle
  formatFiles,              // Prettier format all changed files
  installPackagesTask,      // Return from generator for post-install
  logger,                   // logger.info(), logger.warn(), logger.error()
} from "@nx/devkit"
```

## Template Files (generateFiles)

```
src/generators/my-gen/files/
  src/
    __name__.ts.template     # __name__ replaced with options.name
```

```ts
generateFiles(tree, joinPathFragments(__dirname, "./files"), projectRoot, {
  ...options,
  tmpl: "",  // removes .template suffix
})
```

Inside templates, use EJS: `<%= name %>`, `<%= className %>`.
