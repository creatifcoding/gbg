/**
 * Snap algorithms — proximity snap, sticky snap (legacy).
 *
 * @module floating/utils/snap-engine/algorithms
 */

import type { Position, Dimensions } from '../../types'
import { type SnapEdge, type SnapConfig, type SnapResult, type StickyState, DEFAULT_SNAP_CONFIG } from './types'

/**
 * Pure proximity snap — no state, no stickiness.
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

    const panelLeft = position.x
    const panelCenter = position.x + dims.width / 2
    const panelRight = position.x + dims.width

    for (const edge of edges) {
      if (edge.direction !== 'vertical') continue

      const checks: Array<{ refPos: number; snapTo: number }> = [
        { refPos: panelLeft, snapTo: edge.position },
        { refPos: panelRight, snapTo: edge.position },
      ]

      if (edge.source === 'center-x') {
        checks.push({ refPos: panelCenter, snapTo: edge.position })
      }

      for (const { refPos, snapTo } of checks) {
        const dist = Math.abs(refPos - snapTo)
        if (dist <= threshold && dist < bestDist) {
          bestDist = dist
          bestEdge = edge
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

export function createStickyState(): StickyState {
  return { stuckX: null, stuckY: null }
}

/** @deprecated Use DEFAULT_SNAP_CONFIG */
export const SNAP_CONFIG = DEFAULT_SNAP_CONFIG
