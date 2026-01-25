/**
 * @fileoverview Effect Schema definitions for entrance animations
 *
 * Provides typed animation parameters that the LLM generates:
 * - Property: What to animate (opacity, translate, scale combos)
 * - Easing: How it moves (out-cubic, out-back, etc.)
 * - Duration: How long (token-based: fast, normal, slow)
 * - Stagger: Sequential child animation
 *
 * @module json-render/core/animation-schema
 */

import * as Schema from "effect/Schema"

// =============================================================================
// Animation Property (what to animate)
// =============================================================================

/**
 * Animation property combinations
 *
 * - `opacity`: Simple fade in
 * - `opacity+translateY`: Fade + lift from below (lists, cards)
 * - `opacity+translateX`: Fade + slide from left (sidebars, menus)
 * - `opacity+scale`: Fade + grow (modals, focus elements)
 */
export const AnimationProperty = Schema.Literal(
  "opacity",
  "opacity+translateY",
  "opacity+translateX",
  "opacity+scale"
)
export type AnimationProperty = Schema.Schema.Type<typeof AnimationProperty>

// =============================================================================
// Animation Easing (how it moves)
// =============================================================================

/**
 * Easing curves
 *
 * - `linear`: Mechanical, constant speed
 * - `out-quad`: Smooth decelerate
 * - `out-cubic`: Natural decelerate (default)
 * - `out-quart`: Snappy decelerate
 * - `out-back`: Slight overshoot, playful
 * - `out-elastic`: Bouncy overshoot, attention-grabbing
 */
export const AnimationEasing = Schema.Literal(
  "linear",
  "out-quad",
  "out-cubic",
  "out-quart",
  "out-back",
  "out-elastic"
)
export type AnimationEasing = Schema.Schema.Type<typeof AnimationEasing>

// =============================================================================
// Animation Duration (how long)
// =============================================================================

/**
 * Duration tokens
 *
 * - `instant`: 0ms (no animation)
 * - `fast`: 100ms (quick accents)
 * - `normal`: 200ms (standard)
 * - `slow`: 300ms (deliberate)
 * - `slower`: 500ms (dramatic)
 */
export const AnimationDuration = Schema.Literal(
  "instant",
  "fast",
  "normal",
  "slow",
  "slower"
)
export type AnimationDuration = Schema.Schema.Type<typeof AnimationDuration>

// =============================================================================
// Entrance Animation (full specification)
// =============================================================================

/**
 * Full entrance animation schema
 *
 * LLM generates this object to control how elements animate in.
 *
 * @example
 * ```json
 * {
 *   "property": "opacity+translateY",
 *   "easing": "out-cubic",
 *   "duration": "normal",
 *   "stagger": true
 * }
 * ```
 */
export const EntranceAnimation = Schema.Struct({
  /** What properties to animate */
  property: AnimationProperty,
  /** Easing curve */
  easing: AnimationEasing,
  /** Duration token */
  duration: AnimationDuration,
  /** Stagger children (50ms per child) */
  stagger: Schema.optional(Schema.Boolean),
  /** Custom delay in ms */
  delay: Schema.optional(Schema.Number),
})

export type EntranceAnimation = Schema.Schema.Type<typeof EntranceAnimation>

// =============================================================================
// Type Guards
// =============================================================================

export const isEntranceAnimation = Schema.is(EntranceAnimation)

// =============================================================================
// Decoder
// =============================================================================

export const decodeEntranceAnimation = Schema.decodeUnknown(EntranceAnimation)
export const decodeEntranceAnimationSync = Schema.decodeUnknownSync(EntranceAnimation)
