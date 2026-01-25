# Legend State Integration for Generative Streaming

**Date:** 2026-01-19
**Iteration:** ralph-loop continuation
**Mission:** Design concrete integration of Legend State's fine-grained reactivity for JSON streaming

---

## Current Architecture Analysis

### What We Have

1. **`stx` composition layer** (`src/lib/stx/`)
   - Already integrates Legend-State + XState + effect-atom
   - Provides `observable()`, `batch()`, `Memo`, `For` components
   - Bindings system for data ↔ machine sync

2. **JSON Render System** (`src/lib/json-render/`)
   - Uses `@effect-atom/atom` for state
   - `Renderer` component with `memo()` + stable callbacks
   - Schema validation via Effect Schema

3. **MorphCard Generative Mode** (`src/lib/morph-card/`)
   - Streams JSON patches from server
   - Batches updates every 50 operations
   - Uses effect-atom for tree state

### The Gap

The generative streaming uses **effect-atom atoms** for the UITree elements, but **Legend State observables** would provide:
- **Automatic fine-grained reactivity** - No need for `memo()` or stable callback tricks
- **Path-based updates** - `elements.key1.set(value)` only updates that specific element
- **`<For>` component** - Optimized list rendering without key comparisons
- **`<Memo>` component** - Text updates without parent re-renders

---

## Integration Strategy: Hybrid Approach

**Key Insight:** Don't replace effect-atom entirely. Use Legend State **at the render boundary** where fine-grained reactivity matters most.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        STREAMING PIPELINE                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   Network Layer (unchanged)                                                      │
│   └─ fetch() → ReadableStream → JSON Lines                                       │
│                                                                                  │
│   Accumulation Layer (changed: effect-atom → Legend State)                       │
│   └─ observable({ root: null, elements: {} })                                    │
│      └─ Direct mutation: elements[key].set(value)  ← O(1)                        │
│      └─ Batch: batch(() => { ... })                                              │
│                                                                                  │
│   Bridge Layer (NEW)                                                             │
│   └─ Observable<UITree> → effect-atom Result<UITree> for services                │
│      └─ Services still use Effect.gen + Atom.runtime()                           │
│      └─ React components use Legend State hooks                                  │
│                                                                                  │
│   Render Layer (changed: memo + callbacks → Legend State components)             │
│   └─ <For each={elements$}> for automatic list diffing                           │
│   └─ <Memo> for text content                                                     │
│   └─ observer() HOC for component-level reactivity                               │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Create Legend State Tree Observable

### File: `src/lib/json-render/react/observable-tree.ts` (NEW)

```typescript
import { observable, batch, type ObservableObject } from '@legendapp/state'
import type { UIElement } from '../core/schemas'

// =============================================================================
// Types
// =============================================================================

export interface ObservableUITree {
  root: string | null
  elements: Record<string, UIElement>
}

// =============================================================================
// Factory
// =============================================================================

/**
 * Create a Legend State observable for UITree
 * Optimized for streaming: O(1) element adds, fine-grained reactivity
 */
export function createTreeObservable(initial?: Partial<ObservableUITree>) {
  return observable<ObservableUITree>({
    root: initial?.root ?? null,
    elements: initial?.elements ?? {},
  })
}

// =============================================================================
// Mutations (for streaming)
// =============================================================================

/**
 * Apply a JSON patch operation to the tree
 * Designed for streaming consumption - no object spread
 */
export function applyPatch(
  tree$: ObservableObject<ObservableUITree>,
  op: { op: string; path: string; value?: unknown }
): void {
  if (op.op === 'replace' && op.path === '/root') {
    tree$.root.set(op.value as string)
  } else if (op.op === 'add' && op.path.startsWith('/elements/')) {
    const key = op.path.replace('/elements/', '')
    // Legend State: set at path creates if missing, updates if exists
    tree$.elements[key].set(op.value as UIElement)
  }
}

/**
 * Batch multiple patches for efficiency
 */
export function applyPatches(
  tree$: ObservableObject<ObservableUITree>,
  patches: Array<{ op: string; path: string; value?: unknown }>
): void {
  batch(() => {
    for (const patch of patches) {
      applyPatch(tree$, patch)
    }
  })
}
```

---

## Phase 2: Legend State Renderer Components

### File: `src/lib/json-render/react/legend-renderer.tsx` (NEW)

```typescript
import { type ReactNode, useMemo, useCallback } from 'react'
import { observer, Memo, For, Show, useSelector } from '@legendapp/state/react'
import { type ObservableObject } from '@legendapp/state'
import type { UIElement, Action } from '../core/schemas'
import type { EntranceAnimation } from '../core/animation-schema'
import { useIsVisible } from './hooks'
import { useEntrance } from './animation'
import { renderersAtom, schemasAtom, type SchemaEntry } from './atoms/catalog'
import type { ComponentRegistry, ComponentRenderProps } from './renderer'
import type { ObservableUITree } from './observable-tree'
import * as Result from '@effect-atom/atom/Result'
import { useAtomValue } from '@effect-atom/atom-react'

// =============================================================================
// Types
// =============================================================================

export interface LegendRendererProps {
  /** The observable UI tree */
  tree$: ObservableObject<ObservableUITree>
  /** Component registry (optional - uses catalog renderers by default) */
  registry?: ComponentRegistry
  /** Whether the tree is currently loading/streaming */
  loading?: boolean
  /** Fallback component for unknown types */
  fallback?: React.ComponentType<ComponentRenderProps>
  /** Action executor */
  onAction?: (action: Action) => void
  /** Disable entrance animations */
  disableAnimations?: boolean
}

// =============================================================================
// Element Renderer (observer-wrapped)
// =============================================================================

interface ElementProps {
  elementKey: string
  tree$: ObservableObject<ObservableUITree>
  registry: ComponentRegistry
  loading?: boolean
  fallback?: React.ComponentType<ComponentRenderProps>
  onAction?: (action: Action) => void
  index: number
  getDefaultEntrance?: (type: string) => EntranceAnimation | undefined
  disableAnimations?: boolean
}

/**
 * Individual element renderer
 * Uses observer() for automatic fine-grained reactivity
 * Only re-renders when THIS element's data changes
 */
const ElementRenderer = observer(function ElementRenderer({
  elementKey,
  tree$,
  registry,
  loading,
  fallback,
  onAction,
  index,
  getDefaultEntrance,
  disableAnimations = false,
}: ElementProps) {
  // Subscribe to just this element - fine-grained
  const element = useSelector(() => tree$.elements[elementKey].get())

  if (!element) return null

  // Check visibility
  const isVisible = useIsVisible(element.visible)
  if (!isVisible) return null

  // Resolve animation
  const animation = element.entrance ?? getDefaultEntrance?.(element.type)

  // Entrance animation hook
  const { ref: entranceRef, initialStyle } = useEntrance({
    animation,
    index,
    disabled: disableAnimations || !animation,
  })

  // Get component
  const Component = registry[element.type] ?? fallback
  if (!Component) {
    console.warn(`[legend-render] No renderer for: ${element.type}`)
    return null
  }

  // Render children using <For> for optimized list rendering
  const children = element.children?.length ? (
    <For each={() => element.children!}>
      {(childKey) => (
        <ElementRenderer
          key={childKey}
          elementKey={childKey}
          tree$={tree$}
          registry={registry}
          loading={loading}
          fallback={fallback}
          onAction={onAction}
          index={0} // Child index within parent
          getDefaultEntrance={getDefaultEntrance}
          disableAnimations={disableAnimations}
        />
      )}
    </For>
  ) : undefined

  const content = (
    <Component element={element} onAction={onAction} loading={loading}>
      {children}
    </Component>
  )

  // Wrap with animation container if needed
  if (animation && !disableAnimations) {
    return (
      <div ref={entranceRef} style={initialStyle}>
        {content}
      </div>
    )
  }

  return content
})

// =============================================================================
// Main Renderer
// =============================================================================

/**
 * Legend State powered renderer
 *
 * Benefits over standard renderer:
 * - No memo() needed - observer() handles it
 * - No stable callback tricks - selectors are fine-grained
 * - <For> optimizes list diffing
 * - Updates only affected elements
 */
export const LegendRenderer = observer(function LegendRenderer({
  tree$,
  registry: propRegistry,
  loading,
  fallback,
  onAction,
  disableAnimations = false,
}: LegendRendererProps) {
  // Get catalog renderers
  const catalogResult = useAtomValue(renderersAtom)
  const schemasResult = useAtomValue(schemasAtom)

  const catalogRenderers = useMemo(() => {
    if (Result.isSuccess(catalogResult)) {
      return catalogResult.value
    }
    return {}
  }, [catalogResult])

  const schemas = useMemo(() => {
    if (Result.isSuccess(schemasResult)) {
      return schemasResult.value
    }
    return {} as Record<string, SchemaEntry>
  }, [schemasResult])

  // Merge registries
  const mergedRegistry = useMemo(
    () => ({ ...catalogRenderers, ...propRegistry }),
    [catalogRenderers, propRegistry]
  )

  // Get default entrance callback
  const getDefaultEntrance = useCallback(
    (type: string) => schemas[type]?.defaultEntrance,
    [schemas]
  )

  // Subscribe to root (fine-grained)
  const root = useSelector(() => tree$.root.get())

  if (!root) return null

  return (
    <ElementRenderer
      elementKey={root}
      tree$={tree$}
      registry={mergedRegistry}
      loading={loading}
      fallback={fallback}
      onAction={onAction}
      index={0}
      getDefaultEntrance={getDefaultEntrance}
      disableAnimations={disableAnimations}
    />
  )
})
```

---

## Phase 3: Update useGenerativeMode Hook

### File: `src/lib/morph-card/hooks/useGenerativeMode.ts` (MODIFY)

Add Legend State support alongside existing effect-atom:

```typescript
import { observable, batch, type ObservableObject } from '@legendapp/state'
import type { ObservableUITree } from '@/lib/json-render/react/observable-tree'

// Add to UseGenerativeModeResult
export interface UseGenerativeModeResult {
  // ... existing fields ...

  /** Legend State observable tree (for LegendRenderer) */
  tree$: ObservableObject<ObservableUITree> | null
}

// Inside generateForMode callback, change accumulation:

// BEFORE: effect-atom registry.set()
const elements: Record<string, unknown> = {}
// ...
registry.set(atoms.state, { ... content: Option.some({ root, elements }) })

// AFTER: Legend State observable
const tree$ = observable<ObservableUITree>({ root: null, elements: {} })
// ...
batch(() => {
  tree$.root.set(root)
  for (const [key, value] of Object.entries(elements)) {
    tree$.elements[key].set(value as UIElement)
  }
})
// Store tree$ in ref for return
```

---

## Phase 4: Update MorphCard to Use LegendRenderer

### File: `src/lib/morph-card/components/MorphCard.tsx` (MODIFY)

```typescript
import { LegendRenderer } from '@/lib/json-render/react/legend-renderer'

// In generativeContent useMemo:
if (genMode.tree$) {
  return (
    <GenerativeDepthProvider prompt={prompt}>
      <LegendRenderer
        tree$={genMode.tree$}
        loading={genMode.status === 'streaming'}
        fallback={DefaultFallback}
      />
    </GenerativeDepthProvider>
  )
}
```

---

## Expected Performance Gains

| Metric | Before (memo + callbacks) | After (Legend State) |
|--------|---------------------------|----------------------|
| Element add | O(1) accumulate, O(n) React diff | O(1) accumulate, O(1) render |
| Parent re-render | Full subtree | Only changed element |
| Children list | map + key diff | `<For>` optimized |
| Text updates | Memo required | `<Memo>` automatic |
| Boilerplate | useRef + useCallback + memo | observer() only |

---

## Migration Path

1. **Phase 1**: Create observable-tree.ts + legend-renderer.tsx (parallel to existing)
2. **Phase 2**: Add `tree$` to useGenerativeMode (backwards compatible)
3. **Phase 3**: Update MorphCard to prefer `tree$` when available
4. **Phase 4**: Test, benchmark, iterate
5. **Phase 5**: Deprecate standard Renderer for streaming use cases

---

## Code Locations

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/json-render/react/observable-tree.ts` | CREATE | Legend State tree factory |
| `src/lib/json-render/react/legend-renderer.tsx` | CREATE | observer()-based renderer |
| `src/lib/json-render/react/index.ts` | MODIFY | Export new modules |
| `src/lib/morph-card/hooks/useGenerativeMode.ts` | MODIFY | Add tree$ observable |
| `src/lib/morph-card/components/MorphCard.tsx` | MODIFY | Use LegendRenderer |

---

## Questions for Prime

1. **Immediate implementation?** - Should I proceed with creating these files now?
2. **Feature flag?** - Want a toggle between old/new renderers for A/B testing?
3. **Scope** - Just generative streaming, or migrate all json-render to Legend State?

---

*Val out. The architecture has a plan.*
