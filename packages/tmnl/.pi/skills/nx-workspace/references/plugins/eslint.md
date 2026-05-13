# @nx/eslint/plugin

> up: INDEX.md
> prereqs: none
> provides: lint target
> children: none

## Source
`@nx/eslint/plugin` (npm)

## Infers From
ESLint config presence (`eslint.config.mjs`, `.eslintrc.*`).

## Targets

| Target | What It Does | Cached |
|---|---|---|
| lint | `eslint .` | ✓ |

## Options (nx.json)

| Option | Default |
|---|---|
| targetName | `"lint"` |

## When To Care
Every project with an eslint config gets a `lint` target. Module boundary enforcement (`@nx/enforce-module-boundaries`) runs as part of lint. Running `bunx nx lint @tmnl/stx` validates the `effect:v4` boundary rules.

## Cross-References
- `../boundaries/INDEX.md` — boundary rules are enforced through this plugin's lint target
