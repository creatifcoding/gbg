# NX Plugins — Inventory & Routing

> up: ../INDEX.md
> prereqs: none
> provides: plugin-inventory, target-inference-overview
> children: js-typescript.md, vite.md, eslint.md, next.md, playwright.md, jest.md, rollup.md, nx-effect.md, createNodesV2.md, local-plugin.md

All plugins exclude `submodules/**`, `receipts/**`, `node_modules/**`.

## Registered Plugins (8)

| # | Plugin | Infers From | Key Targets | Brief |
|---|---|---|---|---|
| 0 | `@nx/js/typescript` | tsconfig.json | typecheck, build | `js-typescript.md` |
| 1 | `@nx/vite/plugin` | vite/vitest config | build, test, dev | `vite.md` |
| 2 | `@nx/eslint/plugin` | eslint config | lint | `eslint.md` |
| 3 | `@nx/next/plugin` | next.config.* | build, dev, start | `next.md` |
| 4 | `@nx/playwright/plugin` | playwright.config.* | e2e | `playwright.md` |
| 5 | `@nx/jest/plugin` | jest.config.* | test | `jest.md` |
| 6 | `@nx/rollup/plugin` | rollup.config.* | build | `rollup.md` |
| 7 | `./tools/nx-effect` | project.json + `effect:v4` tag | metadata only | `nx-effect.md` |

## Target Defaults (nx.json)

```
@nx/js:tsc  → cache: true, dependsOn: [^build]
@nx/js:swc  → cache: true, dependsOn: [^build]
```

## Generator Defaults (nx.json)

```
@nx/next application → style: tailwind, linter: eslint
@nx/react library    → unitTestRunner: none
```

## NX Cloud

ID: `6900cdd87a20187029497502` · Default base: `master`

## Deep Dive

| File | When to read |
|---|---|
| `createNodesV2.md` | Writing a plugin's target inference API |
| `local-plugin.md` | Understanding tools/nx-effect/ anatomy |

## Cross-References

- `nx-effect.md` → `../generators/INDEX.md` (the local plugin provides generators)
- `nx-effect.md` → `../boundaries/INDEX.md` (the local plugin injects boundary metadata)
