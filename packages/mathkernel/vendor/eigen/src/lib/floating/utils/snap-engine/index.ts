/**
 * Snap Engine — re-export barrel.
 *
 * @module floating/utils/snap-engine
 */

export {
  type EdgeDirection,
  type SnapEdge,
  type SnapRect,
  type SnapConfig,
  type SnapResult,
  type StickyState,
  DEFAULT_SNAP_CONFIG,
} from './types'

export {
  viewportEdges,
  panelEdges,
  buildSnapGrid,
} from './edges'

export {
  proximitySnap,
  stickySnap,
  createStickyState,
  SNAP_CONFIG,
} from './algorithms'
