/**
 * Slider V2
 *
 * CEW-grade slider with trait-based composition and Effect-ified animations.
 *
 * @example Basic Usage
 * ```tsx
 * import { Slider } from '@/lib/slider/v2'
 *
 * <Slider
 *   id="volume"
 *   config={{ min: 0, max: 100 }}
 *   onChange={(v) => console.log(v)}
 * />
 * ```
 *
 * @example With Trait Injection
 * ```tsx
 * import { Slider } from '@/lib/slider/v2'
 *
 * <Slider
 *   id="spectrum"
 *   config={{ min: -48, max: 6, unit: 'dB' }}
 *   glow={{ color: 'amber', intensity: 'intense', emanateOnBoundary: true }}
 *   overshoot={{ extent: 0.2, settleMs: 80 }}
 *   curve={{ type: 'decibel' }}
 * />
 * ```
 *
 * @example External Trait Control
 * ```tsx
 * import { TraitProvider, useInject } from '@/lib/traits'
 * import { Slider, GlowTrait, OvershootTrait } from '@/lib/slider/v2'
 *
 * function CEWControl() {
 *   const { inject } = useInject()
 *
 *   useEffect(() => {
 *     inject(GlowTrait, 'slider-1', { color: 'cyan', intensity: 'intense' })
 *     inject(OvershootTrait, 'slider-1', { extent: 0.15, settleMs: 65 })
 *   }, [inject])
 *
 *   return <Slider id="slider-1" config={{ min: 0, max: 100 }} />
 * }
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  SliderConfig,
  SliderState,
  SliderEvent,
  ModifierKeys,
  GlowSlot,
  SnapSlot,
  CurveSlot,
  OvershootSlot,
  PrecisionSlot,
} from './types'

export {
  DEFAULT_SLIDER_CONFIG,
  DEFAULT_MODIFIERS,
  initialSliderState,
  GLOW_COLORS,
  TIMING,
  EASING,
} from './types'

// =============================================================================
// TRAITS
// =============================================================================

export {
  GlowTrait,
  SnapTrait,
  CurveTrait,
  OvershootTrait,
  PrecisionTrait,
  SLIDER_TRAITS,
  SLIDER_TRAIT_IDS,
  normalizedToValue,
  valueToNormalized,
  calculateSensitivity,
  applyPrecision,
  handleAltBehavior,
  calculateOvershootTarget,
  isAtBoundary,
} from './traits'

// =============================================================================
// EFFECTS
// =============================================================================

export {
  createSettleEffect,
  createFillSettleEffect,
  createOvershootEffect,
  createDualOvershootEffect,
  createEmanationEffect,
  createBoundaryEmanationEffect,
  createSnapEmanationEffect,
} from './effects'

// =============================================================================
// ATOMS
// =============================================================================

export {
  sliderReducer,
  createSliderStateFamily,
  sliderStateFamily,
  extractModifiers,
  hasActiveModifier,
} from './atoms'

// =============================================================================
// HOOKS
// =============================================================================

export { useSlider, type UseSliderOptions, type UseSliderReturn } from './hooks/useSlider'

// =============================================================================
// COMPONENTS
// =============================================================================

export { Slider, type SliderProps } from './components/Slider'
