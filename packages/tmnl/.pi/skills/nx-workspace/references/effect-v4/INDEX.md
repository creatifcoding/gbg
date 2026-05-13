# Effect v3 / v4 Coexistence

> up: ../INDEX.md
> prereqs: none
> provides: v4-alias-strategy, install-commands, import-paths
> children: why-not-alternatives.md, ga-migration.md, version-bumping.md, REF.md

## Problem

Root override pins `"effect": "3.19.18"` for the workspace. Bun hoists one version. We need v4 in new packages without breaking v3.

## Solution: npm Alias Protocol

```json
{ "effect-v4": "npm:effect@4.0.0-beta.23" }
```

Installs v4 under `node_modules/effect-v4/`. v3 stays at `node_modules/effect/`.

## Import Paths

```ts
import { Effect, Schema, Layer } from "effect-v4"
import { Atom } from "effect-v4/unstable/reactivity"
import { it } from "effect-vitest-v4"
import { useAtomValue } from "effect-atom-react-v4"
```

## Installing (in a v4 package)

```bash
bun add effect-v4@npm:effect@4.0.0-beta.23
bun add -d effect-vitest-v4@npm:@effect/vitest@4.0.0-beta.23
bun add -d effect-atom-react-v4@npm:@effect/atom-react@4.0.0-beta.23
```

Or use the generator: `bunx nx g ./tools/nx-effect:effect-v4-lib <name>`

## Contents

| File | When to read |
|---|---|
| `why-not-alternatives.md` | Understanding why other approaches (nested overrides, file refs) don't work |
| `ga-migration.md` | Planning for when v4 goes stable |
| `version-bumping.md` | Bumping the beta version across all v4 packages |
| `REF.md` | Deep conceptual understanding + re-acquisition protocol |

## Cross-References
- `../boundaries/INDEX.md` — boundary rules enforce the alias (ban bare `effect` in v4 packages)
- `../plugins/nx-effect.md` — local plugin injects v4 metadata and provides the generator
