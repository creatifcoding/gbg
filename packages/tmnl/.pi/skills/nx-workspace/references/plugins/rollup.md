# @nx/rollup/plugin

> up: INDEX.md
> prereqs: none
> provides: build target (Rollup)
> children: none

## Source
`@nx/rollup/plugin` (npm)

## Infers From
`rollup.config.*` presence.

## Targets

| Target | What It Does | Cached |
|---|---|---|
| build | `rollup -c` | ✓ |
| build-deps | Build upstream deps | — |
| watch-deps | Watch upstream deps | — |

## Options (nx.json)

| Option | Default |
|---|---|
| buildTargetName | `"build"` |
| buildDepsTargetName | `"build-deps"` |
| watchDepsTargetName | `"watch-deps"` |

## When To Care
Used for packages that need Rollup-specific bundling (tree-shaking, multiple output formats). New @tmnl/* packages use tsc directly. Rollup is available if a package needs UMD/CJS output.
