# v3 → v4 Migration Pattern (per package)

> Back to: `INDEX.md`

## Steps

1. **Tag**: Add `"effect:v4"` to project.json tags
2. **Deps**: Replace `effect` with `effect-v4` alias
   ```bash
   cd packages/<name>
   bun remove effect
   bun add effect-v4@npm:effect@4.0.0-beta.23
   ```
3. **Imports**: `from "effect"` → `from "effect-v4"` everywhere in the package
4. **Lint**: `bunx nx lint @tmnl/<name>` — boundary violations reveal missed imports
5. **Test**: `bunx nx test @tmnl/<name>` — verify runtime behavior
6. **Companion packages**: Add aliased vitest/atom-react if needed
   ```bash
   bun add -d effect-vitest-v4@npm:@effect/vitest@4.0.0-beta.23
   bun add -d effect-atom-react-v4@npm:@effect/atom-react@4.0.0-beta.23
   ```

## Lint Catches

After adding `effect:v4` tag, lint will error on:
- Importing from non-v4 packages
- Importing bare `effect` (v3)

These errors guide the migration — fix each one.
