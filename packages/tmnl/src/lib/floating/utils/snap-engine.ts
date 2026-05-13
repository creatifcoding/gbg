/**
 * Snap Engine — Proximity Snap Algorithm
 *
 * Simple, predictable snap: when a panel edge is within threshold of a
 * snap target, it jumps to that target. No "sticky" state, no escape
 * velocity — just proximity detection. Like macOS window snapping.
 *
 * Targets:
 * - Viewport edges (with padding)
 * - Sibling panel edges (left/right/top/bottom alignment)
 *
 * Does NOT snap to:
 * - Centers/midpoints (too many targets = chaotic)
 * - Grid intersections (use createSnapModifier for that)
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
  readonly source: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y'
  /** Label for debug rendering */
  readonly label?: string
}

export interface SnapRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface SnapConfig {
  /** Pixel distance to trigger snap (default: 12) */
  readonly threshold: number
  /** Include viewport edge lines */
  readonly includeViewport: boolean
  /** Include sibling panel alignment edges */
  readonly includeSiblings: boolean
}

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  threshold: 12,
  includeViewport: true,
  includeSiblings: true,
}

// =============================================================================
// Edge Generation
// =============================================================================

const VIEWPORT_PADDING = 8

/** Viewport snap edges — just the 4 borders + center cross */
export function viewportEdges(viewport: SnapRect): SnapEdge[] {
  return [
    // Left/Right walls (vertical lines → snap panel X)
    { direction: 'vertical', position: viewport.x + VIEWPORT_PADDING, source: 'left', label: 'vp-left' },
    { direction: 'vertical', position: viewport.x + viewport.width - VIEWPORT_PADDING, source: 'right', label: 'vp-right' },
    // Viewport center X
    { direction: 'vertical', position: viewport.x + viewport.width / 2, source: 'center-x', label: 'vp-center-x' },
    // Top/Bottom walls (horizontal lines → snap panel Y)
    { direction: 'horizontal', position: viewport.y + VIEWPORT_PADDING, source: 'top', label: 'vp-top' },
    { direction: 'horizontal', position: viewport.y + viewport.height - VIEWPORT_PADDING, source: 'bottom', label: 'vp-bottom' },
    // Viewport center Y
    { direction: 'horizontal', position: viewport.y + viewport.height / 2, source: 'center-y', label: 'vp-center-y' },
  ]
}

/** Sibling panel edges — just the 4 outer edges, no centers */
export function panelEdges(panel: SnapRect, label?: string): SnapEdge[] {
  const pfx = label ?? 'panel'
  return [
    { direction: 'vertical', position: panel.x, source: 'left', label: `${pfx}-L` },
    { direction: 'vertical', position: panel.x + panel.width, source: 'right', label: `${pfx}-R` },
    { direction: 'horizontal', position: panel.y, source: 'top', label: `${pfx}-T` },
    { direction: 'horizontal', position: panel.y + panel.height, source: 'bottom', label: `${pfx}-B` },
  ]
}

/** Build all snap edges for a drag session */
export function buildSnapGrid(
  viewport: SnapRect,
  siblings: ReadonlyArray<SnapRect>,
  config: SnapConfig = DEFAULT_SNAP_CONFIG,
): SnapEdge[] {
  const edges: SnapEdge[] = []
  if (config.includeViewport) edges.push(...viewportEdges(viewport))
  if (config.includeSiblings) {
    for (let i = 0; i < siblings.length; i++) {
      edges.push(...panelEdges(siblings[i], `s${i}`))
    }
  }
  return edges
}

// =============================================================================
// Core: Proximity Snap
// =============================================================================

export interface SnapResult {
  position: Position
  /** Edges the panel actually snapped to this frame */
  matchedEdges: SnapEdge[]
}

/**
 * Pure proximity snap — no state, no stickiness.
 *
 * For each axis, checks if ANY edge of the dragged panel (left, right, or
 * center for X; top, bottom, or center for Y) is within `threshold` px
 * of a snap edge. Picks the closest match.
 *
 * Returns the snapped position and which edges matched (for guide rendering).
 */
export function proximitySnap(
  position: Position,
  dims: Dimensions,
  edges: ReadonlyArray<SnapEdge>,
  config: SnapConfig = DEFAULT_SNAP_CONFIG,
): SnapResult {
  const { threshold } = config

  let snappedX = position.x
  let snappedY = position.y
  const matchedEdges: SnapEdge[] = []

  // ─── X axis (vertical edges) ─────────────────────────────────
  {
    let bestDist = Infinity
    let bestEdge: SnapEdge | null = null
    let bestPos = position.x

    // Panel reference points on X: left edge, center, right edge
    const panelLeft = position.x
    const panelCenter = position.x + dims.width / 2
    const panelRight = position.x + dims.width

    for (const edge of edges) {
      if (edge.direction !== 'vertical') continue

      // Check each panel reference against this edge
      const checks: Array<{ refPos: number; snapTo: number }> = [
        { refPos: panelLeft, snapTo: edge.position },                              // left→edge
        { refPos: panelRight, snapTo: edge.position },                             // right→edge
      ]

      // Only snap center to viewport center (not sibling edges)
      if (edge.source === 'center-x') {
        checks.push({ refPos: panelCenter, snapTo: edge.position })
      }

      for (const { refPos, snapTo } of checks) {
        const dist = Math.abs(refPos - snapTo)
        if (dist <= threshold && dist < bestDist) {
          bestDist = dist
          bestEdge = edge
          // Offset: position.x + (snapTo - refPos)
          bestPos = position.x + (snapTo - refPos)
        }
      }
    }

    if (bestEdge) {
      snappedX = bestPos
      matchedEdges.push(bestEdge)
    }
  }

  // ─── Y axis (horizontal edges) ───────────────────────────────
  {
    let bestDist = Infinity
    let bestEdge: SnapEdge | null = null
    let bestPos = position.y

    const panelTop = position.y
    const panelCenter = position.y + dims.height / 2
    const panelBottom = position.y + dims.height

    for (const edge of edges) {
      if (edge.direction !== 'horizontal') continue

      const checks: Array<{ refPos: number; snapTo: number }> = [
        { refPos: panelTop, snapTo: edge.position },
        { refPos: panelBottom, snapTo: edge.position },
      ]

      if (edge.source === 'center-y') {
        checks.push({ refPos: panelCenter, snapTo: edge.position })
      }

      for (const { refPos, snapTo } of checks) {
        const dist = Math.abs(refPos - snapTo)
        if (dist <= threshold && dist < bestDist) {
          bestDist = dist
          bestEdge = edge
          bestPos = position.y + (snapTo - refPos)
        }
      }
    }

    if (bestEdge) {
      snappedY = bestPos
      matchedEdges.push(bestEdge)
    }
  }

  return {
    position: { x: snappedX, y: snappedY },
    matchedEdges,
  }
}

// =============================================================================
// Legacy compat — keep old names for existing tests
// =============================================================================

/** @deprecated Use DEFAULT_SNAP_CONFIG */
export const SNAP_CONFIG = DEFAULT_SNAP_CONFIG

/** @deprecated Sticky state is removed — proximitySnap is stateless */
export interface StickyState {
  stuckX: SnapEdge | null
  stuckY: SnapEdge | null
}
export function createStickyState(): StickyState {
  return { stuckX: null, stuckY: null }
}

/** @deprecated Use proximitySnap instead */
export function stickySnap(
  position: Position,
  dims: Dimensions,
  edges: ReadonlyArray<SnapEdge>,
  _sticky: StickyState,
  config: SnapConfig = DEFAULT_SNAP_CONFIG,
): SnapResult {
  return proximitySnap(position, dims, edges, config)
}
