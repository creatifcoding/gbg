# NX Workspace — Reference Index

> up: ../SKILL.md
> prereqs: none
> provides: reference-routing
> children: plugins/INDEX.md, generators/INDEX.md, boundaries/INDEX.md, effect-v4/INDEX.md

## Contents

| Dir | When to read | Provides |
|---|---|---|
| `plugins/` | Understanding registered plugins, writing new ones | Plugin inventory, createNodesV2, local plugin anatomy |
| `generators/` | Scaffolding packages, writing generators | generators.json, schema.json, Tree API |
| `boundaries/` | Module boundary rules, tag enforcement | depConstraints, migration pattern |
| `effect-v4/` | v3/v4 coexistence, alias strategy | npm alias protocol, GA migration plan |

## Cross-References

- `boundaries/` ↔ `effect-v4/` — boundary rules reference the alias strategy and vice versa
- `generators/` → `plugins/local-plugin.md` — generators live inside the local plugin
- `plugins/nx-effect.md` → `generators/INDEX.md` — the local plugin provides generators
