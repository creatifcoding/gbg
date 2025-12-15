# Trait System — Agent Handoff Document

> A trait-based injection system for React components. Components declare which traits they implement, external code injects slots.

---

## Quick Context

This is a **React trait system** — think Rust traits or Scala mixins, but for component composition. The core insight:

1. **Components declare capabilities** via `useTrait(TraitDef, targetId)`
2. **External code injects behavior** via `inject(TraitDef, targetId, slot)`
3. **Provider scopes injections** — injections only reach descendants

No DOM manipulation. No magic. Just atoms tracking `traitId → targetId → slotValue`.

---

## File Map

```
src/lib/traits/
├── CLAUDE.traits.md          # You are here
├── types.ts                   # Core TypeScript interfaces
├── context.tsx                # TraitProvider + injection hooks
├── createTrait.ts             # Trait factory
├── useTrait.ts                # Consumer hook
├── traits/
│   └── ClickableAffordance.tsx  # First trait implementation
└── index.ts                   # Public exports

Related:
├── src/components/testbed/TraitTestbed.tsx       # Test cases (TC1-TC7)
├── src/components/testbed/HalflifeTimeline.tsx   # Real usage (DMG badge)
└── src/router.tsx                                # Route: /testbed/traits
```

---

## Architecture

### Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      TraitProvider                           │
│                                                               │
│   registry: Map<traitId, Map<targetId, slotValue>>          │
│                                                               │
│   ┌─────────────┐         ┌─────────────────────┐           │
│   │  Injector   │─inject─▶│      Registry       │           │
│   │  Component  │         │                     │           │
│   └─────────────┘         └──────────┬──────────┘           │
│                                      │                       │
│                              getInjections                   │
│                                      │                       │
│                           ┌──────────▼──────────┐           │
│                           │  Consumer Component │           │
│                           │  useTrait(Trait, id)│           │
│                           └─────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Core Types

```typescript
// Trait definition — the contract
interface Trait<TSlot> {
  id: string
  render: (slot: TSlot, targetId: string) => ReactNode
  style?: (slot: TSlot) => CSSProperties
  className?: (slot: TSlot) => string
  defaultSlot?: TSlot
}

// What useTrait returns
interface UseTraitResult<TSlot> {
  slot: TSlot | null           // Raw slot data
  rendered: ReactNode          // JSX from trait.render()
  style: CSSProperties         // Merged styles
  className: string            // Merged className
  isInjected: boolean          // Has active injection
}
```

---

## Usage Patterns

### Pattern 1: Consume a Trait

Components opt-in to traits via `useTrait`:

```tsx
import { useTrait, ClickableAffordance } from '@/lib/traits'

function MyButton({ id, children }: { id: string; children: ReactNode }) {
  const { rendered, style, className } = useTrait(ClickableAffordance, id)

  return (
    <button style={style} className={`my-button ${className}`}>
      {children}
      {rendered}  {/* Injected JSX appears here */}
    </button>
  )
}
```

**Key points:**
- `id` must be unique within the provider scope
- If no injection exists, `rendered` is null, `style` is empty
- Component is responsible for merging styles/className

### Pattern 2: Inject from Parent

```tsx
import { useInject, ClickableAffordance } from '@/lib/traits'

function ParentComponent() {
  const { inject, clear } = useInject()

  useEffect(() => {
    inject(ClickableAffordance, 'my-button-id', {
      tooltip: 'Click me!',
      glow: 'cyan',
    })

    return () => clear(ClickableAffordance, 'my-button-id')
  }, [])

  return <MyButton id="my-button-id">Hello</MyButton>
}
```

### Pattern 3: Injector Component

For bulk injection, create a dedicated injector:

```tsx
function AffordanceInjector({ items }: { items: Item[] }) {
  const { inject, clear } = useInject()

  useEffect(() => {
    for (const item of items) {
      inject(ClickableAffordance, `item-${item.id}`, {
        tooltip: item.helpText,
        glow: item.isHighlighted ? 'orange' : undefined,
      })
    }

    return () => {
      for (const item of items) {
        clear(ClickableAffordance, `item-${item.id}`)
      }
    }
  }, [items, inject, clear])

  return null  // Pure side effect
}

// Usage
function ItemList({ items }: { items: Item[] }) {
  return (
    <TraitProvider>
      <AffordanceInjector items={items} />
      {items.map(item => <ItemCard key={item.id} item={item} />)}
    </TraitProvider>
  )
}
```

### Pattern 4: Provider Scoping

Injections are scoped to their TraitProvider:

```tsx
<TraitProvider>
  {/* Injection A only reaches here */}
  <ComponentA id="shared-id" />  {/* Gets injection A */}
</TraitProvider>

<TraitProvider>
  {/* Injection B only reaches here */}
  <ComponentA id="shared-id" />  {/* Gets injection B */}
</TraitProvider>
```

---

## Built-in Traits

### ClickableAffordance

Makes elements obviously interactive:

```typescript
interface ClickableAffordanceSlot {
  tooltip?: string                                        // Hover text
  glow?: 'orange' | 'cyan' | 'violet' | 'green' | 'red' | 'amber'  // Ring color
  cursor?: 'pointer' | 'grab' | 'cell' | 'zoom-in' | 'help'
  pulse?: boolean                                         // Animate glow
  badge?: string                                          // Corner badge
}
```

**Renders:**
- Tooltip on hover (positioned above)
- Glow ring with optional pulse
- Badge in top-right corner
- Cursor style via `style` prop

---

## Creating New Traits

### Step 1: Define Slot Type

```typescript
// types.ts
export interface MySlot {
  label: string
  color: 'red' | 'blue'
  isActive: boolean
}
```

### Step 2: Create Trait

```tsx
// traits/MyTrait.tsx
import { createTrait } from '../createTrait'
import type { MySlot } from '../types'

export const MyTrait = createTrait<MySlot>({
  id: 'my-trait',

  render: (slot, targetId) => (
    <div className={`indicator ${slot.color}`}>
      {slot.label}
    </div>
  ),

  style: (slot) => ({
    borderColor: slot.isActive ? 'red' : 'gray',
  }),

  className: (slot) => slot.isActive ? 'active' : '',
})
```

### Step 3: Export

```typescript
// index.ts
export { MyTrait } from './traits/MyTrait'
export type { MySlot } from './types'
```

---

## Real-World Example: HALFLIFE DMG Badge

From `HalflifeTimeline.tsx`:

**1. Injector component:**
```tsx
function DamageAffordanceInjector({ findings }: { findings: Finding[] }) {
  const { inject, clear } = useInject()

  useEffect(() => {
    const damageEntries = findings.filter(f => f.type === 'damage')

    for (const entry of damageEntries) {
      inject(ClickableAffordance, `dmg-${entry.id}`, {
        tooltip: 'Click to view damage report',
        glow: 'orange',
        pulse: entry.status === 'active',
        cursor: 'pointer',
      })
    }

    return () => {
      for (const entry of damageEntries) {
        clear(ClickableAffordance, `dmg-${entry.id}`)
      }
    }
  }, [findings, inject, clear])

  return null
}
```

**2. Consumer component (DMG badge inside Modal.Trigger):**
```tsx
function DamageReportModal({ data }: { data: DamageModalData }) {
  const traitId = `dmg-${data.id}`
  const { rendered, style, className } = useTrait(ClickableAffordance, traitId)

  return (
    <Modal.Root>
      <Modal.Trigger asChild>
        <button
          style={style}
          className={`dmg-badge ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          DMG
          {rendered}  {/* Glow ring + tooltip appear here */}
        </button>
      </Modal.Trigger>
      {/* ... portal content ... */}
    </Modal.Root>
  )
}
```

**3. Wrapper with TraitProvider:**
```tsx
export function HalflifeTimeline({ defaultOpen = false }) {
  const data = halflifeData as HalflifeData

  return (
    <TraitProvider>
      <DamageAffordanceInjector findings={data.findings} />
      <HalflifeTimelineInner defaultOpen={defaultOpen} />
    </TraitProvider>
  )
}
```

---

## Testbed Reference

Located at `/testbed/traits`:

| TC | Name | Tests |
|----|------|-------|
| TC1 | Basic Consumption | Components consume traits, no injection |
| TC2 | Injection from Parent | Toggle inject/clear from parent |
| TC3 | Multiple Targets | Inject into several targets with different configs |
| TC4 | Glow Colors | All 6 color options |
| TC5 | Pulse Animation | Pulsing vs static glow |
| TC6 | Real-World (DMG) | Simulated HALFLIFE badge |
| TC7 | Provider Scoping | Injection isolation between providers |

---

## API Reference

### Exports

```typescript
// Core
export { createTrait } from './createTrait'
export { TraitProvider, useInject, useInjectOnMount } from './context'
export { useTrait, useHasInjection, useTraitInjections } from './useTrait'

// Built-in traits
export { ClickableAffordance } from './traits/ClickableAffordance'

// Types
export type {
  Trait,
  UseTraitResult,
  ClickableAffordanceSlot,
  TooltipSlot,
  PortalTargetSlot,
}
```

### Hook APIs

**useTrait(trait, targetId)**
```typescript
const { slot, rendered, style, className, isInjected } = useTrait(MyTrait, 'id')
```

**useInject()**
```typescript
const { inject, clear, clearAll } = useInject()
inject(MyTrait, 'id', slotValue)
clear(MyTrait, 'id')
clearAll(MyTrait)
```

**useHasInjection(trait, targetId)**
```typescript
const hasInjection: boolean = useHasInjection(MyTrait, 'id')
```

**useTraitInjections(trait)**
```typescript
const allInjections: Map<string, TSlot> = useTraitInjections(MyTrait)
```

---

## Extension Ideas

### 1. TooltipSlot Trait

Simple tooltip injection:
```typescript
interface TooltipSlot {
  content: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
  delay?: number
}
```

### 2. PortalTarget Trait

Named portal destinations:
```typescript
interface PortalTargetSlot {
  content: ReactNode
  priority?: number  // For stacking multiple injections
}
```

### 3. DraggableAffordance Trait

For drag-and-drop hints:
```typescript
interface DraggableSlot {
  dragHandle?: boolean
  dropZone?: boolean
  reorderHint?: 'up' | 'down' | 'left' | 'right'
}
```

### 4. ValidationState Trait

Form validation visualization:
```typescript
interface ValidationSlot {
  state: 'valid' | 'invalid' | 'warning'
  message?: string
}
```

### 5. Effect Integration

Wrap inject/clear in Effect for observability:
```typescript
const injectEffect = <T,>(trait: Trait<T>, id: string, slot: T) =>
  Effect.gen(function*() {
    yield* Effect.logInfo('Trait injected', { traitId: trait.id, targetId: id })
    yield* Effect.sync(() => ctx.inject(trait, id, slot))
  }).pipe(Effect.withSpan('Trait.inject'))
```

---

## Design Decisions

### Why Provider Scoping?

- Prevents injection leakage across unrelated UI regions
- Allows same targetId in different contexts
- Makes testing easier (isolated providers)

### Why Stacked Rendering?

- Multiple traits can affect same component
- Each trait's `rendered` JSX appears in sequence
- No conflict resolution needed — consumer controls placement

### Why Not Use effect-atom?

- Simple use case — just `useState` + `useContext`
- Provider scoping is natural with React context
- No need for atom persistence or derived atoms
- Could upgrade later if needed (e.g., for devtools)

---

## Gotchas

### 1. Cleanup on Unmount

Always clear injections in useEffect cleanup:
```typescript
useEffect(() => {
  inject(Trait, id, slot)
  return () => clear(Trait, id)  // IMPORTANT
}, [id])
```

### 2. Unique Target IDs

IDs must be unique within a provider. Use prefixes:
```typescript
const traitId = `dmg-${finding.id}`  // Good
const traitId = finding.id           // Might collide
```

### 3. Style Merging Order

Consumer is responsible for merge order:
```tsx
<button
  style={{ ...baseStyles, ...traitStyle }}  // Trait wins
  className={`base-class ${traitClassName}`}
>
```

### 4. No Provider = No Injection

If component isn't under TraitProvider, useTrait returns defaults:
```typescript
// No provider above
const { isInjected } = useTrait(Trait, 'id')
// isInjected === false (not an error)
```

---

## Session History

- **Created:** Trait system core (types, registry, provider)
- **Built:** ClickableAffordance trait with glow/tooltip/badge
- **Tested:** TC1-TC7 in testbed at `/testbed/traits`
- **Integrated:** DMG badge in HalflifeTimeline
- **Documented:** This handoff document

---

*Last updated: Session where trait system was created and DMG badge was wired.*
