# Hypothesis Lab (v1 scaffold)

Effect-first runtime for dueling hypotheses, validation hooks, matrix drafting, ratification, and replay checks.

## Current status

This is a **vertical-slice scaffold** under `src/lib/hypothesis-lab/v1`.

Implemented skeleton:

- Effect Schema domain contracts (`schemas.ts`)
- Typed tagged errors (`errors.ts`)
- Hook registry/runtime services
- Decision matrix draft service
- Audit ledger + replay services
- Atom-as-State runtime state + operation atoms
- Hook plan builder + compiled schema validators

## Entry point

```ts
import { hypothesisLabOps } from '@/lib/hypothesis-lab/v1'
```

## Vertical-slice flow (wired)

1. `hypothesisLabOps.createRun`
2. `hypothesisLabOps.compileDefaultPlan`
3. `hypothesisLabOps.runValidation`
4. `hypothesisLabOps.draftVerdict`
5. `hypothesisLabOps.ratifyVerdict`
6. `hypothesisLabOps.replay`

## Notes

- State authority is **Atom primary** (`Atom.make` + `ctx.set`).
- Services orchestrate Effects and persistence boundaries.
- SQLite adapter is scaffolded with in-memory backing for now.
