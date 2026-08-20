---
name: catalog-color-system
description: Catalog color system. VANTA Black surfaces and accents only. Invoke when coloring screens, glows, status chips, or debugging palette drift.
model_invoked: true
triggers:
  - "color system"
  - "surface hierarchy"
  - "glow effect"
  - "status colors"
  - "VANTA_COLORS"
  - "vanta black"
---

# Catalog color system

Catalog uses TMNL Vanta Black. One palette. Near-black surfaces, restrained accents, glow at 0.15 opacity.

Never use raw hex in components. Read tokens.

Canonical Vanta Black remains `packages/tmnl/src/components/portal/tokens.ts`. Catalog keeps a copy at `src/components/portal/tokens.ts` next to `VantaCard`.

## Canonical sources

- **VANTA_COLORS**: `packages/tmnl/src/components/portal/tokens.ts` (source of truth)
- **Catalog copy**: `src/components/portal/tokens.ts`
- **CSS variables**: `src/styles/app.css` (`--vanta-void`, `--vanta-cyan`, …)
- **Status map**: `src/lib/catalog/registry.ts` (`STATUS_VISUAL`)
- **Usage**: `src/components/portal/VantaCard.tsx`, `src/ui/context-card.tsx`

Do not pull TMNL_TOKENS, splash tokens, AG-Grid tokens, or animation reticle greens into this package.

## Surface hierarchy

```typescript
VANTA_COLORS.surface.void      // #000000 page background
VANTA_COLORS.surface.base      // #030303 cards
VANTA_COLORS.surface.elevated  // #0a0a0a hover, inputs
VANTA_COLORS.surface.raised    // #111111 tab bars
VANTA_COLORS.surface.border    // #1a1a1a hairlines
VANTA_COLORS.surface.hover     // #1f1f1f nav hover
```

Page chrome sits on void. Cards sit on base. Interactive bits lift to elevated.

## Text hierarchy

```typescript
VANTA_COLORS.text.primary     // headings, claims
VANTA_COLORS.text.secondary   // body
VANTA_COLORS.text.tertiary    // metadata
VANTA_COLORS.text.muted       // placeholders
```

Accents are not body color.

## Accents (use sparingly)

Cyan is the primary action. Emerald, amber, rose, violet stay status and glow.

Catalog statuses reuse that set. They do not add colors.

| Status | Accent | Indicator |
| --- | --- | --- |
| raw | amber | pending |
| filed | cyan | idle |
| working | emerald | active |
| dead | rose | error |

`VantaCard.Indicator` has no cyan status. Filed cards glow cyan on the card, and the indicator uses idle. Do not invent a fifth indicator color.

## Patterns

### Pattern 1: Token surfaces

```typescript
import { VANTA_COLORS } from '~/components/portal'

<div style={{
  background: VANTA_COLORS.surface.base,
  border: `1px solid ${VANTA_COLORS.surface.border}`,
  color: VANTA_COLORS.text.primary,
}} />
```

### Pattern 2: Status through the registry

```typescript
import { statusVisual } from '~/lib/catalog/registry'

const visual = statusVisual(card.status)
<VantaCard glow glowColor={visual.accent}>
  <VantaCard.Indicator status={visual.indicator} label={card.status} />
</VantaCard>
```

### Pattern 3: Glow from tokens

```typescript
boxShadow: `0 0 8px ${VANTA_COLORS.accent.cyanGlow}`
```

## Anti-patterns

### Hardcoded hex

```typescript
// BANNED
<div style={{ background: '#0a0a0a' }} />

// CORRECT
<div style={{ background: VANTA_COLORS.surface.elevated }} />
```

### Second palette

```typescript
// BANNED paper theme, TMNL_TOKENS, or Tailwind sky/zinc as a system
// CORRECT VANTA_COLORS plus CSS vars that duplicate those values
```

### Accent as body text

```typescript
// BANNED
<p style={{ color: VANTA_COLORS.accent.cyan }}>The claim</p>

// CORRECT
<p style={{ color: VANTA_COLORS.text.primary }}>The claim</p>
```

## Related

- `catalog-design-tokens`
- `catalog-registry-patterns`
- `catalog-typography-discipline`
