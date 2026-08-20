---
name: catalog-ecs
description: Catalog is an ECS. Branded ids are entities. Components attach over time. Systems never require a fat Card row. Invoke when adding fields, intake, identify, or aggregates.
model_invoked: true
triggers:
  - "ECS"
  - "entity"
  - "component"
  - "aggregate"
  - "Card row"
  - "fat"
  - "identify"
---

# Catalog ECS

Layout is mined from iiot (`schemas` → `models` → `repos` → `entity`). The mental model is ECS, not ISA-95 hierarchy and not a Card with 20 required columns.

## Canonical sources

- Vocabulary: `src/lib/catalog/ecs.ts`
- Entity spawn: `src/lib/catalog/entity/specimen-entity.ts` (`spawnSpecimen`, `createSpecimen`)
- Intake system: `src/lib/catalog/intake.ts`
- Capture system: `packages/catalog/capture/`
- Relate: `src/lib/catalog/schemas/edge.ts`
- Tests: `src/lib/catalog/ecs.test.ts`

## Entity

A branded id. `SpecimenId` first. `AnalogId`, `OrganismId`, `StructureId`, `MechanismId`, `FunctionId` are also entities. No required taxonomy at birth.

Spawn:

```typescript
spawnSpecimen({ id, kind })
// status is raw. claim, locality, taxon are absent.
```

## Components

Optional. Attach over time. May stay absent forever.

Status, Claim, Media/Attachment, Exif, Locality, Taxon, Structure, Mechanism, Function, AnalogLink, Tag, Question, Observation.

Do not store `{ _tag: 'unknown' }` just to fill a column. Omit Locality. The view hydrates absence as unknown.

## Systems

| System | Does |
| --- | --- |
| Intake | Create entity, attach Status(raw), attach whatever the drop has. Usually Media. |
| Capture | Browser geolocation plus WASM ExifTool. Writes Exif/Locality onto the JPEG. |
| File | Promote Status (`raw` → `filed` → `working`). Skip-to-dead allowed. |
| Identify | Later. No wizard. |
| Relate | Edges as relationship components. |

## Anti-patterns

```typescript
// BANNED
type Specimen = { id, claim, taxon, gps, mechanism, analog, ... } // all required
/intake/identify
ISA-95 plant / line / sensor
Card as the aggregate
```

## Related

- `catalog-intake`
- `catalog-file-organization`
- `catalog-capture`
