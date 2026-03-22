# Floating Panel Performance Optimization — Technical Spec

**Epic:** PERF-FLOAT
**Author:** Val
**Date:** 2026-02-19
**Status:** Draft → Implementation

---

## 1. Architecture Change: Fine-Grained Observable Map

### Current Architecture
```
pointermove → updatePanelPosition()
  → new Map(stx.data.panels.get())     // O(n) clone
  → localMap.set(id, {...panel, pos})   // modify clone  
  → stx.data.panels.set(localMap)       // replace entire observable
  → Legend-State notifies ALL subscribers of panels
  → ALL components using useSelector(() => panels.get()) re-render
```

### Target Architecture
```
pointermove → updatePanelPosition()
  → stx.data.panels.get(id).position.set(newPos)  // O(1) direct set
  → Legend-State notifies only subscribers of panels[id].position
  → ONLY the affected panel's component re-renders
```

### Implementation Detail

Legend-State v3 `ObservableMap` supports fine-grained access:
```typescript
// Observable Map direct access (from DeepWiki research)
const obs = observable({ panels: new Map<string, PanelState>() })

// Fine-grained read — subscribes to specific key
obs.panels.get('panel-1')         // Returns Observable<PanelState>
obs.panels.get('panel-1').get()   // Returns raw PanelState value

// Fine-grained write — notifies only this key's listeners
obs.panels.get('panel-1').position.set({ x: 100, y: 200 })

// Full map operations (still available)
obs.panels.set('new-id', newPanel)    // Add entry
obs.panels.delete('old-id')           // Remove entry
```

### Migration Pattern for `floating-stx.ts`

Every mutation function follows this transformation:

```typescript
// BEFORE
export function updatePanelPosition(id: string, position: Position): void {
  const stx = getFloatingStx()
  const panels = new Map(stx.data.panels.get())
  const panel = panels.get(id)
  if (panel) {
    panels.set(id, { ...panel, position })
    stx.data.panels.set(panels)
  }
}

// AFTER
export function updatePanelPosition(id: string, position: Position): void {
  const panelObs = getFloatingStx().data.panels.get(id)
  if (panelObs?.peek()) {
    panelObs.position.set(position)
  }
}
```

For functions updating multiple fields:
```typescript
// AFTER (batched)
export function bringPanelToFront(id: string): void {
  const stx = getFloatingStx()
  batch(() => {
    const zOrder = stx.data.zOrder.peek().filter((pid: string) => pid !== id)
    zOrder.push(id)
    stx.data.zOrder.set(zOrder)

    const baseZ = stx.data.baseZIndex.peek()
    zOrder.forEach((pid, index) => {
      stx.data.panels.get(pid)?.zIndex.set(baseZ + index)
    })
  })
}
```

---

## 2. rAF Throttle Utility

### Implementation

```typescript
// src/lib/floating/utils/raf-throttle.ts
export function rafThrottle<T extends (...args: any[]) => void>(fn: T): T & { cancel: () => void } {
  let rafId: number | null = null
  let lastArgs: Parameters<T> | null = null

  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args
    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (lastArgs) {
          fn(...lastArgs)
          lastArgs = null
        }
      })
    }
  }) as T & { cancel: () => void }

  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
      lastArgs = null
    }
  }

  return throttled
}
```

### Usage in Resize Handler

```typescript
// hooks/useResize.ts
const throttledMove = useMemo(
  () => rafThrottle((e: PointerEvent) => {
    // ... resize logic using .peek() for reads
  }),
  [panelId]
)

useEffect(() => () => throttledMove.cancel(), [throttledMove])
```

---

## 3. Component Memoization Strategy

### FloatingPanel

```typescript
export const FloatingPanel = memo(function FloatingPanel({ id, ... }: FloatingPanelProps) {
  // Fine-grained selector: subscribe to THIS panel only
  const panel = useSelector(() => {
    const p = getFloatingStx().data.panels.get(id)
    return p?.get()  // raw PanelState for this panel only
  })
  
  // Stable style object
  const panelStyle = useMemo(() => ({
    left: panel.position.x,
    top: panel.position.y,
    width: panel.dimensions.width,
    height: panel.dimensions.height,
    zIndex: panel.zIndex,
    willChange: panel.isDragging || panel.isResizing ? 'transform' : 'auto',
    // ... rest
  }), [panel.position, panel.dimensions, panel.zIndex, panel.isDragging, panel.isResizing])

  // ...
})
```

### Icon Components (extract + memo)

```typescript
const MinimizeIcon = memo(function MinimizeIcon() {
  return <svg>...</svg>
})
```

### ResizeHandles

```typescript
export const ResizeHandles = memo(function ResizeHandles({ panelId, ... }: ResizeHandlesProps) {
  // ... with rAF-throttled handlers
})
```

---

## 4. CSS Compositing Strategy

### During Drag (GPU-composited)
```css
.floating-panel--dragging {
  will-change: transform;
  /* Position via transform during drag, not left/top */
  transform: translate3d(var(--drag-dx), var(--drag-dy), 0);
}
```

### During Resize (GPU-composited)
```css
.floating-panel--resizing {
  will-change: width, height, transform;
}
```

### Idle (no hints — browser reclaims GPU memory)
```css
.floating-panel {
  will-change: auto;
}
```

---

## 5. useSelector Optimization

### Current (subscribes to entire Map)
```typescript
const panelsMap = useSelector(() => stx.data.panels.get())
const panel = panelsMap?.get(id)
```

### Optimized (subscribes to single panel)
```typescript
// Fine-grained: only re-renders when THIS panel changes
const panel = useSelector(() => stx.data.panels.get(id)?.get())
```

### For components that list all panels:
```typescript
// Only in PanelControls / debug views that genuinely need all panels
const allPanels = useSelector(() => {
  const zOrder = stx.data.zOrder.get()
  return zOrder.map(pid => stx.data.panels.get(pid)?.get()).filter(Boolean)
})
```

---

## 6. Stable Event Handler Pattern

### Current (new closure every render)
```tsx
<button onClick={(e) => { e.stopPropagation(); handleClose() }}>
```

### Optimized (stable ref)
```tsx
const onClose = useCallback((e: React.MouseEvent) => {
  e.stopPropagation()
  context.closePanel(id)
  onCloseProp?.()
}, [id, context, onCloseProp])

<button onClick={onClose}>
```

---

## 7. peek() Audit

Replace `.get()` with `.peek()` in these contexts:

| Location | Current | Fix |
|---|---|---|
| `ResizeHandles.tsx:275` | `stx.data.modifierKeys.get()` | `.peek()` |
| `floating-stx.ts` (all mutation fns) | `stx.data.panels.get()` | `.peek()` where reading for write |
| `floating-stx.ts:bringPanelToFront` | `stx.data.zOrder.get()` | `.peek()` |
| `floating-stx.ts:registerPanel` | `stx.data.baseZIndex.get()` | `.peek()` |
| `FloatingPanelProvider.tsx` handlers | `stxGetPanel(id)` → `.get()` | `.peek()` |

---

## Implementation Order

1. **`rafThrottle` utility** — Zero dependencies, enables everything else
2. **`floating-stx.ts` rewrite** — Fine-grained ops, batch, peek (biggest impact)
3. **`FloatingPanel.tsx` memo + stable refs** — Component-level optimization
4. **`ResizeHandles.tsx` rAF + memo** — Hot-path throttling
5. **`hooks/useResize.ts` rAF** — Secondary resize path
6. **Remaining components memo** — Completeness
7. **CSS will-change** — Final polish
8. **Verification** — React Profiler + manual TCs

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|---|---|---|
| Legend-State v3 beta Map proxy behavior differs from docs | Medium | Test each mutation in isolation before batch rewrite |
| Fine-grained selectors cause stale reads | Low | Use `useSelector(() => ...)` function form consistently |
| rAF throttle drops final event | Low | Flush on pointerup |
| React.memo blocks intentional re-renders | Low | Verify with Profiler after each component |
