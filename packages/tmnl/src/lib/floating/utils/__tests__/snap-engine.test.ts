/**
 * Snap Engine Tests — Sticky Snap Algorithm
 * @module
 */

import { describe, it, expect } from 'vitest'
import {
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
const CONFIG = { ...DEFAULT_SNAP_CONFIG, threshold: 10, escapeMultiplier: 2 }

function snap(x: number, y: number, sticky: StickyState, edges?: SnapEdge[]) {
  const grid = edges ?? buildSnapGrid(VIEWPORT, [], CONFIG)
  return stickySnap({ x, y }, DIMS, grid, sticky, CONFIG)
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
    const vCenter = edges.find(e => e.direction === 'vertical' && e.source === 'center')
    const hCenter = edges.find(e => e.direction === 'horizontal' && e.source === 'middle')
    expect(vCenter?.position).toBe(640)
    expect(hCenter?.position).toBe(360)
  })
})

describe('panelEdges', () => {
  it('generates 6 edges from a panel rect', () => {
    const panel: SnapRect = { x: 100, y: 200, width: 300, height: 150 }
    const edges = panelEdges(panel, 'test')
    expect(edges).toHaveLength(6)
    expect(edges.find(e => e.source === 'left')?.position).toBe(100)
    expect(edges.find(e => e.source === 'right')?.position).toBe(400) // 100+300
    expect(edges.find(e => e.source === 'center')?.position).toBe(250) // 100+150
    expect(edges.find(e => e.source === 'top')?.position).toBe(200)
    expect(edges.find(e => e.source === 'bottom')?.position).toBe(350) // 200+150
  })
})

describe('buildSnapGrid', () => {
  it('includes viewport edges when configured', () => {
    const grid = buildSnapGrid(VIEWPORT, [], { ...CONFIG, includeViewport: true, includeSiblings: false })
    expect(grid.length).toBe(6)
  })

  it('includes sibling edges', () => {
    const siblings = [{ x: 100, y: 100, width: 200, height: 150 }]
    const grid = buildSnapGrid(VIEWPORT, siblings, { ...CONFIG, includeViewport: false, includeSiblings: true })
    expect(grid.length).toBe(6) // 6 edges per sibling
  })

  it('combines viewport + multiple siblings', () => {
    const siblings = [
      { x: 100, y: 100, width: 200, height: 150 },
      { x: 500, y: 200, width: 300, height: 200 },
    ]
    const grid = buildSnapGrid(VIEWPORT, siblings, CONFIG)
    expect(grid.length).toBe(6 + 12) // 6 viewport + 6×2 siblings
  })
})

// =============================================================================
// Sticky Snap — Free Movement
// =============================================================================

describe('stickySnap — free movement', () => {
  it('does not snap when far from any edge', () => {
    const sticky = createStickyState()
    const result = snap(400, 300, sticky)
    expect(result.position).toEqual({ x: 400, y: 300 })
    expect(result.matchedEdges).toHaveLength(0)
    expect(sticky.stuckX).toBeNull()
    expect(sticky.stuckY).toBeNull()
  })

  it('passes through exact center without snapping if not within threshold', () => {
    const sticky = createStickyState()
    // Panel center = x + width/2 = x + 150, viewport center = 640
    // So panel left for center alignment = 640 - 150 = 490
    // Place panel at x=500, distance from 490 = 10, right at threshold
    const result = snap(501, 300, sticky)
    // 501 is 11px away from 490 (center snap) — outside threshold
    expect(result.position.x).toBe(501)
  })
})

// =============================================================================
// Sticky Snap — Sticking
// =============================================================================

describe('stickySnap — sticking', () => {
  it('snaps to viewport left edge when panel left is within threshold', () => {
    const sticky = createStickyState()
    // Viewport left edge = 16 (with padding)
    const result = snap(20, 300, sticky)
    expect(result.position.x).toBe(16) // snapped to viewport left
    expect(sticky.stuckX).not.toBeNull()
    expect(sticky.stuckX?.label).toBe('viewport-left')
  })

  it('snaps to viewport right edge when panel right is within threshold', () => {
    const sticky = createStickyState()
    // Viewport right edge = 1280 - 16 = 1264
    // Panel right = x + width = x + 300, so x = 1264 - 300 = 964
    const result = snap(960, 300, sticky)
    expect(result.position.x).toBe(964) // right edge aligns to viewport right
    expect(sticky.stuckX?.label).toBe('viewport-right')
  })

  it('snaps to viewport top edge', () => {
    const sticky = createStickyState()
    const result = snap(400, 18, sticky)
    expect(result.position.y).toBe(16)
    expect(sticky.stuckY?.label).toBe('viewport-top')
  })

  it('sticks to sibling panel left edge', () => {
    const sticky = createStickyState()
    const sibling: SnapRect = { x: 500, y: 100, width: 200, height: 150 }
    const edges = buildSnapGrid(VIEWPORT, [sibling], CONFIG)

    // Panel left near sibling left (500)
    const result = stickySnap({ x: 503, y: 300 }, DIMS, edges, sticky, CONFIG)
    expect(result.position.x).toBe(500) // snapped to sibling left
    expect(sticky.stuckX?.source).toBe('left')
  })

  it('reports matched edges for guide rendering', () => {
    const sticky = createStickyState()
    const result = snap(20, 18, sticky)
    expect(result.matchedEdges.length).toBeGreaterThanOrEqual(2) // stuck on both axes
  })
})

// =============================================================================
// Sticky Snap — Holding
// =============================================================================

describe('stickySnap — holding', () => {
  it('stays stuck when moving within escape distance', () => {
    const sticky = createStickyState()

    // First: stick to viewport left (16)
    snap(20, 300, sticky)
    expect(sticky.stuckX?.label).toBe('viewport-left')

    // Move slightly — still within escape (threshold × 2 = 20)
    const result = snap(30, 300, sticky)
    expect(result.position.x).toBe(16) // still stuck!
    expect(sticky.stuckX).not.toBeNull()
  })

  it('can be stuck on X and free on Y simultaneously', () => {
    const sticky = createStickyState()

    // Stick X to viewport left, Y is free (300 is far from any edge)
    snap(20, 300, sticky)
    expect(sticky.stuckX).not.toBeNull()
    expect(sticky.stuckY).toBeNull()

    // Move Y freely while X stays stuck
    const result = snap(20, 400, sticky)
    expect(result.position.x).toBe(16) // still stuck on X
    expect(result.position.y).toBe(400) // free on Y
  })
})

// =============================================================================
// Sticky Snap — Escaping
// =============================================================================

describe('stickySnap — escaping', () => {
  it('releases when dragged past escape distance', () => {
    const sticky = createStickyState()

    // Stick to viewport left (16)
    snap(20, 300, sticky)
    expect(sticky.stuckX?.label).toBe('viewport-left')

    // Drag past escape distance (threshold=10, escape=10×2=20)
    // Stuck at 16, so escape at 16+21 = 37
    const result = snap(37, 300, sticky)
    expect(result.position.x).toBe(37) // free!
    expect(sticky.stuckX).toBeNull()
  })

  it('can re-stick to a different edge after escaping', () => {
    const sticky = createStickyState()
    const sibling: SnapRect = { x: 200, y: 100, width: 300, height: 150 }
    const edges = buildSnapGrid(VIEWPORT, [sibling], CONFIG)

    // Stick to viewport left
    stickySnap({ x: 20, y: 300 }, DIMS, edges, sticky, CONFIG)
    expect(sticky.stuckX?.label).toBe('viewport-left')

    // Escape
    stickySnap({ x: 100, y: 300 }, DIMS, edges, sticky, CONFIG)
    expect(sticky.stuckX).toBeNull()

    // Approach sibling left edge (200) — stick again
    const result = stickySnap({ x: 203, y: 300 }, DIMS, edges, sticky, CONFIG)
    expect(result.position.x).toBe(200)
    expect(sticky.stuckX?.source).toBe('left')
  })
})

// =============================================================================
// Edge cases
// =============================================================================

describe('stickySnap — edge cases', () => {
  it('handles empty edge grid gracefully', () => {
    const sticky = createStickyState()
    const result = stickySnap({ x: 100, y: 100 }, DIMS, [], sticky, CONFIG)
    expect(result.position).toEqual({ x: 100, y: 100 })
    expect(result.matchedEdges).toHaveLength(0)
  })

  it('picks closest edge when multiple are within threshold', () => {
    const sticky = createStickyState()
    const edges: SnapEdge[] = [
      { direction: 'vertical', position: 100, source: 'left', label: 'a' },
      { direction: 'vertical', position: 105, source: 'left', label: 'b' },
    ]
    // Panel at x=103: 3px from 'b' (105), 3px from 'a' (100)
    // But left edge aligns: 103 vs 100 = 3px, 103 vs 105 = 2px
    const result = stickySnap({ x: 103, y: 300 }, DIMS, edges, sticky, CONFIG)
    // Should snap to closest — 105 is 2px away, 100 is 3px
    expect(result.position.x).toBe(105)
    expect(sticky.stuckX?.label).toBe('b')
  })

  it('right-edge-to-left-edge snap between siblings', () => {
    const sticky = createStickyState()
    const sibling: SnapRect = { x: 500, y: 100, width: 200, height: 150 }
    const edges = panelEdges(sibling)

    // Panel right edge = x + 300, sibling left = 500
    // So panel x = 500 - 300 = 200 for right-to-left alignment
    const result = stickySnap({ x: 198, y: 300 }, DIMS, edges, sticky, CONFIG)
    expect(result.position.x).toBe(200) // right edge of dragged panel aligns with left edge of sibling
  })
})
