/**
 * State types — PanelState, PanelConfig, persistence, machine, hook returns.
 *
 * @module floating/types/state
 */

import { Schema } from 'effect'
import { Position, Dimensions, DimensionConstraints } from './geometry'
import { PanelMode, PanelVisibility, FloatOriginSide, ResizeEdge } from './enums'
import { ColumnWidth } from './strip'

// =============================================================================
// Panel State (Schema)
// =============================================================================

export const PanelState = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  mode: PanelMode,
  position: Position,
  dimensions: Dimensions,
  constraints: DimensionConstraints,
  zIndex: Schema.Number,
  visibility: PanelVisibility,
  isDragging: Schema.Boolean,
  isResizing: Schema.Boolean,
  isMaximized: Schema.Boolean,
  preMaximizePosition: Schema.optional(Position),
  preMaximizeDimensions: Schema.optional(Dimensions),
  preMinimizePosition: Schema.optional(Position),
  preMinimizeDimensions: Schema.optional(Dimensions),
  tiledWidth: Schema.optional(Schema.Number),
  isCollapsed: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  floatOriginSide: Schema.optional(FloatOriginSide),
  /** Strip column index where this panel was detached from (for pop-back docking). */
  stripOriginIndex: Schema.optional(Schema.Number),
  /** Strip width preset captured at detach time. */
  stripOriginWidth: Schema.optional(ColumnWidth),
  /** Explicit strip width fraction captured at detach time (0..1). */
  stripOriginWidthPct: Schema.optional(Schema.Number),
  /** Epoch ms when panel was reattached into strip (for pop-back animation). */
  stripLastReattachAt: Schema.optional(Schema.Number),
  accent: Schema.optional(Schema.String),
  headerHidden: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  /** Panel IDs hosted as tabs inside this panel */
  tabs: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] as string[] }),
  /** Which tab is active — this panel's own ID = home, or a hosted panel's ID */
  activeTabId: Schema.optional(Schema.String),
  /** If this panel is tabbed inside another, the host panel's ID */
  hostPanelId: Schema.optional(Schema.String),
  autoSize: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  closable: Schema.Boolean,
  minimizable: Schema.Boolean,
  resizable: Schema.Boolean,
  visitorId: Schema.optional(Schema.String),
  visitorData: Schema.optional(Schema.Unknown),
})
export type PanelState = typeof PanelState.Type

// =============================================================================
// Panel Configuration (for registration)
// =============================================================================

export const PanelConfig = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  mode: Schema.optionalWith(PanelMode, { default: () => 'floating' as const }),
  initialPosition: Schema.optional(Position),
  initialDimensions: Schema.optional(Dimensions),
  constraints: Schema.optional(DimensionConstraints),
  autoSize: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  closable: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  minimizable: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  resizable: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  visitorId: Schema.optional(Schema.String),
  visitorData: Schema.optional(Schema.Unknown),
  tiledWidth: Schema.optional(Schema.Number),
  accent: Schema.optional(Schema.String),
  headerHidden: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type PanelConfig = typeof PanelConfig.Type

// =============================================================================
// Persistence (for localStorage)
// =============================================================================

export const PersistedPanelState = Schema.Struct({
  position: Position,
  dimensions: Dimensions,
  visibility: PanelVisibility,
  mode: PanelMode,
  tiledWidth: Schema.optional(Schema.Number),
  isCollapsed: Schema.optional(Schema.Boolean),
  floatOriginSide: Schema.optional(FloatOriginSide),
  accent: Schema.optional(Schema.String),
  headerHidden: Schema.optional(Schema.Boolean),
})
export type PersistedPanelState = typeof PersistedPanelState.Type

export const PanelStorage = Schema.Struct({
  panels: Schema.Record({ key: Schema.String, value: PersistedPanelState }),
  order: Schema.Array(Schema.String),
  version: Schema.optionalWith(Schema.Number, { default: () => 1 }),
})
export type PanelStorage = typeof PanelStorage.Type

// =============================================================================
// Modifier Keys
// =============================================================================

export const ModifierKeys = Schema.Struct({
  shift: Schema.Boolean,
  ctrl: Schema.Boolean,
  alt: Schema.Boolean,
})
export type ModifierKeys = typeof ModifierKeys.Type

// =============================================================================
// STX Data Shape
// =============================================================================

export interface FloatingStxData {
  panels: Map<string, PanelState>
  zOrder: string[]
  activePanel: string | null
  resizingPanel: string | null
  draggingPanel: string | null
  modifierKeys: ModifierKeys
  baseZIndex: number
  gridSize: number
  snapEnabled: boolean
  panelTree: import('../layout/split-tree').SplitNode | null
  focusDirection: 'left' | 'right' | 'up' | 'down' | null
  /** Niri-style flat strip model (parallel to panelTree during migration) */
  strip: import('./strip').Strip
}

// =============================================================================
// Machine Context & Events
// =============================================================================

export interface PanelMachineContext {
  targetPanel: string | null
  dragStart: Position | null
  resizeStart: Dimensions | null
  resizeEdge: ResizeEdge | null
}

export type PanelMachineEvent =
  | { type: 'OPEN_PANEL'; panelId: string; config?: PanelConfig }
  | { type: 'CLOSE_PANEL'; panelId: string }
  | { type: 'START_DRAG'; panelId: string; position: Position }
  | { type: 'END_DRAG' }
  | { type: 'UPDATE_DRAG'; position: Position }
  | { type: 'START_RESIZE'; panelId: string; edge: ResizeEdge; dimensions: Dimensions }
  | { type: 'END_RESIZE' }
  | { type: 'UPDATE_RESIZE'; dimensions: Dimensions }
  | { type: 'DOCK_PANEL'; panelId: string }
  | { type: 'UNDOCK_PANEL'; panelId: string }
  | { type: 'BRING_TO_FRONT'; panelId: string }
  | { type: 'SEND_TO_BACK'; panelId: string }
  | { type: 'SET_VISIBILITY'; panelId: string; visibility: PanelVisibility }
  | { type: 'TOGGLE_MODE'; panelId: string }

// =============================================================================
// Hook Return Types
// =============================================================================

export interface UseFloatingPanelReturn {
  panels: PanelState[]
  activePanelId: string | null
  registerPanel: (config: PanelConfig) => void
  unregisterPanel: (id: string) => void
  updatePosition: (id: string, position: Position) => void
  updateDimensions: (id: string, dimensions: Dimensions) => void
  bringToFront: (id: string) => void
  sendToBack: (id: string) => void
  closePanel: (id: string) => void
  toggleMode: (id: string) => void
  resizeSensitivity: number
}

export interface UseResizeReturn {
  startResize: (edge: ResizeEdge) => void
  isResizing: boolean
  resizeEdge: ResizeEdge | null
  handlePointerMove: (e: PointerEvent) => void
  handlePointerUp: () => void
}

export interface UseFloatingDimensionsReturn {
  width: number
  height: number
  isResizing: boolean
  layout: 'compact' | 'normal' | 'wide'
}
