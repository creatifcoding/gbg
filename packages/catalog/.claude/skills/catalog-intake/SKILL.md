---
name: catalog-intake
description: Catalog 10-second intake. Type, claim, tags, organism, open questions, then file. Invoke when building or changing dump, fileCard, or the intake screen.
model_invoked: true
triggers:
  - "intake"
  - "file a card"
  - "10-second"
  - "dump"
  - "fileCard"
  - "open questions"
  - "one-line claim"
---

# Catalog intake

Dump first. File in one screen. Notes wait.

A dump is not a paper. The app does not invent citations.

## Canonical sources

- Schema: `src/lib/catalog/schema.ts`
- Invariant: `src/lib/catalog/intake.ts` (`fileCard`, `IntakeError`)
- Server: `src/lib/catalog/functions.ts` (`createCard`)
- Screen: `src/ui/intake-drop.tsx`, `src/routes/intake.tsx`
- Persistence: `src/lib/catalog/store.server.ts`

## First pass (required)

One screen. No wizard. No step 2.

| Field | Rule |
| --- | --- |
| type | `picture` \| `dossier` \| `artifact` \| `note` |
| claim | one line, required |
| tags | at least 3 |
| organism / system | a label, or `unknown` |
| open questions | zero or more, already in hand |

Status starts `raw`. Attachments are optional. Notes are `''`.

`fileCard` is the gate. If the dump cannot make that card, throw `IntakeError`. Do not save a partial.

## Then file

After `fileCard` succeeds, the card exists. Detail can take notes, move status (`filed` / `working` / `dead`), and show blobs.

Deeper writing happens on `/cards/$cardId`, never as intake step 2.

## Patterns

### Pattern 1: Decode, then commit

```typescript
export function fileCard(input: unknown, now = Date.now()): CatalogCard {
  const intake = decodeIntake(input) // throws -> IntakeError
  return decodeCard({
    …intake,
    status: 'raw',
    notes: '',
    attachments: [],
    example: false,
    createdAt: now,
    updatedAt: now,
  })
}
```

### Pattern 2: One form

`IntakeDrop` is drop zone plus type tabs plus claim, tags, organism, questions, submit. Sliding tabs are Transitions.dev on VANTA colors. Inputs use `.vanta-input`.

### Pattern 3: Empty is valid

Index may render zero cards. Seed examples are opt-in and marked `example: true`.

## Anti-patterns

### Wizard

```typescript
// BANNED
/intake/type -> /intake/tags -> /intake/review
```

### Notes at dump time

```typescript
// BANNED
decodeIntake({ …, notes: 'methods section' })
```

Notes are not on `IntakeInput`.

### Invented citations

Do not generate PMIDs, DOIs, or fake papers to fill a card.

### Soft save

Do not write a card with two tags and a blank claim "to come back later." The invariant is the product.

## Related

- `catalog-registry-patterns`
- `catalog-file-organization`
- `catalog-testbed-patterns`
