/**
 * Motion Tracker
 *
 * Tracks drag velocity for direction-aware motion blur.
 * Uses exponential moving average (EMA) for smooth velocity.
 *
 * @pattern Pure functions + mutable state tracker
 * @module
 */

import type {
  Vector2D,
  VelocityState,
  MotionBlurConfig,
  MotionBlurStyle,
  MotionTracker,
} from './types'

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_CONFIG: Required<MotionBlurConfig> = {
  intensity: 0.08,
  maxBlur: 6,
  smoothingFactor: 0.3,
  threshold: 2,
  enableStretch: true,
  maxStretch: 1.03,
}

const INITIAL_STATE: VelocityState = {
  velocity: { x: 0, y: 0 },
  smoothedVelocity: { x: 0, y: 0 },
  lastPosition: { x: 0, y: 0 },
  lastTimestamp: 0,
  isDragging: false,
}

// =============================================================================
// Vector Math Utilities
// =============================================================================

/**
 * Calculate vector magnitude
 */
export function vectorMagnitude(v: Vector2D): number {
  return Math.sqrt(v.x ** 2 + v.y ** 2)
}

/**
 * Calculate vector angle in radians
 */
export function vectorAngle(v: Vector2D): number {
  return Math.atan2(v.y, v.x)
}

/**
 * Normalize vector to unit length
 */
export function normalizeVector(v: Vector2D): Vector2D {
  const mag = vectorMagnitude(v)
  if (mag === 0) return { x: 0, y: 0 }
  return { x: v.x / mag, y: v.y / mag }
}

/**
 * Exponential moving average for smoothing
 */
export function ema(current: number, previous: number, factor: number): number {
  return factor * current + (1 - factor) * previous
}

// =============================================================================
// Motion Blur Style Computation
// =============================================================================

/**
 * Compute motion blur CSS style from velocity state
 */
export function computeMotionBlurStyle(
  state: VelocityState,
  config: Required<MotionBlurConfig>
): MotionBlurStyle {
  const velocity = state.smoothedVelocity
  const magnitude = vectorMagnitude(velocity)
  const angle = vectorAngle(velocity)

  // Check if velocity exceeds threshold
  const isActive = state.isDragging && magnitude > config.threshold

  if (!isActive) {
    return {
      filter: undefined,
      transform: undefined,
      transition: 'filter 0.15s ease-out, transform 0.15s ease-out',
      isActive: false,
      blurAmount: 0,
      velocityMagnitude: magnitude,
      velocityAngle: angle,
    }
  }

  // Calculate blur amount (clamped)
  const blurAmount = Math.min(magnitude * config.intensity, config.maxBlur)

  // Calculate directional stretch
  let stretchTransform: string | undefined = undefined
  if (config.enableStretch && magnitude > config.threshold * 2) {
    // Stretch in direction of motion
    const stretchFactor = Math.min(
      1 + (magnitude * 0.001),
      config.maxStretch
    )
    const angleDeg = (angle * 180) / Math.PI

    // Apply directional scale via rotation → scale → rotation back
    // This creates a "smear" effect in the direction of motion
    stretchTransform = [
      `rotate(${angleDeg}deg)`,
      `scaleX(${stretchFactor})`,
      `rotate(${-angleDeg}deg)`,
    ].join(' ')
  }

  return {
    filter: blurAmount > 0.5 ? `blur(${blurAmount.toFixed(1)}px)` : undefined,
    transform: stretchTransform,
    transition: 'none', // Disable transition during active motion
    isActive: true,
    blurAmount,
    velocityMagnitude: magnitude,
    velocityAngle: angle,
  }
}

// =============================================================================
// Motion Tracker Factory
// =============================================================================

/**
 * Create a motion tracker instance
 *
 * @example
 * ```ts
 * const tracker = createMotionTracker()
 *
 * // On drag start
 * tracker.startTracking(e.clientX, e.clientY)
 *
 * // On drag move
 * tracker.updatePosition(e.clientX, e.clientY)
 * const style = tracker.getBlurStyle()
 *
 * // On drag end
 * tracker.stopTracking()
 * ```
 */
export function createMotionTracker(): MotionTracker {
  let state: VelocityState = { ...INITIAL_STATE }

  const updatePosition = (x: number, y: number): void => {
    const now = performance.now()
    const dt = now - state.lastTimestamp

    // Avoid division by zero and skip if too fast (< 1ms)
    if (dt < 1) return

    // Calculate instantaneous velocity
    const velocity: Vector2D = {
      x: (x - state.lastPosition.x) / (dt / 16.67), // Normalize to ~60fps
      y: (y - state.lastPosition.y) / (dt / 16.67),
    }

    // Apply EMA smoothing
    const smoothedVelocity: Vector2D = {
      x: ema(velocity.x, state.smoothedVelocity.x, DEFAULT_CONFIG.smoothingFactor),
      y: ema(velocity.y, state.smoothedVelocity.y, DEFAULT_CONFIG.smoothingFactor),
    }

    state = {
      ...state,
      velocity,
      smoothedVelocity,
      lastPosition: { x, y },
      lastTimestamp: now,
    }
  }

  const startTracking = (x: number, y: number): void => {
    state = {
      velocity: { x: 0, y: 0 },
      smoothedVelocity: { x: 0, y: 0 },
      lastPosition: { x, y },
      lastTimestamp: performance.now(),
      isDragging: true,
    }
  }

  const stopTracking = (): void => {
    state = {
      ...state,
      isDragging: false,
      velocity: { x: 0, y: 0 },
      smoothedVelocity: { x: 0, y: 0 },
    }
  }

  const getState = (): VelocityState => ({ ...state })

  const getBlurStyle = (config?: Partial<MotionBlurConfig>): MotionBlurStyle => {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config }
    return computeMotionBlurStyle(state, mergedConfig)
  }

  const reset = (): void => {
    state = { ...INITIAL_STATE }
  }

  return {
    updatePosition,
    startTracking,
    stopTracking,
    getState,
    getBlurStyle,
    reset,
  }
}

// =============================================================================
// Singleton Tracker Registry
// =============================================================================

const trackerRegistry = new Map<string, MotionTracker>()

/**
 * Get or create a motion tracker by ID
 * Useful for tracking multiple draggable elements
 */
export function getMotionTracker(id: string): MotionTracker {
  let tracker = trackerRegistry.get(id)
  if (!tracker) {
    tracker = createMotionTracker()
    trackerRegistry.set(id, tracker)
  }
  return tracker
}

/**
 * Remove a motion tracker by ID
 */
export function removeMotionTracker(id: string): void {
  trackerRegistry.delete(id)
}

/**
 * Clear all motion trackers
 */
export function clearMotionTrackers(): void {
  trackerRegistry.clear()
}
