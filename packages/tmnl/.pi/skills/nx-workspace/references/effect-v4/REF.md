# Effect v4 Isolation — Conceptual Reference

> up: INDEX.md
> prereqs: ../boundaries/REF.md
> provides: alias-protocol-deep-understanding, bun-workspace-constraints, v4-module-resolution
> children: none
> cross: ../boundaries/REF.md

## Why This Is Hard

The problem is Bun's hoisting model. In a Bun workspace:

1. `bun install` hoists ALL deps to root `node_modules/`
2. `package.json` `overrides` field pins a single version for the entire workspace
3. There is NO `nohoist` equivalent (yarn has it, pnpm has it, bun doesn't)
4. Two `node_modules/effect/` can't coexist — one version wins globally

So you can't have `packages/tmnl` using `effect@3.19.18` and `packages/stx` using `effect@4.0.0-beta.23` under the same import name.

## The npm Alias Solution

npm's `alias:` protocol (supported by Bun) lets you install a package under a different name:

```json
// packages/stx/package.json
{
  "dependencies": {
    "effect-v4": "npm:effect@4.0.0-beta.23"
  }
}
```

This creates `node_modules/effect-v4/` containing Effect v4, while `node_modules/effect/` remains Effect v3. The two never collide.

### What happens at the module level

```
node_modules/
├── effect/                  ← v3 (3.19.18, from root override)
│   ├── package.json
│   ├── dist/
│   └── ...
├── effect-v4/               ← v4 (4.0.0-beta.23, from alias)
│   ├── package.json         ← name is still "effect" inside, but installed as "effect-v4"
│   ├── dist/
│   │   └── unstable/
│   │       └── reactivity/  ← Atom.js, AtomRegistry.js
│   └── ...
├── effect-vitest-v4/        ← @effect/vitest v4
└── effect-atom-react-v4/    ← @effect/atom-react v4
```

### Import resolution

```ts
import { Effect } from "effect-v4"
// → resolves to node_modules/effect-v4/dist/index.js
// → which is Effect v4 (4.0.0-beta.23)

import { Effect } from "effect"
// → resolves to node_modules/effect/dist/index.js
// → which is Effect v3 (3.19.18)
```

Subpath imports work too:
```ts
import { Atom } from "effect-v4/unstable/reactivity"
// → resolves to node_modules/effect-v4/dist/unstable/reactivity/index.js
```

This works because npm alias only changes the installed directory name, not the package's internal `exports` map.

## Enforcement Stack

Three layers prevent v3/v4 contamination:

| Layer | What | How |
|---|---|---|
| **npm alias** | Physical isolation | Different `node_modules` directories |
| **ESLint boundary** | Import-time check | `bannedExternalImports: ['effect']` on `effect:v4` tagged projects |
| **NX plugin metadata** | Documentation | `effectVersion: "v4"` visible in `bunx nx show project` |

If someone writes `import { Effect } from "effect"` in an `effect:v4` package, ESLint catches it at lint time. If they bypass ESLint, they get v3 at runtime (wrong version, likely type errors or runtime failures).

## TypeScript Considerations

TypeScript resolves types from the same `node_modules/effect-v4/` path. Since Effect v4 ships `.d.ts` files, types resolve correctly. But:

- The `effect-v4` package name doesn't match the `@types/effect` convention. This is fine because Effect ships its own types (no DefinitelyTyped).
- `tsconfig.json` paths are NOT needed for alias resolution — Node/Bun module resolution handles it.
- BUT we DO have `@tmnl/stx` paths in `tsconfig.base.json` for workspace package resolution (separate concern).

## Cost: Rename at GA

When Effect v4 goes stable, we bulk-rename:

```bash
# In source files
find packages/ -name '*.ts' -exec sed -i 's/from "effect-v4/from "effect/g' {} +
find packages/ -name '*.ts' -exec sed -i 's/from "effect-vitest-v4/from "@effect\/vitest/g' {} +

# In package.json
# Replace "effect-v4": "npm:effect@4.x" with "effect": "4.x"
```

See `ga-migration.md` for the full plan.

## What Doesn't Work (and Why)

Full analysis in `why-not-alternatives.md`, but the headlines:

| Approach | Why it fails |
|---|---|
| Per-package `overrides` in package.json | Bun ignores nested overrides — only root `overrides` is respected |
| `nohoist` | Bun doesn't support it. Yarn/pnpm concept. |
| `tsconfig.json` paths remapping | Works for types, breaks runtime resolution. Module is still resolved from `node_modules/effect/` at runtime. |
| Separate `node_modules` per package | Bun's workspace model doesn't support isolated installs per package. |
| Pinning v4 in root `overrides` | Breaks ALL v3 consumers. TMNL, gotby, everything. |

---

## Re-Acquisition Protocol

If this reference becomes stale (Bun behavior changes, Effect v4 GA, alias issues):

```
# Research Bun workspace behavior
deepwiki_ask_question("oven-sh/bun", "How does Bun handle workspace hoisting? Can packages have different versions of the same dep?")

# Research Effect v4 changes
deepwiki_ask_question("Effect-TS/effect", "What is the Effect v4 module structure? What are the subpath exports?")

# Quick validation
ls node_modules/effect-v4/dist/unstable/reactivity/     # verify v4 structure exists
bun pm ls effect-v4                                       # verify alias resolves
node -e "console.log(require.resolve('effect-v4'))"       # verify Node resolution

# Source of truth for alias protocol
https://docs.npmjs.com/cli/v10/configuring-npm/package-json#dependencies (search "alias")
https://bun.sh/docs/install/workspaces

# Source of truth for Effect v4
submodules/effect-smol/packages/effect/package.json       # exports map
submodules/effect-smol/packages/effect/src/unstable/      # v4 API source
```

## Update Triggers

Re-research this doc when:
- Effect v4 reaches GA or RC (alias strategy may become unnecessary)
- Bun adds `nohoist` or per-workspace override support (alternative becomes viable)
- New `effect-v4` subpath imports are needed (check `exports` in effect-smol)
- Module resolution errors appear (alias might have broken)
- New `@effect/*` companion packages need v4 aliases

## Suggestions

- Write a `bunx nx g ./tools/nx-effect:effect-v4-bump` generator that reads `effectNpmVersion` from the plugin constants and updates all v4 package.json files atomically.
- Add a CI check: `grep -r 'from "effect"' packages/stx/src/` should return 0 matches.
- When Effect v4 RC drops, run the GA migration plan as a dry-run to estimate the rename scope.
- Monitor `bun` releases for workspace isolation features — if they add `nohoist`, we can simplify.
