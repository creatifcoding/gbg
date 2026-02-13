# 04 — Transfer Trait Wiring

**Parent**: [Index](./00-transfer-redesign-index.md)  
**Survey answer**: *"Keep and wire properly — this is where the actual usage of animations or styling is required."*

---

## Current State: Dead Abstractions

The existing transfer library defines three traits:

```typescript
// src/lib/transfer/traits.ts
export const TransferSourceTrait = createTrait<{ ... }>('transfer-source', { ... })
export const TransferTargetTrait = createTrait<{ ... }>('transfer-target', { ... })
export const TransferFeedbackTrait = createTrait<{ ... }>('transfer-feedback', { ... })
```

**Problem**: These are dead. They render `null`. No component consumes them. No animation or styling behavior is wired to transfer state transitions. They exist as API surface with zero implementation.

---

## What "Wire Properly" Means

Traits bridge **state transitions** to **visual feedback**. The transfer system has four key state transitions that need visual representation:

| Transition | Visual Feedback | Trait Owner |
|---|---|---|
| **Drag starts** on a row | Row gets "being-dragged" styling, drag ghost appears | `TransferSourceTrait` |
| **Drag hovers** over a target | Target lights up accept/reject indicator | `TransferTargetTrait` |
| **Drop accepted** | Target flash, source row returns to normal | `TransferFeedbackTrait` |
| **Drop rejected** | Target shake, token returns to source position | `TransferFeedbackTrait` |
| **Copy** | Brief highlight on copied rows, clipboard badge | `TransferFeedbackTrait` |

### Source Trait: "I'm being transferred"

```typescript
export interface TransferSourceTraitProps {
  /** Is this item currently being dragged? */
  readonly isDragging: boolean
  /** How many items in this drag operation? */
  readonly dragCount: number
  /** The surface this drag originates from */
  readonly surfaceId: string
}

// What it renders:
// - Opacity reduction on the source row (0.4 while dragging)
// - data-transfer-dragging="true" attribute for CSS targeting
// - Aria attributes for a11y
```

### Target Trait: "Something is hovering over me"

```typescript
export interface TransferTargetTraitProps {
  /** Is a drag currently hovering over this target? */
  readonly isOver: boolean
  /** Would the current drag be accepted? */
  readonly canAccept: boolean
  /** The token being offered (for preview) */
  readonly pendingToken: TransferToken | null
}

// What it renders:
// - Border highlight on the drop zone (green = accept, red = reject)
// - data-transfer-over="accept" | "reject" attribute for CSS
// - Drop zone resize animation (subtle expand to indicate target area)
```

### Feedback Trait: "A transfer just completed"

```typescript
export interface TransferFeedbackTraitProps {
  /** Recent transfer event for ephemeral feedback */
  readonly lastEvent: TransferFeedbackEvent | null
}

type TransferFeedbackEvent =
  | { readonly _tag: 'Accepted'; readonly tokenCount: number; readonly targetId: string }
  | { readonly _tag: 'Rejected'; readonly reason: string; readonly targetId: string }
  | { readonly _tag: 'Copied'; readonly tokenCount: number }

// What it renders:
// - Flash animation on accept (brief green pulse on target)
// - Shake animation on reject (brief red shake on target)  
// - Clipboard badge on copy (ephemeral "Copied 3 tasks" toast near source)
```

---

## Wiring Architecture

### How Traits Connect to TransferScope

The traits observe **scope atoms** — the same atoms owned by the `TransferScope` service. No new state is needed; traits are pure read projections:

```
TransferScope.session  ──→  TransferSourceTrait.isDragging
                        ──→  TransferTargetTrait.isOver
TransferScope.selection ──→  TransferSourceTrait.dragCount
(last event ref)       ──→  TransferFeedbackTrait.lastEvent
```

### Implementation Pattern

Traits use the existing `createTrait` + `useTrait` pattern from `src/lib/traits/`:

```typescript
import { createTrait } from '@/lib/traits'

export const TransferSourceTrait = createTrait<TransferSourceTraitProps>(
  'transfer-source',
  {
    // Default: not dragging
    isDragging: false,
    dragCount: 0,
    surfaceId: '',
  }
)
```

The compound hook (`useInlineTaskTransfer`) calculates the trait props from scope atoms and provides them to the trait system:

```typescript
// Inside useInlineTaskTransfer (simplified)
function useInlineTaskTransfer(config: InlineTaskTransferConfig) {
  const scope = useTransferScope(config.scopeConfig)
  const session = useAtomValue(scope.session)

  // Source trait props derived from session
  const sourceTraitProps = useMemo((): TransferSourceTraitProps => ({
    isDragging: session !== null,
    dragCount: session?.tokens.length ?? 0,
    surfaceId: config.scopeConfig.surfaceId,
  }), [session, config.scopeConfig.surfaceId])

  // Provide to trait system
  const { render: renderSourceTrait } = useTrait(TransferSourceTrait, sourceTraitProps)

  return {
    sourceTraitProps,
    renderSourceTrait,
    // ... other operations
  }
}
```

### Per-Row Trait Application

For row-level source feedback (opacity reduction, drag styling), the trait is applied **per row** via data attributes:

```tsx
// InlineTaskRow receives isDragging derived from scope session
function InlineTaskRow({ task, transferState }: InlineTaskRowProps) {
  const isDragging = transferState?.draggedIds.has(task.id) ?? false

  return (
    <div
      className="inline-task-row"
      data-transfer-dragging={isDragging || undefined}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      {/* row content */}
    </div>
  )
}
```

CSS handles the rest:

```css
/* message.css */
.inline-task-row[data-transfer-dragging] {
  opacity: 0.4;
  transition: opacity 120ms ease-out;
  pointer-events: none;
}
```

### Target Feedback (Composer Side)

The composer receives target trait props from its own scope:

```tsx
// In Composer or ComposerBand
function ComposerDropZone() {
  const scope = useTransferScope(composerScopeConfig)
  const bus = useTransferBus()

  // Derive target state from bus active drag
  const activeDrag = useAtomValue(bus.activeDrag)
  const isOver = useDropHover(composerRef)
  const canAccept = activeDrag
    ? scope.evaluate(activeDrag.tokens[0])._tag === 'TransferAccept'
    : false

  return (
    <div
      ref={composerRef}
      data-transfer-over={isOver ? (canAccept ? 'accept' : 'reject') : undefined}
    >
      {/* composer content */}
    </div>
  )
}
```

```css
/* composer.css */
[data-transfer-over="accept"] {
  outline: 1px solid var(--rvn-accent-cyan);
  background: rgba(0, 255, 255, 0.03);
}

[data-transfer-over="reject"] {
  outline: 1px solid var(--rvn-status-error);
  background: rgba(255, 0, 0, 0.03);
}
```

---

## Feedback Animations

The `TransferFeedbackTrait` is where animation library integration happens. This connects to the existing `animatable()` + `useAnimatable()` pattern from `src/lib/animation/`:

### Accept Flash

```typescript
import { animatable, useAnimatable, Animatable } from '@/lib/animation'

const acceptFlash = animatable(0, { duration: 400, ease: 'power2.out' })

function useTransferFeedback(lastEvent: TransferFeedbackEvent | null) {
  const flash = useAnimatable(acceptFlash)

  useEffect(() => {
    if (lastEvent?._tag === 'Accepted') {
      flash.snap(1)   // Instant to full
      flash.to(0)     // Fade out
    }
  }, [lastEvent])

  return { flashOpacity: flash.value }
}
```

### Reject Shake

```typescript
const rejectShake = animatable(0, { duration: 300, ease: 'elastic.out(1, 0.3)' })

function useRejectFeedback(lastEvent: TransferFeedbackEvent | null) {
  const shake = useAnimatable(rejectShake)

  useEffect(() => {
    if (lastEvent?._tag === 'Rejected') {
      shake.snap(8)    // Offset 8px
      shake.to(0)      // Settle back
    }
  }, [lastEvent])

  return { shakeX: shake.value }
}
```

### Copy Badge

```typescript
// Ephemeral "Copied N tasks" near the source
function CopyFeedbackBadge({ lastEvent }: { lastEvent: TransferFeedbackEvent | null }) {
  if (lastEvent?._tag !== 'Copied') return null

  return (
    <div className="transfer-copy-badge" data-animate="fade-up">
      Copied {lastEvent.tokenCount} task{lastEvent.tokenCount > 1 ? 's' : ''}
    </div>
  )
}
```

---

## Trait CSS Selectors (Added to message.css)

```css
/* ── Transfer Source Feedback ─────────────────────── */
.inline-task-row[data-transfer-dragging] {
  opacity: 0.4;
  transition: opacity 120ms ease-out;
  pointer-events: none;
}

.inline-task-row[data-transfer-dragging] .inline-task-row-toolbar {
  visibility: hidden;
}

/* ── Transfer Target Feedback ─────────────────────── */
[data-transfer-over="accept"] {
  outline: 1px solid var(--rvn-accent-cyan, #00e5ff);
  outline-offset: -1px;
  background: rgba(0, 229, 255, 0.03);
  transition: outline-color 100ms ease, background 100ms ease;
}

[data-transfer-over="reject"] {
  outline: 1px dashed var(--rvn-status-error, #ff4444);
  outline-offset: -1px;
  background: rgba(255, 68, 68, 0.03);
  transition: outline-color 100ms ease, background 100ms ease;
}

/* ── Transfer Copy Feedback ───────────────────────── */
.transfer-copy-badge {
  position: absolute;
  top: -24px;
  right: 8px;
  font-size: var(--tmnl-text-xs, 12px);
  color: var(--rvn-accent-cyan, #00e5ff);
  pointer-events: none;
  animation: transfer-fade-up 600ms ease-out forwards;
}

@keyframes transfer-fade-up {
  0%   { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-12px); }
}
```

---

## What Changes from Current Traits

| Aspect | Current | Redesigned |
|---|---|---|
| Render output | `null` | Real feedback elements + data attributes |
| State source | None | TransferScope atoms (session, selection) |
| Animation | None | `animatable()` from animation library |
| CSS selectors | None | `data-transfer-*` attribute selectors |
| Composition | Unused | Trait props derived in compound hook, applied per-row |
| Cleanup | N/A | Scope finalizers handle trait teardown |
