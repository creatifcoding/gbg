/**
 * Slider System
 *
 * A DAW-grade slider system with runtime-swappable behaviors,
 * fine-grained precision control, and debug overlays.
 *
 * @example Basic Usage
 * ```tsx
 * import { Slider } from '@/lib/slider'
 *
 * <Slider
 *   value={50}
 *   onChange={(v) => console.log(v)}
 *   config={{ min: 0, max: 100, step: 1 }}
 * />
 * ```
 *
 * @example With Behavior
 * ```tsx
 * import { Slider, DecibelBehavior } from '@/lib/slider'
 *
 * <Slider
 *   value={-6}
 *   behavior={DecibelBehavior.shape}
 *   config={{ min: -48, max: 6, unit: 'dB' }}
 * />
 * ```
 *
 * @example With Debug Overlay
 * ```tsx
 * import { Slider, withSliderDebug } from '@/lib/slider'
 *
 * const DebugSlider = withSliderDebug(Slider, { defaultExpanded: true })
 * <DebugSlider value={0} config={{ min: -1, max: 1 }} />
 * ```
 */

// =============================================================================
// TYPES
// =============================================================================

export type {
  SliderConfig,
  SliderState,
  SliderEvent,
  SliderDebugInfo,
  SliderBehaviorShape,
  ModifierKeys,
} from './types'

export {
  DEFAULT_SLIDER_CONFIG,
  DEFAULT_MODIFIERS,
  initialSliderState,
} from './types'

// =============================================================================
// SERVICES (Effect Layers)
// =============================================================================

export {
  SliderBehavior,
  LinearBehavior,
  LogarithmicBehavior,
  DecibelBehavior,
  SteppedBehavior,
  ExponentialBehavior,
  BUILT_IN_BEHAVIORS,
  type BehaviorType,
} from './services/SliderBehavior'

// =============================================================================
// ATOMS & STATE
// =============================================================================

export {
  // Runtime factories
  createSliderRuntime,
  linearSliderRuntime,
  logSliderRuntime,
  decibelSliderRuntime,
  exponentialSliderRuntime,
  // State management
  createSliderStateFamily,
  sliderStateFamily,
  // Behavior switcher
  createBehaviorSwitcher,
  type BehaviorPreset,
  // Reducer
  sliderReducer,
  // Debug
  createDebugInfoAtom,
} from './atoms'

// =============================================================================
// HOOKS
// =============================================================================

export { useSlider, type UseSliderOptions, type UseSliderReturn } from './hooks/useSlider'

// =============================================================================
// COMPONENTS
// =============================================================================

export { Slider, type SliderProps } from './components/Slider'

// =============================================================================
// DEBUG
// =============================================================================

export {
  withSliderDebug,
  SliderDebugPanel,
  type WithSliderDebugOptions,
} from './debug/withSliderDebug'
