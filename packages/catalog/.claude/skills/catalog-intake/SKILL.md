---
name: catalog-intake
description: Catalog 10-second intake. Type, claim, 3+ tags, optional taxon/part, then file a Specimen. Invoke when building or changing dump, fileSpecimen, or the intake screen.
model_invoked: true
triggers:
  - "intake"
  - "file a specimen"
  - "10-second"
  - "dump"
  - "fileSpecimen"
  - "open questions"
  - "one-line claim"
---

# Catalog intake

Dump first. File in one screen. Body waits.

This package is biomimetic and specimen-first. A dump becomes a Specimen, the particular sample in hand or on record. Taxon, structure, mechanism, and analog stay optional links. The app does not invent citations.

## Canonical sources

- Schemas: `src/lib/catalog/schemas/` (`specimen.ts`, `observation.ts`, `guess.ts`)
- Invariant: `src/lib/catalog/intake.ts` (`fileSpecimen`, `IntakeError`)
- Entity: `src/lib/catalog/entity/specimen-entity.ts` (status machine + events)
- Server: `src/lib/catalog/functions.ts` (`createSpecimen`)
- Screen: `src/ui/intake-drop.tsx`, `src/routes/intake.tsx`
- Persistence: `src/lib/catalog/repos/json-catalog.ts`, `src/lib/catalog/store.server.ts`

## First pass (required)

One screen. No wizard. No step 2.

| Field | Rule |
| --- | --- |
| first evidence | `picture` \| `dossier` \| `artifact` \| `note` |
| claim | one line, required |
| tags | at least 3 |
| taxon guess | optional. Marked `{ label, guess: true }` if present |
| part / structure | optional guess |
| locality | optional string |
| collected / observed | optional string |
| open questions | zero or more, already in hand |

Status starts `raw`. Intake also writes a CRUD Observation (`observation-of` the specimen) and may hang a file on that observation. Body is `''`.

`fileSpecimen` is the gate. If the dump cannot make that Specimen, throw `IntakeError`. Do not save a partial.

## Then file

After `fileSpecimen` succeeds, the Specimen exists. Detail can take body, move status (`filed` / `working` / `dead`), and show blobs.

Deeper writing happens on `/specimens/$specimenId`, never as intake step 2.

## Patterns

### Pattern 1: Decode, then commit through the entity

```typescript
export function fileSpecimen(input: unknown, now = Date.now()): IntakeResult {
  const intake = decodeIntake(input) // throws -> IntakeError
  const { specimen, event } = createSpecimen({ …intake, status implied raw, body: '' }, now)
  return { specimen, observation, observationEdge, tags, questions, events: [event] }
}
```

### Pattern 2: One form

`IntakeDrop` is drop zone plus type tabs plus claim, tags, optional taxon/part/locality/when, questions, submit.

### Pattern 3: Empty is valid

Index may render zero specimens. Seed examples are opt-in and marked `example: true`.

## Anti-patterns

### Wizard

```typescript
// BANNED
/intake/type -> /intake/tags -> /intake/review
```

### Body at dump time

```typescript
// BANNED
decodeIntake({ …, body: 'methods section' })
```

Body is not on `IntakeInput`.

### Require a taxonomy to file

A Specimen can exist with `organismGuess: null`. Do not invent an Organism record from a guess.

### Keep Card as a peer aggregate

Intake creates a Specimen. Do not revive Card.

### Invented citations

Do not generate PMIDs, DOIs, or fake papers to fill a specimen.

### Soft save

Do not write a specimen with two tags and a blank claim "to come back later." The invariant is the product.

## Related

- `catalog-registry-patterns`
- `catalog-file-organization`
- `catalog-testbed-patterns`
