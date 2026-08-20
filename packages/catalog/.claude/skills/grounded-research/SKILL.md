---
name: grounded-research
description: Epistemic honesty for catalog work. Admit uncertainty, verify against tmnl Vanta tokens, catalog schema, and library docs before implementing.
model_invoked: true
triggers:
  - "research"
  - "how does"
  - "what is the correct"
  - "best practice"
  - "verify approach"
  - "uncertain"
  - "check documentation"
---

# Grounded research for catalog

You do not know what you have not verified.

Catalog sits on TMNL Vanta Black, Effect Schema, and TanStack Start. Those APIs move. Check them.

## Cascade

1. **Tmnl canonical tokens**  
   `packages/tmnl/src/components/portal/tokens.ts`  
   `packages/tmnl/src/components/portal/VantaCard.tsx`  
   `packages/tmnl/.claude/skills/SKILL_REGISTRY.md`

2. **Catalog copy and product rules**  
   `src/components/portal/`  
   `src/lib/catalog/schema.ts`  
   `src/lib/catalog/intake.ts`  
   `.claude/skills/`

3. **Library docs**  
   TanStack Start / Router, Radix, Effect Schema (this repo uses Effect 4, `Schema.Literals` and `.check`, not v3 `Schema.filter`)

4. **Local grep**  
   Precedent in `packages/catalog/src` only. Do not copy tmnl shells, tauri, elixir, renode, or iiot because a skill mentioned them.

## Markers

| Marker | Meaning |
| --- | --- |
| `[UNCERTAIN]` | Research before coding |
| `[CUTOFF-GAP]` | Library may have changed |
| `[VERIFIED]` | Checked a canonical file |
| `[INFERRED]` | Pattern match, say so |

## Verification questions

Ask whether an understanding is correct.

```
I believe catalog copies VANTA_COLORS from packages/tmnl/src/components/portal/tokens.ts
and must not import @gbg/tmnl. Is that still true in this repo?
```

```
I believe Effect Schema v4 uses Schema.Literals([...]) and .check(Schema.isMinLength(3)).
Confirm against packages/catalog/src/lib/catalog/schema.ts.
```

## Product facts that still need a file check

- Intake is one screen. `fileCard` throws `IntakeError` if type, claim, or 3+ tags are missing. Organism is an optional guess.
- Notes stay empty until the card exists.
- Empty catalog is valid.
- Example cards are opt-in and labeled.
- No second color system.

## Anti-patterns

### Claim Vanta values from memory

Read `tokens.ts`. Cyan is `#22d3ee`. If you type a different cyan, you invented a palette.

### Copy tmnl overlay registries into catalog

`catalog-registry-patterns` is a status map. OverlayRegistry is tmnl.

### Skip Effect 4 because Effect 3 is familiar

This workspace uses `effect@4.0.0-beta.93`. Verify Schema APIs in catalog tests.

## Related

- `catalog-intake`
- `catalog-design-tokens`
- `catalog-file-organization`
