# Effect v3 / v4 Coexistence — npm Alias Strategy

> Back to: `../SKILL.md`

## Problem

Root `package.json` pins `"overrides": { "effect": "3.19.18" }` for the entire workspace. Bun hoists deps and doesn't support per-workspace overrides or nested overrides. We need v4 in new packages without breaking the existing v3 codebase.

## Solution: npm Alias Protocol

v4 packages declare aliased dependencies:

```json
{
  "dependencies": {
    "effect-v4": "npm:effect@4.0.0-beta.23"
  },
  "devDependencies": {
    "effect-vitest-v4": "npm:@effect/vitest@4.0.0-beta.23",
    "effect-atom-react-v4": "npm:@effect/atom-react@4.0.0-beta.23"
  }
}
```

This installs `effect@4.0.0-beta.23` under `node_modules/effect-v4/`, completely separate from `node_modules/effect/` (v3).

## Import Paths

Source code uses the alias name:

```ts
// Core effect
import { Effect, Schema, Layer } from "effect-v4"

// Reactivity (atoms)
import { Atom, AsyncResult, AtomRegistry } from "effect-v4/unstable/reactivity"

// Testing
import { it, describe } from "effect-vitest-v4"

// React hooks
import { useAtomValue, useAtom } from "effect-atom-react-v4"
```

## Installing

```bash
# In a v4 package directory:
bun add effect-v4@npm:effect@4.0.0-beta.23
bun add -d effect-vitest-v4@npm:@effect/vitest@4.0.0-beta.23
bun add -d effect-atom-react-v4@npm:@effect/atom-react@4.0.0-beta.23
```

Or use the generator which handles all of this:
```bash
bunx nx g ./tools/nx-effect:effect-v4-lib my-lib --domain=state
```

## Module Boundary Enforcement

`eslint.config.mjs` bans `effect:v4`-tagged projects from importing bare `effect`:

```js
{
  sourceTag: 'effect:v4',
  bannedExternalImports: ['effect'],
}
```

This catches accidental `import { pipe } from "effect"` (v3) in a v4 package.

## What Won't Work

| Approach | Why it fails |
|---|---|
| Per-package pinning without alias | Bun root override wins, resolves v3 |
| `overrides` in child package.json | Bun ignores non-root overrides |
| Nested overrides `{ "effect": { "@tmnl/stx": "4.x" } }` | Bun explicitly warns: not supported |
| `file:../../submodules/effect-smol/packages/effect` | Works but fragile, not publishable |
| Removing root override | Risks v3 packages resolving v4 if ranges overlap |

## GA Migration Path

When Effect v4 goes stable:

1. Remove root `"overrides": { "effect": "3.19.18" }` from root package.json
2. Update all packages to `"effect": "^4.0.0"`
3. Bulk rename in v4 packages: `effect-v4` → `effect` in imports
4. Remove alias deps, replace with direct: `"effect": "^4.0.0"`
5. Remove `bannedExternalImports: ['effect']` from eslint
6. Remove `effect:v4` tags (all packages are now v4)
7. `bun install` — single version hoisted

Steps 3-4 can be automated with a codemod or NX generator.

## Version Pinning

All v4 alias packages must pin the SAME beta version. Currently `4.0.0-beta.23`.

When bumping:
1. Update `tools/nx-effect/src/generators/effect-v4-lib/generator.ts` constants
2. Update `tools/nx-effect/src/index.ts` EFFECT_V4_VERSION
3. Update each v4 package: `bun add effect-v4@npm:effect@4.0.0-beta.NEW`
4. Update companion packages similarly (vitest, atom-react)

Future: write a generator for this (`effect-v4-bump`).
