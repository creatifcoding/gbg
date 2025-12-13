/**
 * Motion Blur Types
 *
 * Schema-based types for direction-aware motion blur system.
 * Tracks velocity vectors for blur intensity and direction.
 *
 * @pattern Effect Schema
 * @module
 */

import { Schema } from 'effect'

// =============================================================================
// Vector Types
// =============================================================================

export const Vector2D = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type Vector2D = typeof Vector2D.Type

// =============================================================================
// Velocity State
// =============================================================================

export const VelocityState = Schema.Struct({
  /** Current velocity vector (px/frame) */
  velocity: Vector2D,
  /** Smoothed velocity (EMA) for stable blur */
  smoothedVelocity: Vector2D,
  /** Last position for delta calculation */
  lastPosition: Vector2D,
  /** Timestamp of last update */
  lastTimestamp: Schema.Number,
  /** Whether actively dragging */
  isDragging: Schema.Boolean,
})
export type VelocityState = typeof VelocityState.Type

// =============================================================================
// Motion Blur Configuration
// =============================================================================

export const MotionBlurConfig = Schema.Struct({
  /** Blur intensity multiplier (default: 0.08) */
  intensity: Schema.optionalWith(Schema.Number, { default: () => 0.08 }),
  /** Maximum blur in pixels (default: 6) */
  maxBlur: Schema.optionalWith(Schema.Number, { default: () => 6 }),
  /** Velocity smoothing factor 0-1 (default: 0.3, lower = smoother) */
  smoothingFactor: Schema.optionalWith(Schema.Number, { default: () => 0.3 }),
  /** Minimum velocity threshold to apply blur (default: 2) */
  threshold: Schema.optionalWith(Schema.Number, { default: () => 2 }),
  /** Enable directional stretch effect (default: true) */
  enableStretch: Schema.optionalWith(Schema.Boolean, { default: () => true }),
  /** Maximum stretch factor (default: 1.03) */
  maxStretch: Schema.optionalWith(Schema.Number, { default: () => 1.03 }),
})
export type MotionBlurConfig = typeof MotionBlurConfig.Type

// =============================================================================
// Motion Blur Style Output
// =============================================================================

export interface MotionBlurStyle {
  /** CSS filter property (blur) */
  filter: string | undefined
  /** CSS transform for directional stretch */
  transform: string | undefined
  /** CSS transition (disabled during motion) */
  transition: string | undefined
  /** Whether blur is active */
  isActive: boolean
  /** Blur amount in pixels */
  blurAmount: number
  /** Velocity magnitude */
  velocityMagnitude: number
  /** Velocity angle in radians */
  velocityAngle: number
}

// =============================================================================
// Motion Tracker Interface
// =============================================================================

export interface MotionTracker {
  /** Update position and recalculate velocity */
  updatePosition: (x: number, y: number) => void
  /** Start tracking (on drag start) */
  startTracking: (x: number, y: number) => void
  /** Stop tracking (on drag end) */
  stopTracking: () => void
  /** Get current velocity state */
  getState: () => VelocityState
  /** Get computed motion blur style */
  getBlurStyle: (config?: Partial<MotionBlurConfig>) => MotionBlurStyle
  /** Reset state */
  reset: () => void
}

// =============================================================================
// Hook Return Type
// =============================================================================

export interface UseMotionBlurReturn {
  /** Motion blur CSS styles to spread on element */
  style: MotionBlurStyle
  /** Start tracking motion */
  startTracking: (x: number, y: number) => void
  /** Update position during drag */
  updatePosition: (x: number, y: number) => void
  /** Stop tracking motion */
  stopTracking: () => void
  /** Current velocity state */
  velocityState: VelocityState
  /** Whether currently tracking */
  isTracking: boolean
}
