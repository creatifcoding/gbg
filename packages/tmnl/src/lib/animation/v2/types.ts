/**
 * Animation Library v2 - Core Types
 *
 * Pure type definitions with no dependencies.
 * These form the foundation for XState machines and effect-atom integration.
 */

// =============================================================================
// VALUE TYPES
// =============================================================================

/** Numeric value (most common) */
export type NumericValue = number

/** Vector value (x, y, etc.) */
export type VectorValue = readonly number[]

/** Object with numeric properties */
export type ObjectValue = Readonly<Record<string, number>>

/** Color as hex string */
export type ColorValue = `#${string}`

/** Union of all animatable value types */
export type AnimationValue = NumericValue | VectorValue | ObjectValue | ColorValue

// =============================================================================
// STATE MACHINE TYPES
// =============================================================================

/** Animation lifecycle states */
export type AnimationState = 'idle' | 'running' | 'paused' | 'completed'

/** Events that can be sent to the animation machine */
export type AnimationEvent<T extends AnimationValue = AnimationValue> =
  | { readonly type: 'START'; readonly to: T; readonly duration?: number; readonly ease?: string }
  | { readonly type: 'PAUSE' }
  | { readonly type: 'RESUME' }
  | { readonly type: 'COMPLETE' }
  | { readonly type: 'CANCEL' }
  | { readonly type: 'SNAP'; readonly value: T }
  | { readonly type: 'TICK'; readonly value: T; readonly progress: number }

/** Context stored by the animation machine */
export interface AnimationContext<T extends AnimationValue = AnimationValue> {
  /** Current interpolated value */
  readonly current: T
  /** Target value we're animating toward */
  readonly target: T
  /** Starting value of this animation */
  readonly from: T
  /** Animation progress 0-1 */
  readonly progress: number
  /** Duration in milliseconds */
  readonly duration: number
  /** Easing function name or custom function */
  readonly ease: string | ((t: number) => number)
  /** Timestamp when animation started */
  readonly startTime: number | null
  /** Cancel function for current animation */
  readonly cancel: (() => void) | null
}

// =============================================================================
// CONFIGURATION TYPES
// =============================================================================

/** Options for creating an animation */
export interface AnimationOptions {
  /** Default duration in ms */
  readonly duration?: number
  /** Default easing */
  readonly ease?: string | ((t: number) => number)
  /** Callback on each tick */
  readonly onTick?: (value: AnimationValue, progress: number) => void
  /** Callback on completion */
  readonly onComplete?: () => void
  /** Callback on cancel */
  readonly onCancel?: () => void
}

/** Options for a single animation call */
export interface AnimateToOptions {
  /** Override default duration */
  readonly duration?: number
  /** Override default easing */
  readonly ease?: string | ((t: number) => number)
}

// =============================================================================
// INTERPOLATION TYPES
// =============================================================================

/** Function that interpolates between two values */
export type Interpolator<T extends AnimationValue> = (
  from: T,
  to: T,
  progress: number
) => T

/** Registry of interpolators by value type */
export interface InterpolatorRegistry {
  readonly number: Interpolator<NumericValue>
  readonly vector: Interpolator<VectorValue>
  readonly object: Interpolator<ObjectValue>
  readonly color: Interpolator<ColorValue>
}

// =============================================================================
// DRIVER TYPES
// =============================================================================

/**
 * Animation driver - executes the actual animation.
 *
 * Unlike v1, this is a simple interface that just runs animations.
 * No timeline abstraction - use GSAP/anime.js directly for complex sequences.
 */
export interface AnimationDriver {
  /**
   * Run an animation from current to target.
   *
   * @param config Animation configuration
   * @returns Cancel function
   */
  readonly run: <T extends AnimationValue>(config: {
    readonly from: T
    readonly to: T
    readonly duration: number
    readonly ease: string | ((t: number) => number)
    readonly onTick: (value: T, progress: number) => void
    readonly onComplete: () => void
  }) => () => void
}

// =============================================================================
// ATOM TYPES (effect-atom integration)
// =============================================================================

/**
 * The public API for an animation atom.
 *
 * Read-only atoms for value/state/progress.
 * Action atoms for to/snap/pause/resume/cancel.
 */
export interface AnimationAtomApi<T extends AnimationValue> {
  // Read-only subscriptions
  readonly value$: unknown // Atom.Atom<T> - typed loosely to avoid import
  readonly state$: unknown // Atom.Atom<AnimationState>
  readonly progress$: unknown // Atom.Atom<number>

  // Actions
  readonly to: (target: T, options?: AnimateToOptions) => void
  readonly snap: (value: T) => void
  readonly pause: () => void
  readonly resume: () => void
  readonly cancel: () => void
}

// =============================================================================
// HOOK RETURN TYPE
// =============================================================================

/**
 * Return type for useAnimation hook
 */
export interface UseAnimationResult<T extends AnimationValue> {
  /** Current interpolated value */
  readonly value: T
  /** Current animation state */
  readonly state: AnimationState
  /** Animation progress 0-1 */
  readonly progress: number
  /** Animate to a new value */
  readonly to: (target: T, options?: AnimateToOptions) => void
  /** Snap immediately to a value */
  readonly snap: (value: T) => void
  /** Pause the current animation */
  readonly pause: () => void
  /** Resume a paused animation */
  readonly resume: () => void
  /** Cancel the current animation */
  readonly cancel: () => void
}
