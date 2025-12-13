/**
 * Drag Orchestrator Types
 *
 * Schema-based types for the centralized drag system.
 * Manages velocity tracking, blur strategy, and multi-element drags.
 *
 * @pattern Effect Schema + stx
 * @module
 */

import { Schema } from 'effect'

// =============================================================================
// Vector & Velocity
// =============================================================================

export const Vector2D = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type Vector2D = typeof Vector2D.Type

export const DragVelocity = Schema.Struct({
  /** Raw velocity vector */
  raw: Vector2D,
  /** Smoothed velocity (EMA) */
  smoothed: Vector2D,
  /** Velocity magnitude (speed) */
  magnitude: Schema.Number,
  /** Velocity angle in radians */
  angle: Schema.Number,
})
export type DragVelocity = typeof DragVelocity.Type

// =============================================================================
// Blur Strategy
// =============================================================================

export const BlurStrategy = Schema.Literal('individual', 'wrapper', 'none')
export type BlurStrategy = typeof BlurStrategy.Type

export const BlurConfig = Schema.Struct({
  /** Maximum blur in pixels */
  maxBlur: Schema.optionalWith(Schema.Number, { default: () => 6 }),
  /** Intensity multiplier */
  intensity: Schema.optionalWith(Schema.Number, { default: () => 0.08 }),
  /** Velocity threshold to activate blur */
  threshold: Schema.optionalWith(Schema.Number, { default: () => 2 }),
  /** Enable directional stretch */
  enableStretch: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Max stretch factor */
  maxStretch: Schema.optionalWith(Schema.Number, { default: () => 1.03 }),
  /** Element count threshold to switch to wrapper blur */
  wrapperThreshold: Schema.optionalWith(Schema.Number, { default: () => 5 }),
})
export type BlurConfig = typeof BlurConfig.Type

// =============================================================================
// Drag Operation
// =============================================================================

export const DragSource = Schema.Literal('selection', 'floating', 'custom')
export type DragSource = typeof DragSource.Type

export const DragOperation = Schema.Struct({
  /** Unique operation ID */
  id: Schema.String,
  /** Source system initiating drag */
  source: DragSource,
  /** Primary dragged element ID */
  primaryId: Schema.String,
  /** All element IDs being dragged (includes group members) */
  elementIds: Schema.Array(Schema.String),
  /** Starting position */
  startPosition: Vector2D,
  /** Current position */
  currentPosition: Vector2D,
  /** Start timestamp */
  startTime: Schema.Number,
})
export type DragOperation = typeof DragOperation.Type

// =============================================================================
// Motion Blur Style Output
// =============================================================================

export interface MotionBlurOutput {
  /** CSS filter property */
  filter: string | undefined
  /** CSS transform for directional stretch */
  transform: string | undefined
  /** CSS transition (disabled during motion) */
  transition: string
  /** Whether blur is currently active */
  isActive: boolean
  /** Current blur amount in pixels */
  blurAmount: number
  /** Current blur strategy being used */
  strategy: BlurStrategy
}

// =============================================================================
// STX Data Shape
// =============================================================================

export interface DragStxData {
  /** Current active drag operation (null if not dragging) */
  activeDrag: DragOperation | null
  /** Current velocity state */
  velocity: DragVelocity
  /** Last position for velocity calculation */
  lastPosition: Vector2D | null
  /** Last timestamp for velocity calculation */
  lastTimestamp: number
  /** Blur configuration */
  blurConfig: BlurConfig
  /** Modifier keys state */
  modifiers: {
    shift: boolean
    ctrl: boolean
    alt: boolean
  }
}

// =============================================================================
// Machine Events
// =============================================================================

export type DragMachineEvent =
  | { type: 'START_DRAG'; operation: DragOperation }
  | { type: 'UPDATE_POSITION'; position: Vector2D }
  | { type: 'ADD_ELEMENTS'; elementIds: string[] }
  | { type: 'REMOVE_ELEMENTS'; elementIds: string[] }
  | { type: 'END_DRAG' }
  | { type: 'CANCEL_DRAG' }

// =============================================================================
// Machine Context
// =============================================================================

export interface DragMachineContext {
  operationId: string | null
}

// =============================================================================
// Hook Return Types
// =============================================================================

export interface UseDragOrchestratorReturn {
  /** Whether a drag is currently active */
  isDragging: boolean
  /** Current drag operation */
  operation: DragOperation | null
  /** Current velocity */
  velocity: DragVelocity
  /** Computed motion blur style */
  blurStyle: MotionBlurOutput
  /** Start a drag operation */
  startDrag: (source: DragSource, primaryId: string, elementIds: string[], position: Vector2D) => void
  /** Update drag position */
  updatePosition: (position: Vector2D) => void
  /** Add elements to current drag (for group expansion) */
  addElements: (elementIds: string[]) => void
  /** End drag operation */
  endDrag: () => void
  /** Cancel drag operation */
  cancelDrag: () => void
  /** Update blur config */
  setBlurConfig: (config: Partial<BlurConfig>) => void
}
