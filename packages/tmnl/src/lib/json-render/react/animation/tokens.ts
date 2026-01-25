/**
 * @fileoverview Animation token resolution for anime.js
 *
 * Maps typed animation tokens to concrete values:
 * - Duration tokens → milliseconds
 * - Easing tokens → anime.js easing strings
 * - Property tokens → initial/final states
 *
 * @module json-render/react/animation/tokens
 */

import type {
  AnimationDuration,
  AnimationEasing,
  AnimationProperty,
} from "../../core/animation-schema"

// =============================================================================
// Duration Tokens
// =============================================================================

/**
 * Duration token → milliseconds
 */
export const DURATION_MS: Record<AnimationDuration, number> = {
  instant: 0,
  fast: 100,
  normal: 200,
  slow: 300,
  slower: 500,
}

// =============================================================================
// Easing Tokens
// =============================================================================

/**
 * Easing token → anime.js easing string
 *
 * @see https://animejs.com/documentation/#linearEasing
 */
export const EASING_ANIMEJS: Record<AnimationEasing, string> = {
  linear: "linear",
  "out-quad": "easeOutQuad",
  "out-cubic": "easeOutCubic",
  "out-quart": "easeOutQuart",
  "out-back": "easeOutBack",
  "out-elastic": "easeOutElastic(1, .6)",
}

// =============================================================================
// Property State Mappings
// =============================================================================

/**
 * Property token → initial and final animation states
 *
 * These are the CSS transform/style values that anime.js will interpolate.
 */
export const PROPERTY_STATES: Record<
  AnimationProperty,
  {
    initial: Record<string, number>
    final: Record<string, number>
  }
> = {
  opacity: {
    initial: { opacity: 0 },
    final: { opacity: 1 },
  },
  "opacity+translateY": {
    initial: { opacity: 0, translateY: 12 },
    final: { opacity: 1, translateY: 0 },
  },
  "opacity+translateX": {
    initial: { opacity: 0, translateX: -12 },
    final: { opacity: 1, translateX: 0 },
  },
  "opacity+scale": {
    initial: { opacity: 0, scale: 0.95 },
    final: { opacity: 1, scale: 1 },
  },
}

// =============================================================================
// Stagger Configuration
// =============================================================================

/**
 * Delay between staggered child animations (ms)
 */
export const STAGGER_DELAY = 50
