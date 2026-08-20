---
name: catalog-file-organization
description: Navigate the catalog package. lib vs components vs ui vs routes vs skills. Invoke when locating schema, VantaCard, intake, or testbeds.
triggers:
  - where is
  - file structure
  - directory organization
  - find component
  - naming convention
---

# Catalog file organization

Catalog follows TMNL's split without copying tauri, elixir, renode, iiot, or shells.

- `src/lib/` logic (schema, intake, file store, registry)
- `src/components/` portal, primitives, testbeds
- `src/ui/` catalog screens
- `src/routes/` TanStack Start file routes
- `.claude/skills/` package-local skills

## Map

```
packages/catalog/
├── src/
│   ├── lib/catalog/
│   │   ├── schema.ts
│   │   ├── intake.ts
│   │   ├── registry.ts
│   │   ├── store.server.ts
│   │   ├── functions.ts
│   │   └── seed.ts
│   ├── components/
│   │   ├── portal/          tokens.ts, VantaCard.tsx, index.ts
│   │   ├── primitives/      badge.tsx
│   │   └── testbed/         VantaCardTestbed.tsx, shared.tsx
│   ├── ui/                  Shell, CatalogIndex, IntakeDrop, ContextCard
│   ├── routes/              index, intake, cards.$cardId, testbed.vanta
│   └── styles/              app.css, transitions.css
├── .claude/skills/
└── README.md
```

Aliases: `~/` and `@/` both point at `src/`.

## Where to look

| Need | Path |
| --- | --- |
| Card schema | `src/lib/catalog/schema.ts` |
| 10-second file | `src/lib/catalog/intake.ts` (`fileCard`) |
| Status accents | `src/lib/catalog/registry.ts` |
| VANTA tokens | `src/components/portal/tokens.ts` (copy of tmnl portal tokens) |
| VantaCard | `src/components/portal/VantaCard.tsx` |
| Intake screen | `src/ui/intake-drop.tsx` |
| Index | `src/ui/catalog-index.tsx` |
| Testbed | `src/components/testbed/VantaCardTestbed.tsx` → `/testbed/vanta` |
| Skills | `.claude/skills/` |

Canonical Vanta Black still lives in tmnl:

`packages/tmnl/src/components/portal/tokens.ts`

Skill registry map in tmnl: `packages/tmnl/.claude/skills/SKILL_REGISTRY.md`

Catalog skill map: `.claude/skills/SKILL_REGISTRY.md`

## Patterns

Domain code stays in `lib/catalog`. Do not put `fileCard` in a component.

React composites stay in `ui/` or `components/`. Do not put JSX in `store.server.ts`.

Public exports go through `src/index.ts` (schema, intake, portal, screens).

## Anti-patterns

### Mixing store logic into VantaCard

VantaCard is a visual compound. It does not read `.data/catalog.json`.

### Importing `@gbg/tmnl` for tokens

That barrel is the whole tmnl app. Copy tokens. Clone VantaCard into this package. Leave shells alone.

### Putting skills only in the repo root

Catalog skills belong in `packages/catalog/.claude/skills/` so they travel with the package.

## Related

- `catalog-component-tiers`
- `catalog-testbed-patterns`
- `catalog-intake`
