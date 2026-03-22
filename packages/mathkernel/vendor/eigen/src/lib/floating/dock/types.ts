/**
 * Dock Zone Types
 *
 * Types and constants for edge/corner docking behavior.
 *
 * @module
 */

export type DockZone =
  | 'Left'
  | 'Right'
  | 'Top'
  | 'Bottom'
  | 'Top Left'
  | 'Top Right'
  | 'Bottom Left'
  | 'Bottom Right'

/** Distance in px from viewport edge to trigger dock zone detection */
export const DOCK_THRESHOLD = 24
