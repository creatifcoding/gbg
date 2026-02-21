/**
 * Snap Engine — Sticky Snap Algorithm
 *
 * Inspired by macOS window snapping and James Fisher's "sticky snap" concept.
 * Unlike magnetic snap (action-at-a-distance), sticky snap only grabs when
 * the panel CROSSES a snap line, then holds until escape velocity is reached.
 *
 * Architecture follows Snapster's edge/grid model:
 * - Edges: horizontal or vertical alignment targets (panel edges, centers, viewport bounds)
 * - Grid: collection of all edges for a given drag session
 * - Snap: per-frame calculation that checks proximity + sticky state
 *
 * @module
 */

import type { Position, Dimensions } from '../types'

// =============================================================================
// Types
// =============================================================================

export type EdgeDirection = 'horizontal' | 'vertical'

/** A single alignment edge — one axis position with metadata */
export interface SnapEdge {
  readonly direction: EdgeDirection
  readonly position: number
  /** Which part of the source generated this edge */
  readonly source: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom'
  /** Label for debug rendering (e.g., "viewport-left", "panel-3-center") */
  readonly label?: string
}

export interface SnapRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface SnapConfig {
  /** Pixel distance to detect snap line proximity (default: 8) */
  readonly threshold: number
  /** Distance to drag past a stuck line to break free (default: threshold × 2) */
  readonly escapeMultiplier: number
  /** Include viewport edge + center lines */
  readonly includeViewport: boolean
  /** Include sibling panel alignment edges */
  readonly includeSiblings: boolean
}

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  threshold: 8,
  escapeMultiplier: 2,
  includeViewport: true,
  includeSiblings: true,
}

// =============================================================================
// Sticky State — tracks which snap lines we're "stuck" to
// =============================================================================

export interface StickyState {
  /** The vertical edge we're stuck to (null = free on X axis) */
  stuckX: SnapEdge | null
  /** The horizontal edge we're stuck to (null = free on Y axis) */
  stuckY: SnapEdge | null
}

export function createStickyState(): StickyState {
  return { stuckX: null, stuckY: null }
}

// =============================================================================
// Edge Generation — build the snap grid from viewport + siblings
// =============================================================================

const VIEWPORT_PADDING = 16

/** Generate all snap edges for a viewport boundary */
export function viewportEdges(viewport: SnapRect): SnapEdge[] {
  return [
    // Vertical edges (snap X positions)
    { direction: 'vertical', position: viewport.x + VIEWPORT_PADDING, source: 'left', label: 'viewport-left' },
    { direction: 'vertical', position: viewport.x + viewport.width / 2, source: 'center', label: 'viewport-center' },
    { direction: 'vertical', position: viewport.x + viewport.width - VIEWPORT_PADDING, source: 'right', label: 'viewport-right' },
    // Horizontal edges (snap Y positions)
    { direction: 'horizontal', position: viewport.y + VIEWPORT_PADDING, source: 'top', label: 'viewport-top' },
    { direction: 'horizontal', position: viewport.y + viewport.height / 2, source: 'middle', label: 'viewport-center' },
    { direction: 'horizontal', position: viewport.y + viewport.height - VIEWPORT_PADDING, source: 'bottom', label: 'viewport-bottom' },
  ]
}

/** Generate snap edges from a sibling panel */
export function panelEdges(panel: SnapRect, label?: string): SnapEdge[] {
  const pfx = label ?? 'panel'
  return [
    // Vertical edges
    { direction: 'vertical', position: panel.x, source: 'left', label: `${pfx}-left` },
    { direction: 'vertical', position: panel.x + panel.width / 2, source: 'center', label: `${pfx}-center` },
    { direction: 'vertical', position: panel.x + panel.width, source: 'right', label: `${pfx}-right` },
    // Horizontal edges
    { direction: 'horizontal', position: panel.y, source: 'top', label: `${pfx}-top` },
    { direction: 'horizontal', position: panel.y + panel.height / 2, source: 'middle', label: `${pfx}-middle` },
    { direction: 'horizontal', position: panel.y + panel.height, source: 'bottom', label: `${pfx}-bottom` },
  ]
}

/** Build the full snap grid for a drag session */
export function buildSnapGrid(
  viewport: SnapRect,
  siblings: ReadonlyArray<SnapRect>,
  config: SnapConfig = DEFAULT_SNAP_CONFIG,
): SnapEdge[] {
  const edges: SnapEdge[] = []
  if (config.includeViewport) edges.push(...viewportEdges(viewport))
  if (config.includeSiblings) {
    for (let i = 0; i < siblings.length; i++) {
      edges.push(...panelEdges(siblings[i], `sibling-${i}`))
    }
  }
  return edges
}

// =============================================================================
// Core: Sticky Snap
// =============================================================================

/**
 * The panel being dragged has 3 reference points per axis:
 * - X axis: left edge, center, right edge
 * - Y axis: top edge, middle, bottom edge
 *
 * Each reference point can snap to edges of the same direction.
 * This function returns candidate snap positions for the panel's
 * top-left (x, y) given a target edge and the panel's dimensions.
 */
function panelPositionsForEdge(
  edge: SnapEdge,
  dims: Dimensions,
): number[] {
  if (edge.direction === 'vertical') {
    // Vertical edge → constrains panel X
    return [
      edge.position,                           // left aligns to edge
      edge.position - dims.width / 2,          // center aligns to edge
      edge.position - dims.width,              // right aligns to edge
    ]
  } else {
    // Horizontal edge → constrains panel Y
    return [
      edge.position,                           // top aligns to edge
      edge.position - dims.height / 2,         // middle aligns to edge
      edge.position - dims.height,             // bottom aligns to edge
    ]
  }
}

/**
 * Apply sticky snap to a position.
 *
 * Algorithm:
 * 1. For each axis, check if we're currently "stuck" to an edge
 * 2. If stuck: check if user has dragged past escape threshold → release
 * 3. If not stuck: check if any edge is within threshold → stick
 * 4. Return snapped position + matched edges for guide rendering
 *
 * Mutates `sticky` in place for cross-frame state.
 */
export function stickySnap(
  position: Position,
  dims: Dimensions,
  edges: ReadonlyArray<SnapEdge>,
  sticky: StickyState,
  config: SnapConfig = DEFAULT_SNAP_CONFIG,
): { position: Position; matchedEdges: SnapEdge[] } {
  const { threshold, escapeMultiplier } = config
  const escapeDistance = threshold * escapeMultiplier

  let snappedX = position.x
  let snappedY = position.y
  const matchedEdges: SnapEdge[] = []

  // ─── X axis (vertical edges) ─────────────────────────────────
  const verticals = edges.filter(e => e.direction === 'vertical')

  if (sticky.stuckX) {
    // Currently stuck — check escape
    const stuckPositions = panelPositionsForEdge(sticky.stuckX, dims)
    const closestStuck = stuckPositions.reduce((best, pos) =>
      Math.abs(position.x - pos) < Math.abs(position.x - best) ? pos : best
    )
    const drift = Math.abs(position.x - closestStuck)

    if (drift > escapeDistance) {
      // Escaped! Release the stick
      sticky.stuckX = null
      snappedX = position.x
    } else {
      // Still stuck — lock to the snap line
      snappedX = closestStuck
      matchedEdges.push(sticky.stuckX)
    }
  }

  if (!sticky.stuckX) {
    // Free — look for a new snap target
    let bestDist = Infinity
    let bestEdge: SnapEdge | null = null
    let bestPos = position.x

    for (const edge of verticals) {
      const candidates = panelPositionsForEdge(edge, dims)
      for (const candidate of candidates) {
        const dist = Math.abs(position.x - candidate)
        if (dist <= threshold && dist < bestDist) {
          bestDist = dist
          bestEdge = edge
          bestPos = candidate
        }
      }
    }

    if (bestEdge) {
      sticky.stuckX = bestEdge
      snappedX = bestPos
      matchedEdges.push(bestEdge)
    }
  }

  // ─── Y axis (horizontal edges) ───────────────────────────────
  const horizontals = edges.filter(e => e.direction === 'horizontal')

  if (sticky.stuckY) {
    const stuckPositions = panelPositionsForEdge(sticky.stuckY, dims)
    const closestStuck = stuckPositions.reduce((best, pos) =>
      Math.abs(position.y - pos) < Math.abs(position.y - best) ? pos : best
    )
    const drift = Math.abs(position.y - closestStuck)

    if (drift > escapeDistance) {
      sticky.stuckY = null
      snappedY = position.y
    } else {
      snappedY = closestStuck
      matchedEdges.push(sticky.stuckY)
    }
  }

  if (!sticky.stuckY) {
    let bestDist = Infinity
    let bestEdge: SnapEdge | null = null
    let bestPos = position.y

    for (const edge of horizontals) {
      const candidates = panelPositionsForEdge(edge, dims)
      for (const candidate of candidates) {
        const dist = Math.abs(position.y - candidate)
        if (dist <= threshold && dist < bestDist) {
          bestDist = dist
          bestEdge = edge
          bestPos = candidate
        }
      }
    }

    if (bestEdge) {
      sticky.stuckY = bestEdge
      snappedY = bestPos
      matchedEdges.push(bestEdge)
    }
  }

  return {
    position: { x: snappedX, y: snappedY },
    matchedEdges,
  }
}
