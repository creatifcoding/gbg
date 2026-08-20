---
name: catalog-testbed-patterns
description: Catalog testbeds at /testbed/*. Invoke when adding a testbed, registering a Start file route, or validating VANTA composition.
triggers:
  - "testbed"
  - "create testbed"
  - "testbed route"
  - "/testbed"
---

# Catalog testbed patterns

Testbeds are isolated pages for visual systems and hypotheses. They are not the catalog product.

**Location**: `src/components/testbed/`
**Routes**: `/testbed/*`
**First testbed**: `VantaCardTestbed` at `/testbed/vanta`

Root skips `Shell` for `/testbed` so the page can sit on void.

## Canonical sources

- `src/components/testbed/VantaCardTestbed.tsx`
- `src/components/testbed/shared.tsx` (`SectionLabel`)
- `src/routes/testbed.vanta.tsx`
- Sidebar link in `src/ui/shell.tsx`

TMNL registers testbeds in `App.tsx` CARDS. Catalog uses TanStack Start file routes instead. Do not recreate tmnl's portal grid.

## Checklist

1. Create `src/components/testbed/<Feature>Testbed.tsx`
2. Add `src/routes/testbed.<feature>.tsx` with `createFileRoute('/testbed/<feature>')`
3. Link it from the testbed itself and from `Shell` if it should be discoverable
4. Let the Start plugin refresh `routeTree.gen.ts` (or update it when typecheck needs it)
5. Use VANTA tokens. No second palette.
6. State hypotheses in the file header. Verify outcomes, not function calls.

## Pattern: file header

```tsx
/**
 * VantaCard Testbed
 *
 * Route: /testbed/vanta
 *
 * HYPOTHESES:
 * - H1: VANTA tokens render on void/base without a second palette
 * - H2: Compound slots compose
 */
```

## Pattern: route

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { VantaCardTestbed } from '~/components/testbed/VantaCardTestbed'

export const Route = createFileRoute('/testbed/vanta')({
  component: VantaCardTestbed,
})
```

## Pattern: sections

Use `SectionLabel` plus `VantaCard` slots. Hardcoded `#eceae4` tab bars belong in the old paper theme, not here.

## Anti-patterns

### Forget the route file

A testbed component with no `src/routes/testbed.*.tsx` is unreachable.

### Import testbed from production screens

`CatalogIndex` lists cards. It does not mount `VantaCardTestbed`.

### Track calls instead of outcomes

```typescript
// BANNED
setH1(true) // after render

// CORRECT
setH1(document.querySelector('[data-variant="elevated"]') !== null)
```

### Neutral-950 leftovers from the tmnl template

Catalog testbeds use `VANTA_COLORS.surface.void`, not `bg-neutral-950`.

## Related

- `catalog-component-tiers`
- `react-compound-components`
- `catalog-color-system`
