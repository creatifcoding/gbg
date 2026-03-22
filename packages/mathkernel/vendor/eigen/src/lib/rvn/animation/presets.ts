/**
 * RVN Animation Presets
 *
 * Raw anime.js configurations for brutalist component animations.
 * All presets are pure configuration objects - no DOM coupling.
 *
 * Usage:
 * ```ts
 * import anime from 'animejs'
 * import { RVN_PRESETS } from './presets'
 *
 * anime(target, RVN_PRESETS.press)
 * ```
 */

import { stagger, type AnimeParams } from 'animejs'

// =============================================================================
// INTERACTION PRESETS
// =============================================================================

/**
 * Press animation: Shadow removal + translate for "pushed in" effect.
 * Apply on :active or press state.
 */
export const press: AnimeParams = {
  boxShadow: ['4px 4px 0px rgba(0, 0, 0, 1)', 'none'],
  translateX: [0, 4],
  translateY: [0, 4],
  duration: 100,
  easing: 'easeOutQuad',
}

/**
 * Release animation: Reverse of press.
 * Apply on press end / mouseup.
 */
export const release: AnimeParams = {
  boxShadow: ['none', '4px 4px 0px rgba(0, 0, 0, 1)'],
  translateX: [4, 0],
  translateY: [4, 0],
  duration: 100,
  easing: 'easeOutQuad',
}

/**
 * Hover invert: Black/white color swap.
 * Brutalist hover state.
 */
export const hoverInvert: AnimeParams = {
  backgroundColor: ['#ffffff', '#000000'],
  color: ['#000000', '#ffffff'],
  duration: 150,
  easing: 'easeOutQuad',
}

/**
 * Hover invert reverse: Return to normal.
 */
export const hoverInvertOut: AnimeParams = {
  backgroundColor: ['#000000', '#ffffff'],
  color: ['#ffffff', '#000000'],
  duration: 150,
  easing: 'easeOutQuad',
}

// =============================================================================
// STATUS / ALERT PRESETS
// =============================================================================

/**
 * Critical pulse: Opacity breathing for alerts.
 * Use with loop: true.
 */
export const criticalPulse: AnimeParams = {
  opacity: [1, 0.7, 1],
  duration: 800,
  easing: 'easeInOutSine',
  loop: true,
}

/**
 * Emergency glitch: Random jitter for critical states.
 * Brutalist "system stressed" effect.
 */
export const emergencyGlitch: AnimeParams = {
  translateX: () => Math.random() * 4 - 2, // -2 to 2px
  duration: 50,
  easing: 'linear',
  loop: 3,
  direction: 'alternate',
}

/**
 * Warning flash: Binary on/off flash.
 * More aggressive than pulse.
 */
export const warningFlash: AnimeParams = {
  opacity: [1, 0, 1],
  duration: 400,
  easing: 'steps(2)',
  loop: true,
}

// =============================================================================
// ENTRANCE / EXIT PRESETS
// =============================================================================

/**
 * Tactical fade-in: Opacity + vertical slide.
 * Standard entrance animation.
 */
export const tacticalFadeIn: AnimeParams = {
  opacity: [0, 1],
  translateY: [20, 0],
  duration: 300,
  easing: 'easeOutQuad',
}

/**
 * Tactical fade-out: Reverse entrance.
 */
export const tacticalFadeOut: AnimeParams = {
  opacity: [1, 0],
  translateY: [0, -10],
  duration: 200,
  easing: 'easeInQuad',
}

/**
 * Slide in from left: Horizontal entrance.
 */
export const slideInLeft: AnimeParams = {
  opacity: [0, 1],
  translateX: [-30, 0],
  duration: 300,
  easing: 'easeOutQuad',
}

/**
 * Slide in from right: Horizontal entrance.
 */
export const slideInRight: AnimeParams = {
  opacity: [0, 1],
  translateX: [30, 0],
  duration: 300,
  easing: 'easeOutQuad',
}

/**
 * Scale in: Pop-in effect.
 */
export const scaleIn: AnimeParams = {
  opacity: [0, 1],
  scale: [0.9, 1],
  duration: 250,
  easing: 'easeOutBack',
}

/**
 * Scale out: Shrink exit.
 */
export const scaleOut: AnimeParams = {
  opacity: [1, 0],
  scale: [1, 0.9],
  duration: 200,
  easing: 'easeInQuad',
}

// =============================================================================
// GRID / STAGGER PRESETS
// =============================================================================

/**
 * Grid reveal: Staggered entrance from center.
 * Use with stagger() for grid items.
 */
export const gridReveal: AnimeParams = {
  opacity: [0, 1],
  scale: [0.8, 1],
  duration: 300,
  easing: 'easeOutQuad',
  delay: stagger(50, { grid: [10, 10], from: 'center' }),
}

/**
 * List stagger: Sequential item entrance.
 */
export const listReveal: AnimeParams = {
  opacity: [0, 1],
  translateY: [15, 0],
  duration: 250,
  easing: 'easeOutQuad',
  delay: stagger(40),
}

/**
 * Cascade reveal: Waterfall effect.
 */
export const cascadeReveal: AnimeParams = {
  opacity: [0, 1],
  translateY: [30, 0],
  duration: 400,
  easing: 'easeOutQuad',
  delay: stagger(80, { start: 0 }),
}

// =============================================================================
// LOADING / PROGRESS PRESETS
// =============================================================================

/**
 * Progress bar fill: Width animation.
 */
export const progressFill: AnimeParams = {
  width: ['0%', '100%'],
  duration: 1000,
  easing: 'linear',
}

/**
 * Indeterminate loading: Back-and-forth motion.
 */
export const indeterminateLoad: AnimeParams = {
  translateX: ['-100%', '100%'],
  duration: 1200,
  easing: 'easeInOutQuad',
  loop: true,
  direction: 'alternate',
}

/**
 * Skeleton shimmer: Gradient sweep effect.
 */
export const skeletonShimmer: AnimeParams = {
  backgroundPositionX: ['-200%', '200%'],
  duration: 1500,
  easing: 'linear',
  loop: true,
}

// =============================================================================
// MICRO-INTERACTIONS
// =============================================================================

/**
 * Checkbox check: Scale bounce.
 */
export const checkBounce: AnimeParams = {
  scale: [0, 1.1, 1],
  duration: 200,
  easing: 'easeOutBack',
}

/**
 * Toggle switch: Translate between positions.
 */
export const toggleSwitch: AnimeParams = {
  translateX: [0, 20],
  duration: 150,
  easing: 'easeOutQuad',
}

/**
 * Ripple expand: Circle expansion from click point.
 */
export const rippleExpand: AnimeParams = {
  scale: [0, 2],
  opacity: [0.5, 0],
  duration: 400,
  easing: 'easeOutQuad',
}

// =============================================================================
// AGGREGATED EXPORT
// =============================================================================

/**
 * All RVN animation presets.
 *
 * Usage:
 * ```ts
 * import { RVN_PRESETS } from '@/lib/rvn/animation'
 * anime(element, RVN_PRESETS.press)
 * ```
 */
export const RVN_PRESETS = {
  // Interaction
  press,
  release,
  hoverInvert,
  hoverInvertOut,

  // Status/Alert
  criticalPulse,
  emergencyGlitch,
  warningFlash,

  // Entrance/Exit
  tacticalFadeIn,
  tacticalFadeOut,
  slideInLeft,
  slideInRight,
  scaleIn,
  scaleOut,

  // Grid/Stagger
  gridReveal,
  listReveal,
  cascadeReveal,

  // Loading/Progress
  progressFill,
  indeterminateLoad,
  skeletonShimmer,

  // Micro-interactions
  checkBounce,
  toggleSwitch,
  rippleExpand,
} as const

export type RvnPreset = keyof typeof RVN_PRESETS
