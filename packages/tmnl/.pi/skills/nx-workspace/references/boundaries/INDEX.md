# Module Boundaries — Dependency Constraints

> up: ../INDEX.md
> prereqs: none
> provides: module-boundary-rules, tag-enforcement
> children: dep-constraints.md, migration-pattern.md
> cross: ../effect-v4/INDEX.md

## Config Location

`eslint.config.mjs` → `@nx/enforce-module-boundaries` rule.

## Current Rules

```js
depConstraints: [
  {
    sourceTag: 'effect:v4',
    onlyDependOnLibsWithTags: ['effect:v4'],
    bannedExternalImports: ['effect'],
  },
  {
    sourceTag: '*',
    onlyDependOnLibsWithTags: ['*'],
  },
]
```

**Effect**: `effect:v4` packages can ONLY import from other `effect:v4` packages. Bare `effect` (v3) is banned.

## Checking

```bash
bunx nx lint @tmnl/stx          # single project
bunx nx affected -t lint         # changed projects
bunx nx run-many -t lint         # everything
```

## Contents

| File | When to read |
|---|---|
| `dep-constraints.md` | Full depConstraints API, all options |
| `migration-pattern.md` | Step-by-step v3→v4 per-package migration |

## Cross-References
- `../effect-v4/INDEX.md` — the alias strategy that the boundary rules enforce
- `../plugins/eslint.md` — lint target that runs these rules
