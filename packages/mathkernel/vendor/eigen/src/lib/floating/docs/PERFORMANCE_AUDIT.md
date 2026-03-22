# Floating Panel Performance Audit

**Date:** 2026-02-19
**Auditor:** Val (VAL — Vigilant Architecture Layer)
**Scope:** `src/lib/floating/` (4,278 LOC across 15 files)

---

## Executive Summary

The floating panel system has **six critical performance anti-patterns** that compound into visible jank during drag and resize operations. The primary offenders are:

1. **Full Map cloning on every mutation** (14 occurrences)
2. **Zero `React.memo` usage** across all components
3. **No `requestAnimationFrame` throttling** on pointer move handlers
4. **No `batch()` usage** for multi-field Legend-State updates
5. **No `peek()` usage** for non-reactive reads
6. **No `will-change` CSS hints** for composited layers

---

## Anti-Pattern Inventory

### 1. Map Cloning on Every Mutation (CRITICAL)

**Count:** 14 occurrences in `floating-stx.ts`
**Impact:** Every panel mutation creates a new `Map` via `new Map(stx.data.panels.get())`, modifies it, then replaces the entire observable. This:
- Allocates a new Map object per mutation
- Copies all entries on every single-panel update
- Triggers a **full Map replacement notification** — every component subscribed to `panels` re-renders, even if only one panel changed
- O(n) per mutation where n = panel count

**Evidence:**
```typescript
// CURRENT: Every mutation clones the entire Map
export function updatePanelPosition(id: string, position: Position): void {
  const stx = getFloatingStx()
  const panels = new Map(stx.data.panels.get())  // Clone ALL panels
  const panel = panels.get(id)
  if (panel) {
    panels.set(id, { ...panel, position })        // Spread + replace
    stx.data.panels.set(panels)                    // Replace entire Map
  }
}
```

**Fix:** Use Legend-State's fine-grained observable Map methods:
```typescript
// OPTIMIZED: Direct observable mutation — only notifies listeners of THIS panel
export function updatePanelPosition(id: string, position: Position): void {
  const stx = getFloatingStx()
  const panel = stx.data.panels.get(id)  // Observable access
  if (panel) {
    panel.position.set(position)          // Fine-grained set
  }
}
```

### 2. Zero React.memo (HIGH)

**Count:** 0 `React.memo` calls across all 15 files
**Impact:** Every parent re-render cascades into every child. With multiple panels, a single panel move re-renders ALL panels.

**Affected components:**
- `FloatingPanel` — re-renders on any panels Map change
- `ResizeHandles` — re-renders when parent FloatingPanel re-renders
- `FloatingDragOverlay` — re-renders on every DndContext state change
- `FloatingDimensionProvider` — re-renders on parent
- `PanelContentRenderer` — re-renders on registry changes
- Icon components (`MinimizeIcon`, `CloseIcon`, etc.) — small but cumulative

### 3. No rAF Throttling on Pointer Moves (HIGH)

**Count:** 2 `handlePointerMove` handlers without throttling
**Impact:** `pointermove` fires at 60-120Hz+ depending on OS/device. Each event triggers:
- `calculateResize()` computation
- `updatePanelDimensions()` → Map clone → full replacement notification
- `updatePanelPosition()` → another Map clone → another full replacement
- React re-render of all subscribed components

**That's 2 Map clones + 2 full re-render cascades per pointer event, at 120Hz = 240 unnecessary Map allocations + 240 render cycles per second.**

**Locations:**
- `hooks/useResize.ts:139` — `handlePointerMove`
- `ResizeHandles.tsx:268` — `handlePointerMove`

### 4. No batch() Usage (MEDIUM)

**Count:** 0 `batch()` calls
**Impact:** Functions like `bringPanelToFront()` update both `panels` Map AND `zOrder` array in sequence. Without batching, each `.set()` triggers a separate notification → separate re-render.

**Evidence:**
```typescript
export function bringPanelToFront(id: string): void {
  // Update 1: triggers notification + re-render
  stx.data.zOrder.set(zOrder)
  
  // Update 2: triggers ANOTHER notification + re-render
  stx.data.panels.set(panels)
}
```

### 5. No peek() for Non-reactive Reads (MEDIUM)

**Count:** 0 `peek()` calls
**Impact:** Every `.get()` inside event handlers subscribes to changes, creating unnecessary tracking overhead. Event handlers don't need reactive subscriptions — they run once.

**Evidence:**
```typescript
// In handlePointerMove (fires 120Hz):
const stx = getFloatingStx()
const mods = stx.data.modifierKeys.get()  // Creates tracking subscription! Should be .peek()
```

### 6. No will-change / CSS Compositing Hints (LOW-MEDIUM)

**Count:** 0 `will-change` properties
**Impact:** Browser must determine compositing strategy per frame. For frequently-moving panels, explicit `will-change: transform` promotes to GPU compositor layer, avoiding main-thread layout/paint.

### 7. Inline Style Objects in JSX (LOW)

**Count:** 10+ inline `style={{...}}` in FloatingPanel.tsx
**Impact:** New object allocation per render. Minor individually, but cumulative across multiple panels rendering at 60fps.

### 8. Inline Event Handlers (LOW)

**Count:** Multiple `onClick={(e) => {...}}` in FloatingPanel.tsx
**Impact:** New closure per render. Minor but prevents `React.memo` from being effective (props always differ).

---

## Quantified Impact Estimate

### Current: Drag one panel across screen (1 second, 60 pointer events)

| Operation | Per Event | Total/sec |
|---|---|---|
| Map clones | 1 | 60 |
| Full re-render cascades | 1 | 60 |
| Object allocations (style) | 5-10 per panel × N panels | 300-600 |
| GC pressure | Medium | Visible jank |

### Current: Resize one panel (1 second, ~120 pointer events)

| Operation | Per Event | Total/sec |
|---|---|---|
| Map clones | 2 (dim + pos) | 240 |
| Full re-render cascades | 2 | 240 |
| No rAF throttle overhead | 120 events (many dropped) | Wasted CPU |

### After Optimization Target

| Operation | Per Event | Total/sec |
|---|---|---|
| Fine-grained observable set | 1 | 60 (rAF capped) |
| Component re-renders | 1 (only affected panel) | 60 |
| Map clones | 0 | 0 |
| GC pressure | Minimal | No jank |

**Expected improvement: 4-8x fewer renders, near-zero GC pressure during interactions.**

---

## Files Requiring Changes

| File | Priority | Changes |
|---|---|---|
| `floating-stx.ts` | P0 | Fine-grained Map ops, batch(), peek() |
| `FloatingPanel.tsx` | P0 | React.memo, stable style refs, will-change |
| `ResizeHandles.tsx` | P0 | React.memo, rAF throttle, peek() |
| `hooks/useResize.ts` | P0 | rAF throttle, peek() |
| `FloatingPanelProvider.tsx` | P1 | batch() in handlers |
| `FloatingDragOverlay.tsx` | P1 | React.memo |
| `FloatingDimensionProvider.tsx` | P2 | React.memo |
| `FloatingBoundsContext.tsx` | P2 | React.memo provider |
| `PanelRegistry.tsx` | P2 | React.memo PanelContentRenderer |
| `withDraggable.tsx` | P2 | React.memo inner component |
