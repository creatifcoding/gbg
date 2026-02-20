/**
 * Dock layout pure function tests.
 */

import { describe, it, expect } from 'vitest'
import {
  approx,
  classifyDockZone,
  dockZoneLabel,
  resolveDockLayout,
} from '../layout'
import { DOCK_THRESHOLD } from '../types'
import type { Viewport } from '../../utils/position'

const viewport: Viewport = { x: 0, y: 0, width: 1920, height: 1080 }
const dims = { width: 400, height: 300 }

// =============================================================================
// approx
// =============================================================================

describe('approx', () => {
  it('returns true for values within epsilon', () => {
    expect(approx(100, 101, 2)).toBe(true)
  })

  it('returns false for values outside epsilon', () => {
    expect(approx(100, 105, 2)).toBe(false)
  })

  it('uses default epsilon of 2', () => {
    expect(approx(10, 12)).toBe(true)
    expect(approx(10, 13)).toBe(false)
  })
})

// =============================================================================
// resolveDockLayout
// =============================================================================

describe('resolveDockLayout', () => {
  it('returns null when panel is in center', () => {
    const result = resolveDockLayout({ x: 500, y: 300 }, dims, viewport)
    expect(result).toBeNull()
  })

  it('docks Left when near left edge', () => {
    const result = resolveDockLayout({ x: 5, y: 200 }, dims, viewport)
    expect(result).not.toBeNull()
    expect(result!.position).toEqual({ x: 0, y: 0 })
    expect(result!.dimensions.width).toBe(960)
    expect(result!.dimensions.height).toBe(1080)
  })

  it('docks Right when near right edge', () => {
    const result = resolveDockLayout({ x: 1920 - 400 - 10, y: 200 }, dims, viewport)
    expect(result).not.toBeNull()
    expect(result!.position.x).toBe(960)
    expect(result!.dimensions.height).toBe(1080)
  })

  it('docks Top when near top edge', () => {
    const result = resolveDockLayout({ x: 500, y: 5 }, dims, viewport)
    expect(result).not.toBeNull()
    expect(result!.position).toEqual({ x: 0, y: 0 })
    expect(result!.dimensions.width).toBe(1920)
    expect(result!.dimensions.height).toBe(540)
  })

  it('docks Bottom when near bottom edge', () => {
    const result = resolveDockLayout({ x: 500, y: 1080 - 300 - 10 }, dims, viewport)
    expect(result).not.toBeNull()
    expect(result!.position.y).toBe(540)
    expect(result!.dimensions.width).toBe(1920)
  })

  it('docks Top Left when near top-left corner', () => {
    const result = resolveDockLayout({ x: 5, y: 5 }, dims, viewport)
    expect(result).not.toBeNull()
    expect(result!.position).toEqual({ x: 0, y: 0 })
    expect(result!.dimensions).toEqual({ width: 960, height: 540 })
  })

  it('docks Top Right when near top-right corner', () => {
    const result = resolveDockLayout({ x: 1920 - 400 - 10, y: 5 }, dims, viewport)
    expect(result).not.toBeNull()
    expect(result!.position).toEqual({ x: 960, y: 0 })
    expect(result!.dimensions).toEqual({ width: 960, height: 540 })
  })

  it('docks Bottom Left when near bottom-left corner', () => {
    const result = resolveDockLayout({ x: 5, y: 1080 - 300 - 10 }, dims, viewport)
    expect(result).not.toBeNull()
    expect(result!.position).toEqual({ x: 0, y: 540 })
    expect(result!.dimensions).toEqual({ width: 960, height: 540 })
  })

  it('docks Bottom Right when near bottom-right corner', () => {
    const result = resolveDockLayout({ x: 1920 - 400 - 10, y: 1080 - 300 - 10 }, dims, viewport)
    expect(result).not.toBeNull()
    expect(result!.position).toEqual({ x: 960, y: 540 })
    expect(result!.dimensions).toEqual({ width: 960, height: 540 })
  })

  it('respects DOCK_THRESHOLD boundary exactly', () => {
    // Just inside threshold → dock
    const inside = resolveDockLayout({ x: DOCK_THRESHOLD, y: 200 }, dims, viewport)
    expect(inside).not.toBeNull()

    // Just outside threshold → no dock
    const outside = resolveDockLayout({ x: DOCK_THRESHOLD + 1, y: 200 }, dims, viewport)
    expect(outside).toBeNull()
  })
})

// =============================================================================
// classifyDockZone
// =============================================================================

describe('classifyDockZone', () => {
  it('classifies Left half layout', () => {
    const zone = classifyDockZone(
      { position: { x: 0, y: 0 }, dimensions: { width: 960, height: 1080 } },
      viewport,
    )
    expect(zone).toBe('Left')
  })

  it('classifies Top Right quarter layout', () => {
    const zone = classifyDockZone(
      { position: { x: 960, y: 0 }, dimensions: { width: 960, height: 540 } },
      viewport,
    )
    expect(zone).toBe('Top Right')
  })

  it('classifies Bottom half layout', () => {
    const zone = classifyDockZone(
      { position: { x: 0, y: 540 }, dimensions: { width: 1920, height: 540 } },
      viewport,
    )
    expect(zone).toBe('Bottom')
  })
})

// =============================================================================
// dockZoneLabel
// =============================================================================

describe('dockZoneLabel', () => {
  it('returns label with arrow for each zone', () => {
    expect(dockZoneLabel('Left')).toBe('⬅ Left')
    expect(dockZoneLabel('Right')).toBe('Right ➡')
    expect(dockZoneLabel('Top')).toBe('⬆ Top')
    expect(dockZoneLabel('Bottom')).toBe('⬇ Bottom')
    expect(dockZoneLabel('Top Left')).toBe('↖ Top Left')
    expect(dockZoneLabel('Top Right')).toBe('↗ Top Right')
    expect(dockZoneLabel('Bottom Left')).toBe('↙ Bottom Left')
    expect(dockZoneLabel('Bottom Right')).toBe('↘ Bottom Right')
  })
})
