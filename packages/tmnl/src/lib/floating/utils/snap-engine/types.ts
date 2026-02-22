/**
 * Snap Engine types and config.
 *
 * @module floating/utils/snap-engine/types
 */

export type EdgeDirection = 'horizontal' | 'vertical'

export interface SnapEdge {
  readonly direction: EdgeDirection
  readonly position: number
  readonly source: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y'
  readonly label?: string
}

export interface SnapRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface SnapConfig {
  readonly threshold: number
  readonly includeViewport: boolean
  readonly includeSiblings: boolean
}

export const DEFAULT_SNAP_CONFIG: SnapConfig = {
  threshold: 12,
  includeViewport: true,
  includeSiblings: true,
}

export interface SnapResult {
  position: import('../../types').Position
  matchedEdges: SnapEdge[]
}

/** @deprecated Sticky state is removed — proximitySnap is stateless */
export interface StickyState {
  stuckX: SnapEdge | null
  stuckY: SnapEdge | null
}
