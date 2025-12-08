/**
 * Data Grid Types
 *
 * Core type definitions for the modular data-grid system.
 * Designed to work both on and off the tldraw canvas.
 */

// =============================================================================
// ROW DATA TYPES
// =============================================================================

/** Base row data structure */
export interface DataGridRow {
  id: string
  name: string
  value: number
  status: 'active' | 'pending' | 'inactive'
}

/** Extended row data with CEW emitter properties */
export interface EmitterRow extends DataGridRow {
  type: 'emitter'
  frequency?: string
  power?: number
  intent?: 'cooperative' | 'hostile' | 'ambient' | 'unknown'
}

/** Extended row data with CEW actor properties */
export interface ActorRow extends DataGridRow {
  type: 'actor'
  affiliation?: 'blue' | 'red' | 'neutral' | 'unknown'
  capabilities?: string[]
}

/** Union of all row types */
export type GridRow = DataGridRow | EmitterRow | ActorRow

// =============================================================================
// DRAG PHASE & EVENTS
// =============================================================================

/** Drag operation phases */
export const DragPhase = {
  Idle: 'idle',
  GridInternal: 'grid-internal',
  Transitioning: 'transitioning',
  CanvasTracking: 'canvas-tracking',
} as const

export type DragPhase = typeof DragPhase[keyof typeof DragPhase]

/** 2D point */
export interface Point {
  readonly x: number
  readonly y: number
}

/** Discriminated union for all drag events */
export type GridDragEvent =
  | { readonly _tag: 'GridDragStart'; readonly rowData: GridRow; readonly gridId: string; readonly startPos: Point }
  | { readonly _tag: 'GridDragMove'; readonly currentPos: Point; readonly isInsideGrid: boolean }
  | { readonly _tag: 'GridExit'; readonly exitPos: Point; readonly rowData: GridRow }
  | { readonly _tag: 'CanvasEnter'; readonly canvasPos: Point; readonly ghostShapeId: string }
  | { readonly _tag: 'CanvasMove'; readonly screenPos: Point; readonly canvasPos: Point }
  | { readonly _tag: 'Drop'; readonly canvasPos: Point; readonly rowData: GridRow }
  | { readonly _tag: 'Cancel'; readonly reason: string }

// =============================================================================
// DRAG STATE
// =============================================================================

/** Current drag operation state */
export interface DragState {
  readonly phase: DragPhase
  readonly rowData: GridRow | null
  readonly ghostShapeId: string | null
  readonly startPos: Point | null
  readonly currentPos: Point | null
  readonly gridId: string | null
}

/** Initial/reset drag state */
export const INITIAL_DRAG_STATE: DragState = {
  phase: DragPhase.Idle,
  rowData: null,
  ghostShapeId: null,
  startPos: null,
  currentPos: null,
  gridId: null,
}

// =============================================================================
// GRID CONFIGURATION
// =============================================================================

/** Grid appearance configuration */
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

/** Grid behavior configuration */
export interface GridBehaviorConfig {
  readonly enableDrag: boolean
  readonly enableExternalDrop: boolean
  readonly enableReorder: boolean
  readonly enableEdit: boolean
  readonly enableSort: boolean
  readonly enableResize: boolean
}

/** Complete grid configuration */
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
export type OnDragStart = (event: Extract<GridDragEvent, { _tag: 'GridDragStart' }>) => void

/** Callback when drag exits grid bounds */
export type OnGridExit = (event: Extract<GridDragEvent, { _tag: 'GridExit' }>) => void

/** Callback when drop completes */
export type OnDrop = (event: Extract<GridDragEvent, { _tag: 'Drop' }>) => void

/** Callback when drag is cancelled */
export type OnCancel = (event: Extract<GridDragEvent, { _tag: 'Cancel' }>) => void

/** All drag callbacks */
export interface DragCallbacks {
  readonly onDragStart?: OnDragStart
  readonly onGridExit?: OnGridExit
  readonly onDrop?: OnDrop
  readonly onCancel?: OnCancel
}
