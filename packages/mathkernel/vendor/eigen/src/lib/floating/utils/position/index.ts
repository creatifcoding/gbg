/**
 * Position utilities — re-export barrel.
 *
 * @module floating/utils/position
 */

export { type Viewport, type PanelRect, type MagneticSnapOptions, CASCADE_OFFSET, VIEWPORT_PADDING, OVERLAP_THRESHOLD } from './types'
export { cascadePosition, findOpenSlot, staggerOffset } from './placement'
export { snapToGrid, clampToViewport, applyMagneticSnap, snapScalar, rectsOverlap } from './constraints'
