---
name: catalog-design-tokens
description: Catalog design tokens. Invoke when theming, extending VANTA constants, or wiring CSS variables. Tokens are the only visual source of truth.
model_invoked: true
triggers:
  - "VANTA_COLORS"
  - "VANTA_TYPOGRAPHY"
  - "VANTA_BORDERS"
  - "design tokens"
  - "CSS variables"
  - "token hierarchy"
---

# Catalog design tokens

Tokens own color, type, space, radius, and motion. Components do not hardcode those values.

Canonical Vanta Black is `packages/tmnl/src/components/portal/tokens.ts`. Catalog copies the constants into `src/components/portal/tokens.ts` because `@gbg/tmnl` barrels the whole app. CSS variables in `src/styles/app.css` mirror the same numbers for utility classes.

There is no TMNL_TOKENS, splash token set, or AG-Grid theme in this package.

## Canonical sources

- **Source of truth**: `packages/tmnl/src/components/portal/tokens.ts`
- **Catalog copy**: `src/components/portal/tokens.ts`
- **Facade**: `src/components/portal/index.ts`
- **CSS mirror**: `src/styles/app.css`
- **Motion recipes**: `src/styles/transitions.css` (colors remapped onto VANTA)

## Token sets in this package

`VANTA_COLORS`, `VANTA_TYPOGRAPHY`, `VANTA_SPACING`, `VANTA_BORDERS`, `VANTA_ANIMATION`, `VANTA_CARD_VARIANTS`.

Catalog keeps `--tmnl-text-xs: 12px` as the floor. It does not import tmnl's compact 10px scale.

Font CSS variables match tmnl semantic roles used by VANTA presets:

```css
--font-label: 'Share Tech Mono', ui-monospace, monospace;
--font-heading: 'Space Grotesk', ui-sans-serif, system-ui, sans-serif;
--font-body: 'Geo', ui-sans-serif, system-ui, sans-serif;
--font-stats: 'Geo', ui-sans-serif, system-ui, sans-serif;
```

## Patterns

### Pattern 1: Inline tokens on composites

```typescript
import { VANTA_COLORS, VANTA_TYPOGRAPHY, VANTA_SPACING } from '~/components/portal'

<h3 style={{
  color: VANTA_COLORS.text.primary,
  ...VANTA_TYPOGRAPHY.preset.cardTitle,
}}>
  NOTE
</h3>
```

**Location**: `src/components/portal/VantaCard.tsx`

### Pattern 2: CSS variables for utilities

Screens that are not `VantaCard` use classes in `app.css` (`vanta-label`, `vanta-chip`, `vanta-btn-primary`). Those classes read `--vanta-*`. If a token changes in `tokens.ts`, update the CSS variable too.

### Pattern 3: Compound variants

```typescript
const variantTokens = VANTA_CARD_VARIANTS[variant]
```

Do not restyle a card with a one-off radius or shadow.

### Pattern 4: Domain map, not a new token file

Catalog statuses map onto existing accents in `src/lib/catalog/registry.ts`. That file imports `VANTA_COLORS`. It does not redefine cyan.

## Token extension protocol

1. Change the value in tmnl `portal/tokens.ts` if it is a system-wide Vanta change.
2. Copy the constant into catalog `src/components/portal/tokens.ts`.
3. Mirror it in `app.css` if a utility class uses it.
4. Update `catalog-color-system` if the meaning changed.

Do not add a `CATALOG_COLORS` object.

## Anti-patterns

### Magic numbers

```typescript
// BANNED
<div style={{ padding: '16px', borderRadius: '16px' }} />

// CORRECT
<div style={{ padding: VANTA_SPACING.card.padding, borderRadius: VANTA_BORDERS.radius.md }} />
```

Rounded-full and rounded-2xl are not Vanta. Radii stay 2px to 6px.

### Duplicated token definitions

```typescript
// BANNED
const CYAN = '#22d3ee'

// CORRECT
import { VANTA_COLORS } from '~/components/portal'
```

## Related

- `catalog-color-system`
- `catalog-typography-discipline`
- `catalog-component-tiers`
