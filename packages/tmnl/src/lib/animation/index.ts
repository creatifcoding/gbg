/**
 * Animation Library
 *
 * A reactive animation system bridging Effect-Atom with GSAP and anime.js.
 *
 * @example
 * ```typescript
 * import { Animatable, gsapDriver } from '@/lib/animation'
 *
 * // Use GSAP for precision timing
 * Animatable.setDriver(gsapDriver)
 *
 * // Create an animatable value
 * const scale = Animatable.make(1, { duration: 200 })
 *
 * // Animate to new value
 * scale.to(1.5)
 *
 * // Subscribe to changes
 * registry.subscribe(scale.current, (value) => {
 *   element.style.transform = `scale(${value})`
 * })
 * ```
 */

// Core Animatable primitive
export {
  Animatable,
  animatable,
  useAnimatable,
  type AnimatableAtoms,
  type AnimationDriver,
  type Interpolator,
  rafDriver,
  setDriver,
  getDriver,
} from './Animatable'

// Animation drivers
export { gsapDriver } from './drivers/gsap'
export {
  createEmanationTimeline,
  createSnapAnimation,
  createTrailGhost,
  createReticlePulse,
  createAnimationContext,
} from './drivers/gsap'

export { animeDriver } from './drivers/animejs'
export {
  createReticleRings,
  createCrosshair,
  createCornerEmanation,
  createBoundsEmanation,
} from './drivers/animejs'

// Tokens and configuration
export * from './tokens'

// Re-export for convenience
export { gsap } from 'gsap'
export { animate, createTimeline, stagger, utils } from 'animejs'
