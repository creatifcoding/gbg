/**
 * RVN Animation System
 *
 * Brutalist animation presets and utilities built on anime.js v4.
 *
 * @example
 * ```ts
 * import anime from 'animejs'
 * import {
 *   RVN_PRESETS,
 *   RVN_MODES,
 *   RVN_LAYOUTS,
 *   createRvnTimeline,
 *   applyMode,
 * } from '@/lib/rvn/animation'
 *
 * // Simple preset
 * anime(button, RVN_PRESETS.press)
 *
 * // Mode-aware
 * anime(element, applyMode(RVN_PRESETS.tacticalFadeIn, 'emergency'))
 *
 * // Orchestrated timeline
 * const tl = createRvnTimeline()
 * tl.add('.header', RVN_PRESETS.tacticalFadeIn)
 *   .add('.items', RVN_PRESETS.listReveal)
 * tl.play()
 * ```
 */

// =============================================================================
// PRESETS
// =============================================================================

export {
  // Individual presets
  press,
  release,
  hoverInvert,
  hoverInvertOut,
  criticalPulse,
  emergencyGlitch,
  warningFlash,
  tacticalFadeIn,
  tacticalFadeOut,
  slideInLeft,
  slideInRight,
  scaleIn,
  scaleOut,
  gridReveal,
  listReveal,
  cascadeReveal,
  progressFill,
  indeterminateLoad,
  skeletonShimmer,
  checkBounce,
  toggleSwitch,
  rippleExpand,
  // Aggregated
  RVN_PRESETS,
} from './presets'

export type { RvnPreset } from './presets'

// =============================================================================
// MODES
// =============================================================================

export {
  // Individual modes
  tactical,
  emergency,
  minimal,
  dramatic,
  subtle,
  // Aggregated
  RVN_MODES,
  // Utilities
  applyMode,
  detectPreferredMode,
  onMotionPreferenceChange,
  createModeAwareAnimate,
  // Override objects
  EMERGENCY_OVERRIDES,
  MINIMAL_OVERRIDES,
  DRAMATIC_OVERRIDES,
} from './modes'

export type { AnimationMode, RvnMode } from './modes'

// =============================================================================
// LAYOUT
// =============================================================================

export {
  // Springs
  SPRING_SNAPPY,
  SPRING_BOUNCY,
  SPRING_STIFF,
  SPRING_SMOOTH,
  SPRING_DRAMATIC,
  RVN_SPRINGS,
  // Layout presets
  RVN_ACCORDION_LAYOUT,
  RVN_NAV_LAYOUT,
  RVN_GRID_LAYOUT,
  RVN_LIST_LAYOUT,
  RVN_TAB_LAYOUT,
  RVN_MODAL_LAYOUT,
  RVN_DRAWER_LAYOUT,
  RVN_DROPDOWN_LAYOUT,
  RVN_CARD_LAYOUT,
  RVN_TOOLTIP_LAYOUT,
  // Aggregated
  RVN_LAYOUTS,
} from './layout'

export type { LayoutPreset, RvnLayout, RvnSpring } from './layout'

// =============================================================================
// ORCHESTRATION
// =============================================================================

export {
  // Timeline factories
  createRvnTimeline,
  createEntranceTimeline,
  createAmbientTimeline,
  // Stagger utilities
  staggerGrid,
  staggerList,
  staggerWave,
  staggerRandom,
  // Sequence helpers
  buildSequence,
  staggeredEntrance,
  // Utilities
  waitForTimeline,
  chainTimelines,
  parallelTimelines,
  delay,
  animateIfVisible,
  // Page transitions
  pageEntrance,
  pageExit,
} from './orchestration'

export type {
  RvnTimelineConfig,
  GridStaggerConfig,
  ListStaggerConfig,
  SequenceStep,
} from './orchestration'

// =============================================================================
// VALUE ANIMATION (Bars, Meters, Progress)
// =============================================================================

export {
  useAnimatedValue,
  quantizeValue,
  BAR_ANIMATION_PRESETS,
} from './useAnimatedValue'

export type {
  BarAnimationConfig,
  BarAnimationPreset,
  AnimationEasing,
} from './useAnimatedValue'

// =============================================================================
// COLOR GRADIENTS (Transitional bar colors)
// =============================================================================

export {
  createGradient,
  resolveGradient,
  GRADIENT_PRESETS,
} from './colorGradient'

export type {
  GradientStop,
  GradientConfig,
  Gradient,
  GradientPreset,
} from './colorGradient'
