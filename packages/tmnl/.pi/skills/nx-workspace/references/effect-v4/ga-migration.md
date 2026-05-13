# GA Migration Plan — When v4 Goes Stable

> Back to: `INDEX.md`

## Trigger

Effect publishes `effect@4.0.0` (no beta tag) to npm.

## Steps

1. Remove root override: delete `"overrides": { "effect": "3.19.18" }` from root package.json
2. Update all packages: `"effect": "^4.0.0"` as direct dependency
3. Bulk rename imports in v4 packages: `effect-v4` → `effect`
4. Replace alias deps with direct: `"effect-v4": "npm:..."` → `"effect": "^4.0.0"`
5. Same for companions: `effect-vitest-v4` → `@effect/vitest`, `effect-atom-react-v4` → `@effect/atom-react`
6. Remove `bannedExternalImports: ['effect']` from eslint
7. Remove `effect:v4` tags (all packages are now v4)
8. `bun install` — single version, clean hoisting

## Automation

Steps 3-5 can be a codemod or NX generator (`effect-v4-migrate`). Pattern:
- Walk all files in tagged projects
- `s/effect-v4/effect/g` in imports
- Update package.json deps

## Timeline

Not urgent. The alias strategy works indefinitely. Migrate when:
- v4 is stable and published
- All packages have been migrated from v3
- CI confirms zero v3 imports remain
