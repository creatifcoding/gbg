# Canvas Mode Architecture Spec (P3 — Future)

> **Status**: Design-only. No implementation in this migration phase.

## Overview

Canvas mode is the third panel mode in SM's tri-modal system (tiled → floating → canvas).
A canvas panel lives inside the computational flow viewport, positioned by the engine
rather than the user or the split tree.

## Data Model

```typescript
// Extend PanelMode with 'canvas'
// Already forward-compatible: PanelMode = 'modal' | 'floating' | 'docked' | 'tiled' | 'canvas'

interface CanvasPanelFields {
  /** Engine-controlled position within flow viewport */
  canvasX: number
  canvasY: number
  /** Zoom level (1.0 = default) */
  zoom: number
  /** Flow viewport offset (pan position) */
  flowViewportOffset: { x: number; y: number }
}
```

## Mode Transition

```
tilePanel(id)    → removes from canvas, inserts into split tree
floatPanel(id)   → removes from canvas, creates floating window
canvasPanel(id)  → removes from tree/zOrder, places in flow viewport
```

## Rendering

Canvas panels render inside a `<div data-canvas-layer>` with:
- `transform: translate(canvasX, canvasY) scale(zoom)`
- Engine controls positioning (not user drag)
- Pan/zoom via scroll + pinch gestures

## Integration Points

1. **tldraw** — canvas panels could be tldraw shapes
2. **ReactFlow** — canvas panels as ReactFlow nodes
3. **Custom engine** — raw transform-based positioning

## Dependencies

- Requires: PanelState schema with canvas fields (add to types.ts)
- Requires: canvasPanel() action (add to stx/actions.ts)
- Requires: CanvasLayer component (new component in layout/)
- Requires: Flow viewport state in stx (flowViewportOffset, zoom)

## Open Questions

1. Should canvas panels support resize, or are they fixed-size?
2. How do canvas panels interact with the split tree? (Can they be split targets?)
3. Should canvas mode share the same z-index system as floating?
4. Pan/zoom: dedicated gesture handler or reuse existing drag infrastructure?

---

*This spec will be implemented in a future migration phase (P3).*
