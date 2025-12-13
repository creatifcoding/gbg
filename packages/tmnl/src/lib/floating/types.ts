/**
 * Floating Panel System Types (Schema-based)
 *
 * Effect Schema types for draggable, resizable floating panels.
 * Replaces raw interfaces with runtime-validated schemas.
 *
 * @pattern Effect Schema + stx integration
 * @module
 */

import { Schema } from 'effect'

// =============================================================================
// Position & Dimensions (Schema)
// =============================================================================

export const Position = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type Position = typeof Position.Type

export const Dimensions = Schema.Struct({
  width: Schema.Number,
  height: Schema.Number,
})
export type Dimensions = typeof Dimensions.Type

export const DimensionConstraints = Schema.Struct({
  minWidth: Schema.optionalWith(Schema.Number, { default: () => 200 }),
  minHeight: Schema.optionalWith(Schema.Number, { default: () => 150 }),
  maxWidth: Schema.optional(Schema.Number),
  maxHeight: Schema.optional(Schema.Number),
})
export type DimensionConstraints = typeof DimensionConstraints.Type

// =============================================================================
// Panel Mode & Visibility
// =============================================================================

export const PanelMode = Schema.Literal('modal', 'floating', 'docked')
export type PanelMode = typeof PanelMode.Type

export const PanelVisibility = Schema.Literal('visible', 'minimized', 'hidden')
export type PanelVisibility = typeof PanelVisibility.Type

// =============================================================================
// Resize Edge (8 handles: 4 edges + 4 corners)
// =============================================================================

export const ResizeEdge = Schema.Literal('n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw')
export type ResizeEdge = typeof ResizeEdge.Type

// =============================================================================
// Panel State (Schema)
// =============================================================================

export const PanelState = Schema.Struct({
  /** Unique panel identifier */
  id: Schema.String,
  /** Display title for panel chrome */
  title: Schema.String,
  /** Current mode */
  mode: PanelMode,
  /** Current position */
  position: Position,
  /** Current dimensions */
  dimensions: Dimensions,
  /** Dimension constraints */
  constraints: DimensionConstraints,
  /** Z-index within floating layer */
  zIndex: Schema.Number,
  /** Visibility state */
  visibility: PanelVisibility,
  /** Whether panel is currently being dragged */
  isDragging: Schema.Boolean,
  /** Whether panel is currently being resized */
  isResizing: Schema.Boolean,
  /** Whether panel is maximized (fullscreen) */
  isMaximized: Schema.Boolean,
  /** Pre-maximize position (for restore) */
  preMaximizePosition: Schema.optional(Position),
  /** Pre-maximize dimensions (for restore) */
  preMaximizeDimensions: Schema.optional(Dimensions),
  /** Whether panel can be closed */
  closable: Schema.Boolean,
  /** Whether panel can be minimized */
  minimizable: Schema.Boolean,
  /** Whether panel can be resized */
  resizable: Schema.Boolean,
  /** Visitor ID for modal/floating content */
  visitorId: Schema.optional(Schema.String),
  /** Visitor data (serialized) */
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
  closable: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  minimizable: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  resizable: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  visitorId: Schema.optional(Schema.String),
  visitorData: Schema.optional(Schema.Unknown),
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
})
export type PersistedPanelState = typeof PersistedPanelState.Type

export const PanelStorage = Schema.Struct({
  panels: Schema.Record({ key: Schema.String, value: PersistedPanelState }),
  order: Schema.Array(Schema.String),
  version: Schema.optionalWith(Schema.Number, { default: () => 1 }),
})
export type PanelStorage = typeof PanelStorage.Type

// =============================================================================
// Modifier Keys (for resize precision)
// =============================================================================

export const ModifierKeys = Schema.Struct({
  shift: Schema.Boolean,
  ctrl: Schema.Boolean,
  alt: Schema.Boolean,
})
export type ModifierKeys = typeof ModifierKeys.Type

// =============================================================================
// Velocity State (for motion blur)
// =============================================================================

export const DragVelocity = Schema.Struct({
  /** Current velocity vector (px/frame) */
  x: Schema.Number,
  y: Schema.Number,
  /** Smoothed velocity (EMA) for stable blur */
  smoothedX: Schema.Number,
  smoothedY: Schema.Number,
  /** Velocity magnitude */
  magnitude: Schema.Number,
  /** Velocity angle in radians */
  angle: Schema.Number,
})
export type DragVelocity = typeof DragVelocity.Type

// =============================================================================
// STX Data Shape
// =============================================================================

/** Legend-State data shape for floating-stx */
export interface FloatingStxData {
  /** All registered panels */
  panels: Map<string, PanelState>
  /** Panel order for z-index (last = top) */
  zOrder: string[]
  /** Currently active panel ID */
  activePanel: string | null
  /** Currently resizing panel ID */
  resizingPanel: string | null
  /** Currently dragging panel ID */
  draggingPanel: string | null
  /** Modifier key state for precision control */
  modifierKeys: ModifierKeys
  /** Base z-index for floating layer */
  baseZIndex: number
  /** Drag velocity for motion blur */
  dragVelocity: DragVelocity
  /** Last drag position for velocity calculation */
  lastDragPosition: Position | null
  /** Last drag timestamp */
  lastDragTimestamp: number
}

// =============================================================================
// Machine Context
// =============================================================================

export interface PanelMachineContext {
  targetPanel: string | null
  dragStart: Position | null
  resizeStart: Dimensions | null
  resizeEdge: ResizeEdge | null
}

// =============================================================================
// Machine Events
// =============================================================================

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
  /** All panels as array (sorted by z-index) */
  panels: PanelState[]
  /** Currently active panel ID */
  activePanelId: string | null
  /** Register a new panel */
  registerPanel: (config: PanelConfig) => void
  /** Unregister a panel */
  unregisterPanel: (id: string) => void
  /** Update panel position */
  updatePosition: (id: string, position: Position) => void
  /** Update panel dimensions */
  updateDimensions: (id: string, dimensions: Dimensions) => void
  /** Bring panel to front */
  bringToFront: (id: string) => void
  /** Send panel to back */
  sendToBack: (id: string) => void
  /** Close panel */
  closePanel: (id: string) => void
  /** Toggle float/dock mode */
  toggleMode: (id: string) => void
  /** Get resize sensitivity based on modifier keys */
  resizeSensitivity: number
}

export interface UseResizeReturn {
  /** Start resize operation */
  startResize: (edge: ResizeEdge) => void
  /** Whether currently resizing */
  isResizing: boolean
  /** Current resize edge */
  resizeEdge: ResizeEdge | null
  /** Handle pointer move during resize */
  handlePointerMove: (e: PointerEvent) => void
  /** Handle pointer up to end resize */
  handlePointerUp: () => void
}

export interface UseFloatingDimensionsReturn {
  /** Current width */
  width: number
  /** Current height */
  height: number
  /** Whether panel is being resized */
  isResizing: boolean
  /** Layout hint based on dimensions */
  layout: 'compact' | 'normal' | 'wide'
}
