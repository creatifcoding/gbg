/**
 * Position Utilities for Floating Panels
 *
 * Pure functions for smart panel placement, cascade positioning,
 * snap-to-grid, and gap-finding. Zero side effects, zero stx dependency.
 *
 * @module
 */

import type { Position, Dimensions } from '../types'

// =============================================================================
// Constants
// =============================================================================

/** Default cascade offset (px) — each new panel shifts right+down by this amount */
const CASCADE_OFFSET = 30

/** Minimum gap between panel edge and viewport edge */
const VIEWPORT_PADDING = 16

/** Overlap tolerance — panels closer than this are "overlapping" */
const OVERLAP_THRESHOLD = 20

// =============================================================================
// Types
// =============================================================================

export interface Viewport {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface PanelRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

// =============================================================================
// Snap-to-Grid
// =============================================================================

/**
 * Round a position to the nearest grid point.
 * gridSize of 0 = no snapping (passthrough).
 */
export function snapToGrid(position: Position, gridSize: number): Position {
  if (gridSize <= 0) return position
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize,
  }
}

// =============================================================================
// Cascade Placement
// =============================================================================

/**
 * Calculate the next cascade position given existing panel positions.
 *
 * Algorithm:
 * 1. Start from top-left (padding offset)
 * 2. For each existing panel, shift right+down by CASCADE_OFFSET
 * 3. If the cascade exceeds viewport bounds, wrap to top-left with a fresh offset
 * 4. Returns the first position that doesn't overlap with an existing panel
 */
export function cascadePosition(
  existing: ReadonlyArray<PanelRect>,
  dimensions: Dimensions,
  viewport: Viewport,
  offset: number = CASCADE_OFFSET,
): Position {
  const startX = viewport.x + VIEWPORT_PADDING
  const startY = viewport.y + VIEWPORT_PADDING
  const maxX = viewport.x + viewport.width - dimensions.width - VIEWPORT_PADDING
  const maxY = viewport.y + viewport.height - dimensions.height - VIEWPORT_PADDING

  // No existing panels — place at top-left
  if (existing.length === 0) {
    return { x: Math.min(startX, maxX), y: Math.min(startY, maxY) }
  }

  // Try cascade positions
  let wrapCount = 0
  for (let i = 0; i < existing.length + 5; i++) {
    const candidateX = startX + (i * offset) + (wrapCount * offset * 0.5)
    const candidateY = startY + (i * offset) + (wrapCount * offset * 0.5)

    // Wrap if exceeds viewport
    if (candidateX > maxX || candidateY > maxY) {
      wrapCount++
      continue
    }

    // Check if this position overlaps with any existing panel
    const overlaps = existing.some(
      (p) =>
        Math.abs(p.x - candidateX) < OVERLAP_THRESHOLD &&
        Math.abs(p.y - candidateY) < OVERLAP_THRESHOLD
    )

    if (!overlaps) {
      return { x: candidateX, y: candidateY }
    }
  }

  // Fallback: stagger from the last panel
  const last = existing[existing.length - 1]
  return clampToViewport(
    { x: last.x + offset, y: last.y + offset },
    dimensions,
    viewport,
  )
}

// =============================================================================
// Find Open Slot
// =============================================================================

/**
 * Scan viewport for the first rectangular gap that fits the given dimensions.
 * Uses a simple grid-scan approach (not optimal, but fast enough for <20 panels).
 *
 * Scans left-to-right, top-to-bottom with SCAN_STEP increments.
 * Returns the first position where the panel doesn't overlap any existing panel.
 */
export function findOpenSlot(
  existing: ReadonlyArray<PanelRect>,
  dimensions: Dimensions,
  viewport: Viewport,
  scanStep: number = 40,
): Position | null {
  const maxX = viewport.x + viewport.width - dimensions.width - VIEWPORT_PADDING
  const maxY = viewport.y + viewport.height - dimensions.height - VIEWPORT_PADDING

  for (let y = viewport.y + VIEWPORT_PADDING; y <= maxY; y += scanStep) {
    for (let x = viewport.x + VIEWPORT_PADDING; x <= maxX; x += scanStep) {
      const candidate: PanelRect = { x, y, width: dimensions.width, height: dimensions.height }
      const fits = !existing.some((p) => rectsOverlap(candidate, p))
      if (fits) return { x, y }
    }
  }

  return null // No gap found — fallback to cascade
}

// =============================================================================
// Stagger Offset
// =============================================================================

/**
 * Simple diagonal stagger: panel N is offset by N * step from origin.
 */
export function staggerOffset(
  index: number,
  step: number = CASCADE_OFFSET,
): Position {
  return { x: index * step, y: index * step }
}

// =============================================================================
// Viewport Clamping
// =============================================================================

/**
 * Clamp a position so the panel stays fully within the viewport.
 */
export function clampToViewport(
  position: Position,
  dimensions: Dimensions,
  viewport: Viewport,
): Position {
  return {
    x: Math.max(
      viewport.x + VIEWPORT_PADDING,
      Math.min(position.x, viewport.x + viewport.width - dimensions.width - VIEWPORT_PADDING),
    ),
    y: Math.max(
      viewport.y + VIEWPORT_PADDING,
      Math.min(position.y, viewport.y + viewport.height - dimensions.height - VIEWPORT_PADDING),
    ),
  }
}

// =============================================================================
// Helpers (internal)
// =============================================================================

/** Check if two rectangles overlap (with zero tolerance) */
function rectsOverlap(a: PanelRect, b: PanelRect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  )
}
