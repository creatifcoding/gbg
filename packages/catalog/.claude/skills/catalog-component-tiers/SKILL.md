---
name: catalog-component-tiers
description: Catalog component placement. Invoke when adding UI, deciding lib vs components vs ui vs routes, or refactoring imports.
model_invoked: true
triggers:
  - "component organization"
  - "primitives"
  - "composites"
  - "testbed"
  - "where to put"
  - "file structure"
---

# Catalog component tiers

Components import downward only.

```
Routes (src/routes)                Tier 3
  -> screens (src/ui)              Tier 2
  -> portal / primitives           Tier 1
  -> tokens                        Tier 0
```

Testbeds live beside composites and import them. Production screens do not import testbeds.

## Canonical layout

```
packages/catalog/src/
  lib/catalog/           schema, intake, store, registry
  components/portal/     VANTA tokens, VantaCard
  components/primitives/ Badge and other generic bits
  components/testbed/    VantaCardTestbed
  ui/                    CatalogIndex, IntakeDrop, ContextCard, Shell
  routes/                TanStack Start file routes
  styles/                app.css, transitions.css
```

## Tiers

### Tokens (tier 0)

`src/components/portal/tokens.ts`

No React. No catalog domain types.

### Primitives (tier 1)

`src/components/primitives/badge.tsx`

Generic, token-driven, no `CatalogCard`.

`VantaCard` is a compound primitive in `src/components/portal/`. It knows VANTA, not intake.

### Composites (tier 2)

`src/ui/*` owns catalog screens. They may import schema, registry, server functions, and VantaCard.

### Testbeds

`src/components/testbed/VantaCardTestbed.tsx`

Route `/testbed/vanta`. Not production.

### Pages (tier 3)

`src/routes/*.tsx` stay thin. Loader plus a screen component.

## Naming

| Kind | File | Export |
| --- | --- | --- |
| Primitive | lowercase `badge.tsx` | `Badge` |
| Compound | PascalCase `VantaCard.tsx` | `VantaCard` with slots |
| Screen | kebab `catalog-index.tsx` | `CatalogIndex` |
| Testbed | `VantaCardTestbed.tsx` | `VantaCardTestbed` |
| Route | TanStack file route | `Route` |

## Patterns

### Primitive

```typescript
import { VANTA_COLORS } from '~/components/portal'

export function Badge({ children }: { children: ReactNode }) {
  return <span style={{ color: VANTA_COLORS.text.secondary }}>{children}</span>
}
```

**Location**: `src/components/primitives/badge.tsx`

### Compound

```typescript
export const VantaCard = Object.assign(VantaCardRoot, {
  Header, Title, Body, Indicator, Actions, Action, LabelValue, Divider,
})
```

**Location**: `src/components/portal/VantaCard.tsx`

### Screen composing VantaCard

```typescript
<VantaCard variant="elevated" glow glowColor={visual.accent}>
  <VantaCard.Header>
    <VantaCard.Title>{card.kind}</VantaCard.Title>
    <VantaCard.Indicator status={visual.indicator} label={card.status} />
  </VantaCard.Header>
  <VantaCard.Body>{card.claim}</VantaCard.Body>
</VantaCard>
```

**Location**: `src/ui/context-card.tsx`

## Import rules

Allowed: route -> ui -> portal. ui -> lib/catalog. testbed -> portal.

Banned: primitive importing `CatalogIndex`. portal importing `fileSpecimen`. ui importing a testbed.

## Anti-patterns

### God screen

Do not put schema decoding, blob writes, and VantaCard slots in a route file. Routes load. `ui/` renders. `lib/catalog/` files.

### Domain logic in primitives

`Badge` does not call `useRouter` or `getSpecimen`.

### Testbed in production

Do not import `VantaCardTestbed` from `CatalogIndex`.

## Related

- `catalog-file-organization`
- `react-compound-components`
- `catalog-testbed-patterns`
