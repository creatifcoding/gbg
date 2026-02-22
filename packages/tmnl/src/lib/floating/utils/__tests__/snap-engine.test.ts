/**
 * Snap Engine Tests — Proximity Snap Algorithm
 *
 * Tests the stateless proximity snap: panel edges within threshold
 * jump to the nearest snap target. No sticky state, no escape velocity.
 *
 * @module
 */

import { describe, it, expect } from 'vitest'
import {
  proximitySnap,
  stickySnap,
  buildSnapGrid,
  viewportEdges,
  panelEdges,
  createStickyState,
  DEFAULT_SNAP_CONFIG,
  type SnapEdge,
  type SnapRect,
  type StickyState,
} from '../snap-engine'

// =============================================================================
// Helpers
// =============================================================================

const VIEWPORT: SnapRect = { x: 0, y: 0, width: 1280, height: 720 }
const DIMS = { width: 300, height: 200 }
const CONFIG = { ...DEFAULT_SNAP_CONFIG, threshold: 10 }
const VIEWPORT_PADDING = 8

function snap(x: number, y: number, edges?: SnapEdge[]) {
  const grid = edges ?? buildSnapGrid(VIEWPORT, [], CONFIG)
  return proximitySnap({ x, y }, DIMS, grid, CONFIG)
}

// =============================================================================
// Edge Generation
// =============================================================================

describe('viewportEdges', () => {
  it('generates 6 edges (3 vertical + 3 horizontal)', () => {
    const edges = viewportEdges(VIEWPORT)
    expect(edges).toHaveLength(6)
    expect(edges.filter(e => e.direction === 'vertical')).toHaveLength(3)
    expect(edges.filter(e => e.direction === 'horizontal')).toHaveLength(3)
  })

  it('viewport center edges are at midpoint', () => {
    const edges = viewportEdges(VIEWPORT)
    const vCenter = edges.find(e => e.source === 'center-x')
    const hCenter = edges.find(e => e.source === 'center-y')
    expect(vCenter?.position).toBe(640)
    expect(hCenter?.position).toBe(360)
  })
})

describe('panelEdges', () => {
  it('generates 4 edges from a panel rect (no centers)', () => {
    const panel: SnapRect = { x: 100, y: 200, width: 300, height: 150 }
    const edges = panelEdges(panel, 'test')
    expect(edges).toHaveLength(4)
    expect(edges.find(e => e.source === 'left')?.position).toBe(100)
    expect(edges.find(e => e.source === 'right')?.position).toBe(400) // 100+300
    expect(edges.find(e => e.source === 'top')?.position).toBe(200)
    expect(edges.find(e => e.source === 'bottom')?.position).toBe(350) // 200+150
  })
})

describe('buildSnapGrid', () => {
  it('includes viewport edges when configured', () => {
    const grid = buildSnapGrid(VIEWPORT, [], { ...CONFIG, includeViewport: true, includeSiblings: false })
    expect(grid.length).toBe(6)
  })

  it('includes sibling edges (4 per sibling)', () => {
    const siblings = [{ x: 100, y: 100, width: 200, height: 150 }]
    const grid = buildSnapGrid(VIEWPORT, siblings, { ...CONFIG, includeViewport: false, includeSiblings: true })
    expect(grid.length).toBe(4) // 4 edges per sibling
  })

  it('combines viewport + multiple siblings', () => {
    const siblings = [
      { x: 100, y: 100, width: 200, height: 150 },
      { x: 500, y: 200, width: 300, height: 200 },
    ]
    const grid = buildSnapGrid(VIEWPORT, siblings, CONFIG)
    expect(grid.length).toBe(6 + 8) // 6 viewport + 4×2 siblings
  })
})

// =============================================================================
// Proximity Snap — Free Movement
// =============================================================================

describe('proximitySnap — free movement', () => {
  it('does not snap when far from any edge', () => {
    const result = snap(400, 300)
    expect(result.position).toEqual({ x: 400, y: 300 })
    expect(result.matchedEdges).toHaveLength(0)
  })

  it('passes through without snapping if outside threshold', () => {
    // Panel center = x + 150, viewport center = 640
    // Center snap position = 640 - 150 = 490
    // Place at x=501 → distance = 11 → outside threshold of 10
    const result = snap(501, 300)
    expect(result.position.x).toBe(501)
  })
})

// =============================================================================
// Proximity Snap — Snapping
// =============================================================================

describe('proximitySnap — snapping', () => {
  it('snaps to viewport left edge when panel left is within threshold', () => {
    // Viewport left edge = 0 + VIEWPORT_PADDING = 8
    const result = snap(12, 300)
    expect(result.position.x).toBe(VIEWPORT_PADDING) // snapped to 8
    expect(result.matchedEdges.length).toBeGreaterThanOrEqual(1)
    expect(result.matchedEdges.find(e => e.label === 'vp-left')).toBeDefined()
  })

  it('snaps to viewport right edge when panel right is within threshold', () => {
    // Viewport right edge = 1280 - 8 = 1272
    // Panel right = x + 300, so x = 1272 - 300 = 972
    const result = snap(968, 300)
    expect(result.position.x).toBe(972) // right edge aligns to viewport right
    expect(result.matchedEdges.find(e => e.label === 'vp-right')).toBeDefined()
  })

  it('snaps to viewport top edge', () => {
    const result = snap(400, 12)
    expect(result.position.y).toBe(VIEWPORT_PADDING) // snapped to 8
    expect(result.matchedEdges.find(e => e.label === 'vp-top')).toBeDefined()
  })

  it('snaps to sibling panel left edge', () => {
    const sibling: SnapRect = { x: 500, y: 100, width: 200, height: 150 }
    const edges = buildSnapGrid(VIEWPORT, [sibling], CONFIG)

    // Panel left near sibling left (500)
    const result = proximitySnap({ x: 503, y: 300 }, DIMS, edges, CONFIG)
    expect(result.position.x).toBe(500) // snapped to sibling left
    expect(result.matchedEdges.find(e => e.source === 'left')).toBeDefined()
  })

  it('reports matched edges for guide rendering', () => {
    const result = snap(12, 12)
    expect(result.matchedEdges.length).toBeGreaterThanOrEqual(2) // snapped on both axes
  })
})

// =============================================================================
// Proximity Snap — Stateless behavior
// =============================================================================

describe('proximitySnap — stateless', () => {
  it('snaps independently each call (no sticky memory)', () => {
    // Snap to left edge
    const r1 = snap(12, 300)
    expect(r1.position.x).toBe(VIEWPORT_PADDING)

    // Move far away — no sticky holdng
    const r2 = snap(400, 300)
    expect(r2.position.x).toBe(400)
  })

  it('re-snaps to different edges without escape logic', () => {
    const sibling: SnapRect = { x: 200, y: 100, width: 300, height: 150 }
    const edges = buildSnapGrid(VIEWPORT, [sibling], CONFIG)

    // Near viewport left
    const r1 = proximitySnap({ x: 12, y: 300 }, DIMS, edges, CONFIG)
    expect(r1.position.x).toBe(VIEWPORT_PADDING)

    // Near sibling left (200)
    const r2 = proximitySnap({ x: 203, y: 300 }, DIMS, edges, CONFIG)
    expect(r2.position.x).toBe(200)
  })
})

// =============================================================================
// Legacy compat — stickySnap wrapper
// =============================================================================

describe('stickySnap — legacy compat', () => {
  it('stickySnap delegates to proximitySnap', () => {
    const sticky = createStickyState()
    const edges = buildSnapGrid(VIEWPORT, [], CONFIG)

    const r1 = stickySnap({ x: 12, y: 300 }, DIMS, edges, sticky, CONFIG)
    const r2 = proximitySnap({ x: 12, y: 300 }, DIMS, edges, CONFIG)
    expect(r1.position).toEqual(r2.position)
  })

  it('createStickyState returns empty state', () => {
    const s = createStickyState()
    expect(s.stuckX).toBeNull()
    expect(s.stuckY).toBeNull()
  })
})

// =============================================================================
// Edge cases
// =============================================================================

describe('proximitySnap — edge cases', () => {
  it('handles empty edge grid gracefully', () => {
    const result = proximitySnap({ x: 100, y: 100 }, DIMS, [], CONFIG)
    expect(result.position).toEqual({ x: 100, y: 100 })
    expect(result.matchedEdges).toHaveLength(0)
  })

  it('picks closest edge when multiple are within threshold', () => {
    const edges: SnapEdge[] = [
      { direction: 'vertical', position: 100, source: 'left', label: 'a' },
      { direction: 'vertical', position: 105, source: 'left', label: 'b' },
    ]
    // Panel at x=103: |103-100|=3, |103-105|=2  → b wins
    const result = proximitySnap({ x: 103, y: 300 }, DIMS, edges, CONFIG)
    expect(result.position.x).toBe(105)
    expect(result.matchedEdges[0]?.label).toBe('b')
  })

  it('right-edge-to-left-edge snap between siblings', () => {
    const sibling: SnapRect = { x: 500, y: 100, width: 200, height: 150 }
    const edges = panelEdges(sibling)

    // Panel right = x + 300, sibling left = 500
    // Snap position: x = 500 - 300 = 200
    const result = proximitySnap({ x: 198, y: 300 }, DIMS, edges, CONFIG)
    expect(result.position.x).toBe(200)
  })
})
