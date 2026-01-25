/**
 * GEOINT Animation State Traits
 *
 * Traits for tracking entity animation state during transitions.
 *
 * @module
 */

import { Schema } from 'effect'
import { defineTrait, registerTrait, type TraitId } from '../../../kori/schemas/trait'

// ─────────────────────────────────────────────────────────────────────────────
// Animation Phase
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Animation phase literals.
 */
export const AnimationPhase = Schema.Literal(
  'idle',       // No animation
  'entering',   // Appearing/spawning
  'exiting',    // Disappearing/despawning
  'morphing',   // Transforming between states
  'moving',     // Position animation
  'pulsing',    // Attention-grabbing pulse
  'highlighting', // Highlight animation
)
export type AnimationPhase = typeof AnimationPhase.Type

// ─────────────────────────────────────────────────────────────────────────────
// Animation State Trait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AnimationState trait - current animation state.
 */
export const AnimationState = defineTrait('AnimationState', {
  /** Current animation phase */
  phase: Schema.optionalWith(AnimationPhase, { default: () => 'idle' as const }),
  /** Animation progress (0-1) */
  progress: Schema.optionalWith(Schema.Number.pipe(Schema.between(0, 1)), { default: () => 0 }),
  /** Animation start timestamp */
  startedAt: Schema.optional(Schema.DateFromSelf),
  /** Animation duration in ms */
  durationMs: Schema.optionalWith(Schema.Number, { default: () => 300 }),
  /** Whether animation is interruptible */
  interruptible: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})
export type AnimationState = typeof AnimationState.Type

/**
 * Default animation state.
 */
export const DEFAULT_ANIMATION_STATE: AnimationState = {
  _tag: 'AnimationState',
  phase: 'idle',
  progress: 0,
  durationMs: 300,
  interruptible: true,
}

/**
 * AnimationTarget trait - animation destination state.
 */
export const AnimationTarget = defineTrait('AnimationTarget', {
  /** Target position [lon, lat] */
  targetPosition: Schema.optional(Schema.Tuple(Schema.Number, Schema.Number)),
  /** Target scale */
  targetScale: Schema.optional(Schema.Number),
  /** Target opacity (0-1) */
  targetOpacity: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  /** Target rotation in degrees */
  targetRotation: Schema.optional(Schema.Number),
})
export type AnimationTarget = typeof AnimationTarget.Type

/**
 * AnimationEasing trait - animation timing function.
 */
export const AnimationEasing = defineTrait('AnimationEasing', {
  /** Easing function name */
  easing: Schema.optionalWith(
    Schema.Literal(
      'linear',
      'easeIn',
      'easeOut',
      'easeInOut',
      'easeInQuad',
      'easeOutQuad',
      'easeInOutQuad',
      'easeInCubic',
      'easeOutCubic',
      'easeInOutCubic',
      'spring',
    ),
    { default: () => 'easeInOut' as const }
  ),
  /** Spring stiffness (if easing = spring) */
  springStiffness: Schema.optional(Schema.Number),
  /** Spring damping (if easing = spring) */
  springDamping: Schema.optional(Schema.Number),
})
export type AnimationEasing = typeof AnimationEasing.Type

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

registerTrait('AnimationState' as TraitId, AnimationState)
registerTrait('AnimationTarget' as TraitId, AnimationTarget)
registerTrait('AnimationEasing' as TraitId, AnimationEasing)
