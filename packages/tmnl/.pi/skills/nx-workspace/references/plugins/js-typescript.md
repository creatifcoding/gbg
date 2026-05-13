# @nx/js/typescript

> up: INDEX.md
> prereqs: none
> provides: typecheck, build, build-deps, watch-deps targets
> children: none

## Source
`@nx/js/typescript` (npm)

## Infers From
`tsconfig.json` presence. Build target requires `tsconfig.lib.json`.

## Targets

| Target | What It Does | Cached |
|---|---|---|
| typecheck | `tsc --noEmit` | ✓ |
| build | `tsc` (if tsconfig.lib.json exists) | ✓ |
| build-deps | Build upstream deps first | — |
| watch-deps | Watch upstream deps for rebuild | — |

## Options (nx.json)

| Option | Default | Purpose |
|---|---|---|
| typecheck.targetName | `"typecheck"` | Name of the typecheck target |
| build.targetName | `"build"` | Name of the build target |
| build.configName | `"tsconfig.lib.json"` | Which tsconfig triggers build inference |
| build.buildDepsName | `"build-deps"` | Name of the dep-building target |
| build.watchDepsName | `"watch-deps"` | Name of the dep-watching target |

## When To Care
Every TypeScript package gets typecheck for free. If you need `build` inferred, create a `tsconfig.lib.json`. For stx/v4 packages we define explicit build targets in project.json instead.
