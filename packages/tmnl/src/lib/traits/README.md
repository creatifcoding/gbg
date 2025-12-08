# Trait System

A trait-based injection system for React components. Components declare which traits they implement, external code injects behavior.

## Installation

Already included in TMNL. Import from `@/lib/traits`.

## Quick Start

```tsx
import { TraitProvider, useTrait, useInject, ClickableAffordance } from '@/lib/traits'

// 1. Consumer: declare what traits you implement
function MyButton({ id }: { id: string }) {
  const { rendered, style, className } = useTrait(ClickableAffordance, id)

  return (
    <button style={style} className={`my-button ${className}`}>
      Click me
      {rendered}
    </button>
  )
}

// 2. Injector: inject behavior from anywhere
function App() {
  const { inject } = useInject()

  useEffect(() => {
    inject(ClickableAffordance, 'my-button', {
      tooltip: 'Click to submit',
      glow: 'cyan',
    })
  }, [])

  return (
    <TraitProvider>
      <MyButton id="my-button" />
    </TraitProvider>
  )
}
```

## Core Concepts

### Trait

A plain object with functions that define an injection shape:

```typescript
interface Trait<TSlot> {
  id: string                                      // Unique identifier
  render: (slot: TSlot, targetId: string) => ReactNode  // What to inject
  style?: (slot: TSlot) => CSSProperties          // Styles to merge
  className?: (slot: TSlot) => string             // Classes to merge
  defaultSlot?: TSlot                             // Default if no injection
}
```

### Provider Scoping

Injections only reach components within the same `TraitProvider`:

```tsx
<TraitProvider>
  <ComponentA id="shared" />  {/* Gets injection from this scope */}
</TraitProvider>

<TraitProvider>
  <ComponentB id="shared" />  {/* Different scope, different injection */}
</TraitProvider>
```

### Multi-Trait Composition

Consume multiple traits with `useTraits`:

```tsx
import { useTraits, ClickableAffordance, TooltipTrait } from '@/lib/traits'

function InteractiveElement({ id }: { id: string }) {
  const { traits, rendered, style, className } = useTraits(
    [ClickableAffordance, TooltipTrait],
    id
  )

  // Access individual results
  const clickable = traits['clickable-affordance']
  const tooltip = traits['tooltip']

  return (
    <div style={style} className={className}>
      Content
      {rendered}  {/* All trait renders stacked */}
    </div>
  )
}
```

**Merge behavior:**
- `style`: Later traits override earlier (object spread)
- `className`: All joined with spaces
- `rendered`: All stacked in order
- `isInjected`: True if ANY trait has injection

## Built-in Traits

### ClickableAffordance

Makes elements obviously interactive:

```typescript
inject(ClickableAffordance, 'target-id', {
  tooltip: 'Click to view',    // Hover text
  glow: 'orange',              // 'orange' | 'cyan' | 'violet' | 'green' | 'red' | 'amber'
  pulse: true,                 // Animate glow
  cursor: 'pointer',           // Cursor style
  badge: 'NEW',                // Corner badge
})
```

## Creating Custom Traits

```tsx
import { createTrait } from '@/lib/traits'

interface BadgeSlot {
  text: string
  color: 'red' | 'green' | 'blue'
}

export const BadgeTrait = createTrait<BadgeSlot>({
  id: 'badge',

  render: (slot) => (
    <span className={`badge badge-${slot.color}`}>
      {slot.text}
    </span>
  ),

  style: (slot) => ({
    position: 'relative',
  }),

  className: (slot) => `has-badge-${slot.color}`,
})
```

## API Reference

### Hooks

| Hook | Signature | Returns |
|------|-----------|---------|
| `useTrait` | `(trait, targetId)` | `{ slot, rendered, style, className, isInjected }` |
| `useTraits` | `([traitA, traitB], targetId)` | `{ traits: { [id]: result }, rendered, style, className, isInjected }` |
| `useInject` | `()` | `{ inject, clear, clearAll }` |
| `useHasInjection` | `(trait, targetId)` | `boolean` |

### Injection Functions

```typescript
const { inject, clear, clearAll } = useInject()

inject(Trait, 'id', slotValue)   // Inject slot
clear(Trait, 'id')               // Clear single injection
clearAll(Trait)                  // Clear all injections for trait
```

## Testbed

Visit `/testbed/traits` to see all test cases.

## Files

```
src/lib/traits/
├── README.md                  # This file
├── CLAUDE.traits.md           # Agent handoff document
├── types.ts                   # TypeScript interfaces
├── context.tsx                # TraitProvider + hooks
├── createTrait.ts             # Factory function
├── useTrait.ts                # Consumer hooks
├── traits/
│   └── ClickableAffordance.tsx
└── index.ts                   # Exports
```
