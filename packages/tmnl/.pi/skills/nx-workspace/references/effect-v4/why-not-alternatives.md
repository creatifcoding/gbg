# Why Not Alternatives

> Back to: `INDEX.md`

| Approach | Why it fails |
|---|---|
| Per-package `"effect": "4.0.0-beta.23"` | Root override wins. Bun resolves v3. |
| `"overrides"` in child package.json | Bun ignores non-root overrides |
| Nested overrides `{ "effect": { "@tmnl/stx": "4.x" } }` | Bun warns: "does not support nested overrides" |
| `file:../../submodules/effect-smol/packages/effect` | Works but fragile, not publishable, breaks CI |
| Remove root override entirely | v3 packages might resolve v4 if ranges overlap |
| pnpm (supports per-workspace overrides) | We're on Bun. Not switching package managers for this. |

The npm alias protocol is the only clean approach that:
- Keeps the root override for v3 safety
- Isolates v4 under a different module name
- Works with Bun's hoisting
- Produces publishable packages (peer deps declare `effect >= 4`)
