---
name: catalog-registry-patterns
description: Catalog closed vocabularies for kind and status. Invoke when mapping status to VANTA accents, validating kind strings, or adding a lookup table.
triggers:
  - "registry"
  - "STATUS_VISUAL"
  - "card status"
  - "kind label"
  - "registry pattern"
---

# Catalog registry patterns

Catalog does not run overlay registries, command palettes, or KernelRegistry. Those stay in tmnl.

The catalog registry is a closed map from domain literals onto VANTA visuals.

## Canonical sources

- Vocabularies: `src/lib/catalog/schema.ts` (`CARD_KINDS`, `CARD_STATUSES`)
- Visual map: `src/lib/catalog/registry.ts` (`STATUS_VISUAL`, `KIND_LABEL`)
- Tests: `src/lib/catalog/registry.test.ts`
- Consumer: `src/ui/context-card.tsx`

## Pattern 1: Closed vocabulary

Kinds and statuses are Effect Schema literals. `isCardKind` / `isRegisteredKind` reject unknown strings. Do not accept free-text type.

```typescript
export const CARD_STATUSES = ['raw', 'filed', 'working', 'dead'] as const
```

## Pattern 2: Visual singleton

One object. Import it. Do not fork amber for "raw" in a component.

```typescript
export const STATUS_VISUAL = {
  raw: { accent: 'amber', indicator: 'pending', color: VANTA_COLORS.accent.amber, glow: VANTA_COLORS.accent.amberGlow },
  filed: { accent: 'cyan', indicator: 'idle', color: VANTA_COLORS.accent.cyan, glow: VANTA_COLORS.accent.cyanGlow },
  working: { accent: 'emerald', indicator: 'active', color: VANTA_COLORS.accent.emerald, glow: VANTA_COLORS.accent.emeraldGlow },
  dead: { accent: 'rose', indicator: 'error', color: VANTA_COLORS.accent.rose, glow: VANTA_COLORS.accent.roseGlow },
} as const satisfies Record<CardStatus, …>
```

`satisfies Record<CardStatus, …>` fails the build if a status is missing.

## Pattern 3: Exhaustiveness test

`registry.test.ts` walks `CARD_STATUSES` and asserts every key exists. When you add a status, the test fails until the map is updated.

## When catalog needs a real singleton later

If client state must be shared outside React, follow tmnl's atom registry pattern from `packages/tmnl/.claude/skills/tmnl-registry-patterns/SKILL.md`. Do not copy overlay code until catalog actually has overlays.

Until then, `STATUS_VISUAL` is the registry.

## Anti-patterns

### Local color maps

```typescript
// BANNED
const color = status === 'raw' ? '#fbbf24' : '#22d3ee'

// CORRECT
const visual = statusVisual(status)
```

### Runtime string kinds

```typescript
// BANNED
kind: string

// CORRECT
kind: CardKind
```

### Multiple STATUS_VISUAL objects

One module. One export.

## Related

- `catalog-color-system`
- `catalog-intake`
- `tmnl-registry-patterns` in tmnl (overlays, atoms) when you outgrow a map
