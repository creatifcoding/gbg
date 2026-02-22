/**
 * Position utility types.
 *
 * @module floating/utils/position/types
 */

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

export interface MagneticSnapOptions {
  readonly threshold?: number
  readonly includeViewportCenter?: boolean
  readonly includePanelAlign?: boolean
}

/** Default cascade offset (px) */
export const CASCADE_OFFSET = 30

/** Minimum gap between panel edge and viewport edge */
export const VIEWPORT_PADDING = 16

/** Overlap tolerance — panels closer than this are "overlapping" */
export const OVERLAP_THRESHOLD = 20
