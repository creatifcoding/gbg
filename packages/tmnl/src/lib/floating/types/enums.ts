/**
 * Enum schemas — PanelMode, PanelVisibility, directional enums, ResizeEdge.
 *
 * @module floating/types/enums
 */

import { Schema } from 'effect'

export const PanelMode = Schema.Literal('modal', 'floating', 'docked', 'tiled', 'tabbed')
export type PanelMode = typeof PanelMode.Type

export const PanelVisibility = Schema.Literal('visible', 'minimized', 'hidden')
export type PanelVisibility = typeof PanelVisibility.Type

/** Which side a panel was docked to before floating (for re-dock) */
export const FloatOriginSide = Schema.Literal('left', 'right')
export type FloatOriginSide = typeof FloatOriginSide.Type

/** Outer edge targets for dock-to-edge operations */
export const DockEdge = Schema.Literal('left', 'right', 'top', 'bottom')
export type DockEdge = typeof DockEdge.Type

/** Split direction within the binary split tree */
export const SplitDirection = Schema.Literal('horizontal', 'vertical')
export type SplitDirection = typeof SplitDirection.Type

/** Resize Edge (8 handles: 4 edges + 4 corners) */
export const ResizeEdge = Schema.Literal('n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw')
export type ResizeEdge = typeof ResizeEdge.Type
