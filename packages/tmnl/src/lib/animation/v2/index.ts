/**
 * Animation Library v2
 *
 * A reactive animation system that properly integrates:
 * - XState for animation lifecycle management
 * - effect-atom for React reactivity
 * - GSAP for animation execution
 *
 * @example
 * ```tsx
 * import { createAnimation, useAnimation } from '@/lib/animation/v2'
 *
 * // Create animation atom (outside component)
 * const opacityAnim = createAnimation(1, { duration: 300 })
 *
 * function MyComponent() {
 *   const { value, to, snap } = useAnimation(opacityAnim)
 *
 *   return (
 *     <div style={{ opacity: value }}>
 *       <button onClick={() => to(0)}>Fade Out</button>
 *       <button onClick={() => snap(1)}>Reset</button>
 *     </div>
 *   )
 * }
 * ```
 */

// =============================================================================
// CORE API
// =============================================================================

// Factory function
export { createAnimation, setDriver, getDriver } from './atom'
export type { AnimationAtom } from './atom'

// React hooks
export {
  useAnimation,
  useAnimationValue,
  useAnimationState,
  useAnimationProgress,
  useAnimationControls,
} from './hooks'

// =============================================================================
// TYPES
// =============================================================================

export type {
  // Value types
  AnimationValue,
  NumericValue,
  VectorValue,
  ObjectValue,
  ColorValue,

  // State types
  AnimationState,
  AnimationEvent,
  AnimationContext,

  // Config types
  AnimationOptions,
  AnimateToOptions,

  // Interpolation
  Interpolator,
  InterpolatorRegistry,

  // Driver
  AnimationDriver,

  // Hook return type
  UseAnimationResult,
} from './types'

// =============================================================================
// INTERPOLATORS
// =============================================================================

export {
  lerpNumber,
  lerpVector,
  lerpObject,
  lerpColor,
  getInterpolator,
  interpolators,
} from './interpolators'

// =============================================================================
// MACHINE
// =============================================================================

export { createAnimationMachine, createInitialContext } from './machine'
export type { AnimationMachine, AnimationMachineState } from './machine'

// =============================================================================
// DRIVERS
// =============================================================================

// GSAP driver
export {
  gsapDriver,
  GSAP_EASE,
  fadeElement,
  scaleElement,
  moveElement,
  createGsapContext,
} from './drivers/gsap'
export type { GsapEase } from './drivers/gsap'

// =============================================================================
// CONVENIENCE NAMESPACE
// =============================================================================

/**
 * Animation namespace with all utilities.
 *
 * @example
 * ```tsx
 * import { Animation } from '@/lib/animation/v2'
 *
 * const anim = Animation.create(0)
 * Animation.setDriver(myDriver)
 * ```
 */
import { createAnimation, setDriver, getDriver } from './atom'
import { getInterpolator } from './interpolators'

export const Animation = {
  create: (
    initial: import('./types').AnimationValue,
    options?: import('./types').AnimationOptions
  ) => {
    return createAnimation(initial, options)
  },
  setDriver: (driver: import('./types').AnimationDriver) => {
    setDriver(driver)
  },
  getDriver: () => {
    return getDriver()
  },
  interpolators: {
    number: (from: number, to: number, t: number) => from + (to - from) * t,
    auto: <T>(sample: T) => {
      return getInterpolator(sample)
    },
  },
  ease: {
    linear: 'none',
    easeOut: 'power2.out',
    easeIn: 'power2.in',
    easeInOut: 'power2.inOut',
    snapOut: 'power3.out',
    backOut: 'back.out(1.7)',
    elasticOut: 'elastic.out(1, 0.3)',
    mechanical: 'none',
  },
} as const
