---
name: react-compound-components
description: Compound component patterns for catalog. Context, slots, Object.assign. Use when extending VantaCard or adding Catalog.Header-style APIs.
model_invoked: true
triggers:
  - "compound component"
  - "VantaCard"
  - "slot pattern"
  - "Object.assign"
  - "context composition"
---

# React compound components for catalog

Parent shares implicit state with children through context. Export the family with `Object.assign`.

Catalog's canonical compound is `VantaCard`.

## Canonical sources

- `src/components/portal/VantaCard.tsx`
- `src/components/portal/index.ts`
- `src/components/testbed/VantaCardTestbed.tsx`
- TMNL original: `packages/tmnl/src/components/portal/VantaCard.tsx`

## Pattern 1: Context plus tokens

```tsx
const VantaCardContext = createContext<VantaCardContextValue>({ variant: 'default' })

const VantaCardRoot = forwardRef<HTMLDivElement, VantaCardProps>(…)
VantaCardRoot.displayName = 'VantaCard'

export const VantaCard = Object.assign(VantaCardRoot, {
  Header, Title, Subtitle, Body, Indicator, Actions, Action, LabelValue, Divider,
})
```

Children read variant from context. They do not take a `variant` prop.

Styling comes from `VANTA_CARD_VARIANTS` and `VANTA_TYPOGRAPHY.preset`.

## Pattern 2: Catalog card as a consumer

```tsx
<VantaCard variant="elevated" glow glowColor={visual.accent}>
  <VantaCard.Header>
    <VantaCard.Title>{card.kind}</VantaCard.Title>
    <VantaCard.Indicator status={visual.indicator} label={card.status} />
  </VantaCard.Header>
  <VantaCard.Subtitle>{organismLabel(specimen.organismGuess)}</VantaCard.Subtitle>
  <VantaCard.Body>{card.claim}</VantaCard.Body>
</VantaCard>
```

**Location**: `src/ui/context-card.tsx`

Do not turn `ContextCard` into `header={…} body={…}` props.

## Pattern 3: Slot-only compounds

If children need no shared state, skip context. `Object.assign` still groups the API (`Intake.Drop`, `Intake.Field`) if you add that later.

## Decision

Need shared parent state? Context compound (`VantaCard`).

Pure layout slots? Slot compound.

Token-driven look plus parent variant? Context plus VANTA tokens.

## Anti-patterns

### Prop drilling variant

```tsx
// BANNED
<VantaCard variant="elevated">
  <VantaCard.Title variant="elevated">NOTE</VantaCard.Title>
</VantaCard>
```

### Named children props

```tsx
// BANNED
<VantaCard header={<span>NOTE</span>} body={claim} />
```

### Separate named exports

```tsx
// BANNED
export { VantaCard, VantaCardHeader, VantaCardTitle }
```

## Checklist

- Context if children need parent state
- `displayName` on root
- `forwardRef` when refs matter
- `Object.assign(Root, { Child, … })`
- VANTA tokens, not hex

## Related

- `catalog-component-tiers`
- `catalog-design-tokens`
- `catalog-testbed-patterns`
