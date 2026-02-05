/**
 * RVN Animation Modes
 *
 * Context-aware animation configurations.
 * Different operational contexts require different animation characteristics:
 * - tactical: Standard UI operations, balanced feel
 * - emergency: Critical alerts, fast and urgent
 * - minimal: Reduced motion / accessibility mode
 *
 * Usage:
 * ```ts
 * import { RVN_MODES, applyMode } from './modes'
 *
 * // Apply mode to a preset
 * const config = applyMode(RVN_PRESETS.tacticalFadeIn, 'emergency')
 * anime(target, config)
 * ```
 */

import type { AnimeParams } from 'animejs'

// =============================================================================
// MODE DEFINITIONS
// =============================================================================

/**
 * Tactical mode: Standard operations.
 * Balanced timing, smooth easing.
 */
export const tactical: AnimationMode = {
  duration: 200,
  easing: 'easeOutQuad',
  multiplier: 1,
}

/**
 * Emergency mode: Critical states.
 * Fast, linear timing for urgency.
 */
export const emergency: AnimationMode = {
  duration: 100,
  easing: 'linear',
  multiplier: 0.5,
}

/**
 * Minimal mode: Reduced motion.
 * Zero duration, instant transitions.
 * Respects prefers-reduced-motion.
 */
export const minimal: AnimationMode = {
  duration: 0,
  easing: 'linear',
  multiplier: 0,
}

/**
 * Dramatic mode: Enhanced animations.
 * Slower, more pronounced for emphasis.
 */
export const dramatic: AnimationMode = {
  duration: 400,
  easing: 'easeOutBack',
  multiplier: 1.5,
}

/**
 * Subtle mode: Understated animations.
 * For background elements.
 */
export const subtle: AnimationMode = {
  duration: 150,
  easing: 'easeOutSine',
  multiplier: 0.7,
}

// =============================================================================
// MODE UTILITIES
// =============================================================================

/**
 * Animation mode configuration.
 */
export interface AnimationMode {
  /** Base duration in ms */
  duration: number
  /** Easing function */
  easing: string
  /** Duration multiplier (1 = normal, 0.5 = half, 2 = double) */
  multiplier: number
}

/**
 * All RVN animation modes.
 */
export const RVN_MODES = {
  tactical,
  emergency,
  minimal,
  dramatic,
  subtle,
} as const

export type RvnMode = keyof typeof RVN_MODES

/**
 * Apply a mode's overrides to an animation config.
 * Mode duration scales the preset's duration.
 *
 * @example
 * ```ts
 * const fastFade = applyMode(RVN_PRESETS.tacticalFadeIn, 'emergency')
 * // duration: 300 * 0.5 = 150ms, easing: 'linear'
 * ```
 */
export function applyMode(
  preset: AnimeParams,
  mode: RvnMode
): AnimeParams {
  const modeConfig = RVN_MODES[mode]

  // Minimal mode = instant
  if (mode === 'minimal') {
    return {
      ...preset,
      duration: 0,
      easing: 'linear',
    }
  }

  // Scale duration by multiplier
  const baseDuration = (preset.duration as number) ?? modeConfig.duration
  const scaledDuration = Math.round(baseDuration * modeConfig.multiplier)

  return {
    ...preset,
    duration: scaledDuration,
    easing: modeConfig.easing,
  }
}

/**
 * Check if reduced motion is preferred.
 * Returns 'minimal' mode if so.
 */
export function detectPreferredMode(): RvnMode {
  if (typeof window === 'undefined') return 'tactical'

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  return prefersReduced.matches ? 'minimal' : 'tactical'
}

/**
 * Subscribe to motion preference changes.
 */
export function onMotionPreferenceChange(
  callback: (mode: RvnMode) => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

  const handler = (e: MediaQueryListEvent) => {
    callback(e.matches ? 'minimal' : 'tactical')
  }

  mediaQuery.addEventListener('change', handler)
  return () => mediaQuery.removeEventListener('change', handler)
}

/**
 * Create mode-aware animation function.
 * Returns a function that applies the current mode to any preset.
 */
export function createModeAwareAnimate(
  getMode: () => RvnMode
): (preset: AnimeParams) => AnimeParams {
  return (preset: AnimeParams) => applyMode(preset, getMode())
}

// =============================================================================
// PREBUILT MODE COMBINATIONS
// =============================================================================

/**
 * Emergency variants of common presets.
 * Pre-computed for performance.
 */
export const EMERGENCY_OVERRIDES = {
  duration: 100,
  easing: 'linear',
} as const

/**
 * Minimal variants - instant transitions.
 */
export const MINIMAL_OVERRIDES = {
  duration: 0,
  easing: 'linear',
} as const

/**
 * Dramatic variants - emphasized animations.
 */
export const DRAMATIC_OVERRIDES = {
  duration: 400,
  easing: 'easeOutBack',
} as const
