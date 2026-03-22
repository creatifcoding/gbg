/**
 * Position utilities — pure function tests.
 *
 * These are the only tests that make sense as unit tests.
 * dnd-kit drag modifier behavior requires browser/Playwright testing.
 */

import { describe, it, expect } from 'vitest'
import {
  snapToGrid,
  cascadePosition,
  findOpenSlot,
  staggerOffset,
  clampToViewport,
  applyMagneticSnap,
  type Viewport,
  type PanelRect,
} from '../position'

const viewport: Viewport = { x: 0, y: 0, width: 1920, height: 1080 }
const smallViewport: Viewport = { x: 0, y: 0, width: 400, height: 300 }
const dims = { width: 320, height: 240 }

// =============================================================================
// snapToGrid
// =============================================================================

describe('snapToGrid', () => {
  it('rounds to nearest grid point', () => {
    expect(snapToGrid({ x: 23, y: 47 }, 20)).toEqual({ x: 20, y: 40 })
  })

  it('rounds up at midpoint', () => {
    expect(snapToGrid({ x: 30, y: 30 }, 20)).toEqual({ x: 40, y: 40 })
  })

  it('passes through when gridSize is 0', () => {
    expect(snapToGrid({ x: 23, y: 47 }, 0)).toEqual({ x: 23, y: 47 })
  })

  it('passes through when gridSize is negative', () => {
    expect(snapToGrid({ x: 23, y: 47 }, -10)).toEqual({ x: 23, y: 47 })
  })

  it('handles exact grid positions', () => {
    expect(snapToGrid({ x: 40, y: 60 }, 20)).toEqual({ x: 40, y: 60 })
  })

  it('snaps to 1px grid (identity for integers)', () => {
    expect(snapToGrid({ x: 23, y: 47 }, 1)).toEqual({ x: 23, y: 47 })
  })
})

// =============================================================================
// cascadePosition
// =============================================================================

describe('cascadePosition', () => {
  it('places first panel at top-left with padding', () => {
    const pos = cascadePosition([], dims, viewport)
    expect(pos.x).toBe(16) // VIEWPORT_PADDING
    expect(pos.y).toBe(16)
  })

  it('cascades second panel offset from first', () => {
    const existing: PanelRect[] = [{ x: 16, y: 16, width: 320, height: 240 }]
    const pos = cascadePosition(existing, dims, viewport)
    // Should be offset by CASCADE_OFFSET (30)
    expect(pos.x).toBe(46) // 16 + 30
    expect(pos.y).toBe(46)
  })

  it('cascades third panel further', () => {
    const existing: PanelRect[] = [
      { x: 16, y: 16, width: 320, height: 240 },
      { x: 46, y: 46, width: 320, height: 240 },
    ]
    const pos = cascadePosition(existing, dims, viewport)
    expect(pos.x).toBe(76) // 16 + 60
    expect(pos.y).toBe(76)
  })

  it('avoids overlapping with existing panels', () => {
    // Place a panel exactly at the first cascade position
    const existing: PanelRect[] = [{ x: 16, y: 16, width: 320, height: 240 }]
    const pos = cascadePosition(existing, dims, viewport)
    // Must NOT be at (16, 16)
    expect(pos.x).not.toBe(16)
    expect(pos.y).not.toBe(16)
  })

  it('handles small viewport gracefully', () => {
    const pos = cascadePosition([], dims, smallViewport)
    // Should clamp to fit
    expect(pos.x).toBeLessThanOrEqual(smallViewport.width - dims.width)
    expect(pos.y).toBeLessThanOrEqual(smallViewport.height - dims.height)
  })
})

// =============================================================================
// findOpenSlot
// =============================================================================

describe('findOpenSlot', () => {
  it('returns top-left when no panels exist', () => {
    const pos = findOpenSlot([], dims, viewport)
    expect(pos).not.toBeNull()
    expect(pos!.x).toBe(16) // VIEWPORT_PADDING
    expect(pos!.y).toBe(16)
  })

  it('finds gap next to existing panel', () => {
    const existing: PanelRect[] = [{ x: 16, y: 16, width: 320, height: 240 }]
    const pos = findOpenSlot(existing, dims, viewport)
    expect(pos).not.toBeNull()
    // Should not overlap
    const noOverlap =
      pos!.x >= 16 + 320 || // right of existing
      pos!.y >= 16 + 240    // below existing
    expect(noOverlap).toBe(true)
  })

  it('returns null when viewport is too small', () => {
    const tinyViewport: Viewport = { x: 0, y: 0, width: 100, height: 100 }
    const pos = findOpenSlot([], { width: 200, height: 200 }, tinyViewport)
    expect(pos).toBeNull()
  })
})

// =============================================================================
// staggerOffset
// =============================================================================

describe('staggerOffset', () => {
  it('returns origin for index 0', () => {
    expect(staggerOffset(0)).toEqual({ x: 0, y: 0 })
  })

  it('offsets diagonally', () => {
    expect(staggerOffset(3)).toEqual({ x: 90, y: 90 })
  })

  it('accepts custom step', () => {
    expect(staggerOffset(2, 15)).toEqual({ x: 30, y: 30 })
  })
})

// =============================================================================
// clampToViewport
// =============================================================================

describe('clampToViewport', () => {
  it('passes through positions that fit', () => {
    const pos = clampToViewport({ x: 100, y: 100 }, dims, viewport)
    expect(pos).toEqual({ x: 100, y: 100 })
  })

  it('clamps negative positions', () => {
    const pos = clampToViewport({ x: -50, y: -100 }, dims, viewport)
    expect(pos.x).toBe(16) // VIEWPORT_PADDING
    expect(pos.y).toBe(16)
  })

  it('clamps positions that overflow right', () => {
    const pos = clampToViewport({ x: 1800, y: 100 }, dims, viewport)
    expect(pos.x).toBeLessThanOrEqual(viewport.width - dims.width)
  })

  it('clamps positions that overflow bottom', () => {
    const pos = clampToViewport({ x: 100, y: 900 }, dims, viewport)
    expect(pos.y).toBeLessThanOrEqual(viewport.height - dims.height)
  })

  it('handles panel larger than viewport', () => {
    const hugeDims = { width: 2000, height: 1200 }
    const pos = clampToViewport({ x: 100, y: 100 }, hugeDims, viewport)
    // Should clamp to padding at minimum
    expect(pos.x).toBe(16)
    expect(pos.y).toBe(16)
  })
})

// =============================================================================
// applyMagneticSnap
// =============================================================================

describe('applyMagneticSnap', () => {
  it('snaps to viewport left edge within threshold', () => {
    const pos = applyMagneticSnap(
      { x: 20, y: 100 },
      dims,
      viewport,
      [],
      { threshold: 8 },
    )
    expect(pos.x).toBe(16)
  })

  it('snaps to viewport center when near center', () => {
    const centerX = (viewport.width - dims.width) / 2
    const pos = applyMagneticSnap(
      { x: centerX + 6, y: 100 },
      dims,
      viewport,
      [],
      { threshold: 10, includeViewportCenter: true },
    )
    expect(pos.x).toBe(centerX)
  })

  it('snaps to sibling panel left alignment', () => {
    const siblings: PanelRect[] = [{ x: 400, y: 220, width: 300, height: 220 }]
    const pos = applyMagneticSnap(
      { x: 407, y: 260 },
      dims,
      viewport,
      siblings,
      { threshold: 10, includePanelAlign: true },
    )
    expect(pos.x).toBe(400)
  })

  it('does not snap when outside threshold', () => {
    const pos = applyMagneticSnap(
      { x: 50, y: 100 },
      dims,
      viewport,
      [],
      { threshold: 4 },
    )
    expect(pos.x).toBe(50)
  })
})
