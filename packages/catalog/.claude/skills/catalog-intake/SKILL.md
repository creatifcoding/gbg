---
name: catalog-intake
description: Catalog 10-second intake. Type, claim, 3+ tags, optional guesses, open questions, then file a Card. Invoke when building or changing dump, fileCard, or the intake screen.
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

Dump first. File in one screen. Body waits.

This package is biomimetic. A dump becomes a Card, not a paper. The app does not invent citations. Organism, structure, and function are optional links or guesses. Do not block intake on a perfect taxonomy.

## Canonical sources

- Schemas: `src/lib/catalog/schemas/` (`card.ts`, `guess.ts`)
- Invariant: `src/lib/catalog/intake.ts` (`fileCard`, `IntakeError`)
- Entity: `src/lib/catalog/entity/card-entity.ts` (status machine + events)
- Server: `src/lib/catalog/functions.ts` (`createCard`)
- Screen: `src/ui/intake-drop.tsx`, `src/routes/intake.tsx`
- Persistence: `src/lib/catalog/repos/json-catalog.ts`, `src/lib/catalog/store.server.ts`

## First pass (required)

One screen. No wizard. No step 2.

| Field | Rule |
| --- | --- |
| type | `picture` \| `dossier` \| `artifact` \| `note` |
| claim | one line, required |
| tags | at least 3 |
| organism guess | optional. Marked `{ label, guess: true }` if present |
| open questions | zero or more, already in hand |

Status starts `raw`. Attachments are optional. Body is `''`.

`fileCard` is the gate. If the dump cannot make that Card, throw `IntakeError`. Do not save a partial.

## Then file

After `fileCard` succeeds, the Card exists. Detail can take body, move status (`filed` / `working` / `dead` via the machine), and show blobs.

Deeper writing happens on `/cards/$cardId`, never as intake step 2.

## Patterns

### Pattern 1: Decode, then commit through the entity

```typescript
export function fileCard(input: unknown, now = Date.now()): IntakeResult {
  const intake = decodeIntake(input) // throws -> IntakeError
  const { card, event } = createCard({ …intake, status implied raw, body: '' }, now)
  return { card, tags, questions, events: [event] }
}
```

### Pattern 2: One form

`IntakeDrop` is drop zone plus type tabs plus claim, tags, optional organism guess, questions, submit. Sliding tabs are Transitions.dev on VANTA colors. Inputs use `.vanta-input`.

### Pattern 3: Empty is valid

Index may render zero cards. Seed examples are opt-in and marked `example: true`.

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

```typescript
// BANNED
organism: required
```

A Card can exist with `organismGuess: null`. Do not invent an Organism record from a guess.

### Invented citations

Do not generate PMIDs, DOIs, or fake papers to fill a card.

### Soft save

Do not write a card with two tags and a blank claim "to come back later." The invariant is the product.

## Related

- `catalog-registry-patterns`
- `catalog-file-organization`
- `catalog-testbed-patterns`
