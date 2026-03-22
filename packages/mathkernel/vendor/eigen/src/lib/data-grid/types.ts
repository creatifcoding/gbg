/**
 * Data Grid Types
 *
 * Unified type definitions for the consolidated data-grid system.
 * Schema-backed for runtime validation and encode/decode.
 *
 * @module
 */

import { Schema } from 'effect'

// =============================================================================
// PRIMITIVES
// =============================================================================

/**
 * 2D Point for drag positions.
 */
export const Point = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type Point = typeof Point.Type

/**
 * Grid identifier (branded string).
 */
export const GridId = Schema.String.pipe(Schema.minLength(1), Schema.brand('GridId'))
export type GridId = typeof GridId.Type

/**
 * Cell identifier for flash tracking.
 * Format: `${rowId}:${field}`
 */
export const CellId = Schema.String.pipe(Schema.minLength(1), Schema.brand('CellId'))
export type CellId = typeof CellId.Type

// =============================================================================
// ROW DATA
// =============================================================================

/**
 * Row status options.
 */
export const RowStatus = Schema.Literal('active', 'pending', 'inactive')
export type RowStatus = typeof RowStatus.Type

/**
 * Base row data structure.
 */
export const DataGridRow = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  value: Schema.Number,
  status: RowStatus,
})
export type DataGridRow = typeof DataGridRow.Type

/**
 * Emitter row with CEW properties.
 */
export const EmitterRow = Schema.Struct({
  ...DataGridRow.fields,
  _tag: Schema.Literal('emitter'),
  frequency: Schema.optional(Schema.String),
  power: Schema.optional(Schema.Number),
  intent: Schema.optional(Schema.Literal('cooperative', 'hostile', 'ambient', 'unknown')),
})
export type EmitterRow = typeof EmitterRow.Type

/**
 * Actor row with CEW properties.
 */
export const ActorRow = Schema.Struct({
  ...DataGridRow.fields,
  _tag: Schema.Literal('actor'),
  affiliation: Schema.optional(Schema.Literal('blue', 'red', 'neutral', 'unknown')),
  capabilities: Schema.optional(Schema.Array(Schema.String)),
})
export type ActorRow = typeof ActorRow.Type

/**
 * Asset row for general assets.
 */
export const AssetRow = Schema.Struct({
  ...DataGridRow.fields,
  _tag: Schema.Literal('asset'),
  category: Schema.optional(Schema.String),
  location: Schema.optional(Schema.String),
})
export type AssetRow = typeof AssetRow.Type

/**
 * Event row for event logs.
 */
export const EventRow = Schema.Struct({
  ...DataGridRow.fields,
  _tag: Schema.Literal('event'),
  timestamp: Schema.Number,
  severity: Schema.optional(Schema.Literal('info', 'warn', 'error', 'critical')),
})
export type EventRow = typeof EventRow.Type

/**
 * Union of all tagged row types.
 */
export const GridRow = Schema.Union(EmitterRow, ActorRow, AssetRow, EventRow)
export type GridRow = typeof GridRow.Type

// =============================================================================
// DRAG SYSTEM
// =============================================================================

/**
 * Drag operation phases.
 */
export const DragPhase = Schema.Literal(
  'idle',
  'grid-internal',
  'transitioning',
  'canvas-tracking'
)
export type DragPhase = typeof DragPhase.Type

/**
 * Drag phase enum for imperative code.
 */
export const DragPhaseEnum = {
  Idle: 'idle' as const,
  GridInternal: 'grid-internal' as const,
  Transitioning: 'transitioning' as const,
  CanvasTracking: 'canvas-tracking' as const,
}

/**
 * Current drag operation state.
 */
export const DragState = Schema.Struct({
  phase: DragPhase,
  rowData: Schema.NullOr(GridRow),
  ghostShapeId: Schema.NullOr(Schema.String),
  startPos: Schema.NullOr(Point),
  currentPos: Schema.NullOr(Point),
  gridId: Schema.NullOr(Schema.String),
})
export type DragState = typeof DragState.Type

/**
 * Initial/reset drag state.
 */
export const INITIAL_DRAG_STATE: DragState = {
  phase: 'idle',
  rowData: null,
  ghostShapeId: null,
  startPos: null,
  currentPos: null,
  gridId: null,
}

// =============================================================================
// DRAG EVENTS (Tagged Union)
// =============================================================================

export const GridDragStart = Schema.TaggedStruct('GridDragStart', {
  rowData: GridRow,
  gridId: Schema.String,
  startPos: Point,
})
export type GridDragStart = typeof GridDragStart.Type

export const GridDragMove = Schema.TaggedStruct('GridDragMove', {
  currentPos: Point,
  isInsideGrid: Schema.Boolean,
})
export type GridDragMove = typeof GridDragMove.Type

export const GridExit = Schema.TaggedStruct('GridExit', {
  exitPos: Point,
  rowData: GridRow,
})
export type GridExit = typeof GridExit.Type

export const CanvasEnter = Schema.TaggedStruct('CanvasEnter', {
  canvasPos: Point,
  ghostShapeId: Schema.String,
})
export type CanvasEnter = typeof CanvasEnter.Type

export const CanvasMove = Schema.TaggedStruct('CanvasMove', {
  screenPos: Point,
  canvasPos: Point,
})
export type CanvasMove = typeof CanvasMove.Type

export const Drop = Schema.TaggedStruct('Drop', {
  canvasPos: Point,
  rowData: GridRow,
})
export type Drop = typeof Drop.Type

export const Cancel = Schema.TaggedStruct('Cancel', {
  reason: Schema.String,
})
export type Cancel = typeof Cancel.Type

/**
 * Union of all drag events.
 */
export const GridDragEvent = Schema.Union(
  GridDragStart,
  GridDragMove,
  GridExit,
  CanvasEnter,
  CanvasMove,
  Drop,
  Cancel
)
export type GridDragEvent = typeof GridDragEvent.Type

// =============================================================================
// FLASH SYSTEM
// =============================================================================

/**
 * Flash severity levels.
 */
export const FlashSeverity = Schema.Literal('none', 'low', 'medium', 'high', 'critical')
export type FlashSeverity = typeof FlashSeverity.Type

/**
 * Flash direction based on delta.
 */
export const FlashDirection = Schema.Literal('up', 'down', 'neutral')
export type FlashDirection = typeof FlashDirection.Type

/**
 * Flash state for a single cell.
 */
export const FlashState = Schema.Struct({
  /** Cell identifier (rowId:field) */
  cellId: CellId,
  /** Severity level based on delta magnitude */
  severity: FlashSeverity,
  /** Intensity 0-1 for visual effects */
  intensity: Schema.Number,
  /** Direction: up (positive), down (negative), or neutral */
  direction: FlashDirection,
  /** Raw delta value */
  delta: Schema.Number,
  /** Timestamp when flash was triggered */
  timestamp: Schema.Number,
  /** TTL in milliseconds */
  ttl: Schema.Number,
  /** Whether flash is currently active */
  isActive: Schema.Boolean,
})
export type FlashState = typeof FlashState.Type

// =============================================================================
// GRID CONFIGURATION (Legacy compat)
// =============================================================================

/**
 * Grid theme configuration.
 * @deprecated Use GridVariant from schemas/variant.ts instead
 */
export interface GridThemeConfig {
  readonly colors: {
    readonly background: string
    readonly border: string
    readonly text: string
    readonly textMuted: string
    readonly accent: string
    readonly statusActive: string
    readonly statusPending: string
    readonly statusInactive: string
  }
  readonly typography: {
    readonly fontFamily: string
    readonly fontSize: number
    readonly fontSizeXs: number
    readonly fontSizeSm: number
    readonly fontSizeLg: number
  }
  readonly spacing: {
    readonly rowHeight: number
    readonly headerHeight: number
    readonly cellPadding: number
  }
}

/**
 * Grid behavior configuration.
 * @deprecated Use GridVariant.behavior from schemas/variant.ts instead
 */
export interface GridBehaviorConfig {
  readonly enableDrag: boolean
  readonly enableExternalDrop: boolean
  readonly enableReorder: boolean
  readonly enableEdit: boolean
  readonly enableSort: boolean
  readonly enableResize: boolean
}

/**
 * Complete grid configuration.
 * @deprecated Use GridVariant from schemas/variant.ts instead
 */
export interface GridConfig {
  readonly id: string
  readonly title: string
  readonly theme: GridThemeConfig
  readonly behavior: GridBehaviorConfig
}

// =============================================================================
// CALLBACKS
// =============================================================================

/** Callback when row drag starts */
export type OnDragStart = (event: GridDragStart) => void

/** Callback when drag exits grid bounds */
export type OnGridExit = (event: GridExit) => void

/** Callback when drop completes */
export type OnDrop = (event: Drop) => void

/** Callback when drag is cancelled */
export type OnCancel = (event: Cancel) => void

/** All drag callbacks */
export interface DragCallbacks {
  readonly onDragStart?: OnDragStart
  readonly onGridExit?: OnGridExit
  readonly onDrop?: OnDrop
  readonly onCancel?: OnCancel
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Create a CellId from row ID and field name.
 */
export const makeCellId = (rowId: string, field: string): CellId =>
  `${rowId}:${field}` as CellId

/**
 * Parse a CellId into row ID and field.
 */
export const parseCellId = (cellId: CellId): { rowId: string; field: string } => {
  const [rowId, field] = cellId.split(':')
  return { rowId, field }
}
