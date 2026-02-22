/**
 * Snap edge generation — viewport and sibling panel edges.
 *
 * @module floating/utils/snap-engine/edges
 */

import { type SnapEdge, type SnapRect, type SnapConfig, DEFAULT_SNAP_CONFIG } from './types'

const VIEWPORT_PADDING = 8

/** Viewport snap edges — 4 borders + center cross */
export function viewportEdges(viewport: SnapRect): SnapEdge[] {
  return [
    { direction: 'vertical', position: viewport.x + VIEWPORT_PADDING, source: 'left', label: 'vp-left' },
    { direction: 'vertical', position: viewport.x + viewport.width - VIEWPORT_PADDING, source: 'right', label: 'vp-right' },
    { direction: 'vertical', position: viewport.x + viewport.width / 2, source: 'center-x', label: 'vp-center-x' },
    { direction: 'horizontal', position: viewport.y + VIEWPORT_PADDING, source: 'top', label: 'vp-top' },
    { direction: 'horizontal', position: viewport.y + viewport.height - VIEWPORT_PADDING, source: 'bottom', label: 'vp-bottom' },
    { direction: 'horizontal', position: viewport.y + viewport.height / 2, source: 'center-y', label: 'vp-center-y' },
  ]
}

/** Sibling panel edges — 4 outer edges */
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
