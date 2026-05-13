# Version Bumping — Effect v4 Beta

> Back to: `INDEX.md`

## When to Bump

When a new `effect@4.0.0-beta.XX` is published to npm.

## What to Update

### 1. Plugin constants

`tools/nx-effect/src/index.ts`:
```ts
export const EFFECT_V4_VERSION = "4.0.0-beta.XX"  // ← update
```

`tools/nx-effect/src/generators/effect-v4-lib/generator.ts`:
```ts
const EFFECT_V4_NPM = "npm:effect@4.0.0-beta.XX"
const EFFECT_VITEST_V4_NPM = "npm:@effect/vitest@4.0.0-beta.XX"
const EFFECT_ATOM_REACT_V4_NPM = "npm:@effect/atom-react@4.0.0-beta.XX"
```

### 2. Each v4 package

```bash
cd packages/stx
bun remove effect-v4
bun add effect-v4@npm:effect@4.0.0-beta.XX

bun remove effect-vitest-v4
bun add -d effect-vitest-v4@npm:@effect/vitest@4.0.0-beta.XX

bun remove effect-atom-react-v4
bun add -d effect-atom-react-v4@npm:@effect/atom-react@4.0.0-beta.XX
```

### 3. Verify

```bash
bunx nx run-many -t typecheck test
```

## Future: Automate

Write `effect-v4-bump` generator that:
1. Finds all `effect:v4` tagged projects
2. Updates their package.json alias versions
3. Updates plugin constants
4. Runs `bun install`
