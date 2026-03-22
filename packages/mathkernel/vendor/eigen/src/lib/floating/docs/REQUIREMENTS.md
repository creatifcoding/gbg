# Floating Panel Performance Optimization — Requirements

**Epic:** PERF-FLOAT — "Snappiest Experience Possible"
**Owner:** Val (Vigilant Architecture Layer)
**Date:** 2026-02-19

---

## Functional Requirements

### FR-1: Fine-Grained Observable Mutations
All panel state mutations MUST use Legend-State's direct observable Map methods (`obs.map.set(key, value)`, `obs.map.delete(key)`) instead of creating new Map instances. This ensures only listeners of the specific key are notified.

### FR-2: rAF-Throttled Pointer Handlers
All `pointermove` handlers for drag and resize MUST be throttled to `requestAnimationFrame` cadence (max 1 update per frame). Intermediate events MUST be coalesced — only the latest pointer position is applied per frame.

### FR-3: Batched Multi-Field Updates
Operations that update multiple observable fields (e.g., `bringToFront` updates `panels` + `zOrder`) MUST wrap all mutations in `batch()` to produce a single notification.

### FR-4: Component Memoization
All exported React components MUST be wrapped in `React.memo` or declared as `memo()` to prevent cascade re-renders from parent updates.

### FR-5: Non-Reactive Reads in Handlers
Event handlers and callbacks that read observable state without needing to subscribe MUST use `.peek()` instead of `.get()`.

### FR-6: CSS Compositing Optimization
Floating panels MUST use `will-change: transform` during active drag/resize operations, and remove the hint when idle. Panels MUST use `transform: translate3d()` for GPU-composited positioning during drag instead of `left`/`top`.

### FR-7: Stable References
Inline style objects and event handler closures in FloatingPanel.tsx MUST be replaced with `useMemo`/`useCallback` refs to prevent props invalidation in memoized children.

---

## Non-Functional Requirements

### NFR-1: Render Budget
During drag operations, a maximum of **1 component re-render per frame** (16.67ms) for the dragged panel. Other panels MUST NOT re-render.

### NFR-2: Resize Budget  
During resize operations, a maximum of **1 state update + 1 re-render per frame** for the resized panel. Other panels MUST NOT re-render.

### NFR-3: GC Pressure
Zero `new Map()` allocations during drag/resize hot paths. Object allocation budget: ≤2 objects per frame during interaction.

### NFR-4: First Contentful Interaction
Panel system initialization MUST complete in <50ms. No blocking computation on mount.

### NFR-5: Memory Footprint
Observable Map must hold panel state without duplication. No shadow state in React `useState` that mirrors observable values.

### NFR-6: Backward Compatibility
All public API signatures (`registerPanel`, `closePanel`, `bringToFront`, etc.) MUST remain unchanged. Internal implementation is the only scope of change.

---

## Acceptance Criteria

| ID | Criterion | Measurement |
|---|---|---|
| AC-1 | Drag 1 panel: other panels do NOT re-render | React DevTools Profiler → 0 renders on non-dragged panels |
| AC-2 | Resize 1 panel: ≤60 state updates/sec | Console counter in rAF wrapper |
| AC-3 | Zero `new Map()` in hot paths | grep confirms 0 `new Map(stx.data.panels` in mutation functions |
| AC-4 | All exported components memoized | grep confirms `React.memo` or `memo()` on all exports |
| AC-5 | `batch()` wraps all multi-set operations | grep confirms `batch(` in all multi-update functions |
| AC-6 | `peek()` in all event handlers | grep confirms `.peek()` not `.get()` in pointer/click handlers |
| AC-7 | `will-change` applied during drag/resize only | Inspect element confirms CSS property toggles |
| AC-8 | No regression in panel functionality | All testbed TCs (TC1-TC10) pass manual verification |

---

## Out of Scope

- Virtualization of panel list (not needed at current panel counts)
- Web Worker offloading (resize math is trivial)
- Server-side rendering (Tauri desktop app only)
- dnd-kit version upgrade (current API sufficient)
