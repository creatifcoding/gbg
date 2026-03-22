/**
 * Floating panel types — re-export barrel.
 *
 * @module floating/types
 */

export { Position, Dimensions, DimensionConstraints } from './geometry'
export { PanelMode, PanelVisibility, FloatOriginSide, DockEdge, SplitDirection, ResizeEdge } from './enums'
export {
  PanelState,
  PanelConfig,
  PersistedPanelState,
  PanelStorage,
  ModifierKeys,
  type FloatingStxData,
  type PanelMachineContext,
  type PanelMachineEvent,
  type UseFloatingPanelReturn,
  type UseResizeReturn,
  type UseFloatingDimensionsReturn,
} from './state'

// ── Strip (Niri flat column model) ─────────────────────────────────────────
export {
  ColumnWidth,
  WIDTH_PRESETS,
  PRESET_CYCLE,
  Column,
  Strip,
  StateTier,
  getColumnPanelId,
  getColumnPanelIds,
  getAllStripPanelIds,
  singleColumn,
  treeColumn,
  emptyStrip,
} from './strip'
