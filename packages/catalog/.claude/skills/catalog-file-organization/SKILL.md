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

Catalog follows TMNL's iiot *layout* (`schemas` → `models` → `repos` → `entity`) without copying plant, line, sensor, Cluster actors, or shells.

This package is biomimetic. The primary aggregate is Specimen. Observation, Attachment, Tag, and Question hang off it. Organism, Structure, Mechanism, Function, and Analog are optional reference-graph records.

- `src/lib/` logic (schemas, models, repos, entity, intake, registry)
- `src/components/` portal, primitives, testbeds
- `src/ui/` catalog screens
- `src/routes/` TanStack Start file routes
- `.claude/skills/` package-local skills

## Map

```
packages/catalog/
├── src/
│   ├── lib/catalog/
│   │   ├── schemas/         identifiers, Specimen, Observation, Analog, edges
│   │   ├── models/          JSON snapshot v4, SpecimenView
│   │   ├── repos/           json-catalog, specimen/observation/analog/edge
│   │   ├── entity/          Specimen/Analog status machines (no Cluster)
│   │   ├── intake.ts        10-second fileSpecimen
│   │   ├── exif.ts          GPS-first locality from raw tags
│   │   ├── assets.ts        original + sidecar, never overwrite
│   │   ├── registry.ts      VANTA status → accent
│   │   ├── store.server.ts  facade over JsonCatalog
│   │   ├── functions.ts     TanStack Start server functions
│   │   ├── seed.ts
│   │   └── schema.ts        barrel for UI imports
│   ├── components/
│   │   ├── portal/          tokens.ts, VantaCard.tsx, index.ts
│   │   ├── primitives/      badge.tsx
│   │   └── testbed/         VantaCardTestbed.tsx, shared.tsx
│   ├── ui/                  Shell, CatalogIndex, IntakeDrop, ContextCard, SpecimenDetail
│   ├── routes/              index, intake, specimens.$specimenId, testbed.vanta
│   └── styles/              app.css, transitions.css
├── capture/                 static camera page for Cloudflare Drop
├── .claude/skills/
└── README.md
```

Aliases: `~/` and `@/` both point at `src/`.

v1 RPCs are Start server functions, not Effect Cluster actors.

## Where to look

| Need | Path |
| --- | --- |
| Specimen / Analog schemas | `src/lib/catalog/schemas/` |
| Edges | `src/lib/catalog/schemas/edge.ts` |
| 10-second file | `src/lib/catalog/intake.ts` (`fileSpecimen`) |
| Status machines | `src/lib/catalog/entity/` |
| JSON snapshot | `src/lib/catalog/models/catalog-snapshot.ts` (v4) |
| Picture originals | `packages/catalog/assets/specimens/<id>/` |
| Capture (Drop) | `packages/catalog/capture/` |
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

Domain code stays in `lib/catalog`. Do not put `fileSpecimen` in a component.

React composites stay in `ui/` or `components/`. Do not put JSX in `store.server.ts`.

Public exports go through `src/index.ts` (schema, intake, portal, screens).

## Anti-patterns

### Mixing store logic into VantaCard

VantaCard is a visual compound. It does not read `.data/catalog.json`.

### Importing `@gbg/tmnl` for tokens

That barrel is the whole tmnl app. Copy tokens. Clone VantaCard into this package. Leave shells alone.

### Copying ISA-95 names

Mine iiot for branded IDs, Effect Schema, polymorphic kind, status machines, and first-class edges. Do not copy plant/line/sensor vocabulary.

### Putting skills only in the repo root

Catalog skills belong in `packages/catalog/.claude/skills/` so they travel with the package.

## Related

- `catalog-component-tiers`
- `catalog-testbed-patterns`
- `catalog-intake`
