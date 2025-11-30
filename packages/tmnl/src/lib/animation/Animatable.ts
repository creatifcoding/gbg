/**
 * Animatable
 *
 * A reactive animation primitive built on effect-atom.
 * When the target value changes, the current value *transitions* rather than snaps.
 *
 * @example
 * ```tsx
 * import { Atom } from '@effect-atom/atom-react'
 * import { animatable, useAnimatable } from '@/lib/animation'
 *
 * // Create an animatable value
 * const scaleAtom = animatable(1, { duration: 200, ease: 'power2.out' })
 *
 * function MyComponent() {
 *   const { value, to, snap } = useAnimatable(scaleAtom)
 *
 *   return (
 *     <div style={{ transform: `scale(${value})` }}>
 *       <button onClick={() => to(1.5)}>Scale Up</button>
 *     </div>
 *   )
 * }
 * ```
 */

import { Atom } from '@effect-atom/atom-react'
import type { AnimatableConfig, AnimationState, TimelinePhase } from './tokens'
import { EASING } from './tokens'

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/**
 * Interpolation function for custom value types.
 * Returns a value between `from` and `to` based on progress `t` (0-1).
 */
export type Interpolator<T> = (from: T, to: T, t: number) => T

/**
 * Animation driver interface - implemented by GSAP, anime.js, or RAF drivers.
 */
export interface AnimationDriver {
  /**
   * Start animating from current value to target.
   * Returns a cancel function.
   */
  animate<T>(
    from: T,
    to: T,
    config: {
      duration: number
      ease?: string | ((t: number) => number)
      onUpdate: (value: T) => void
      onComplete: () => void
    },
    interpolate: Interpolator<T>
  ): () => void

  /**
   * Create a timeline for sequenced animations.
   */
  timeline<T>(
    phases: TimelinePhase<T>[],
    config: {
      onUpdate: (value: Partial<T>) => void
      onComplete: () => void
    }
  ): {
    play: () => void
    pause: () => void
    reverse: () => void
    seek: (time: number) => void
    kill: () => void
  }
}

/**
 * Internal state for an Animatable
 */
interface AnimatableState<T> {
  current: T
  target: T
  previous: T | null
  progress: number
  state: AnimationState
}

/**
 * The atoms that compose an Animatable
 */
export interface AnimatableAtoms<T> {
  /** The animated current value */
  current: Atom.Atom<T>
  /** The target value */
  target: Atom.Atom<T>
  /** Animation progress 0-1 */
  progress: Atom.Atom<number>
  /** Animation state */
  state: Atom.Atom<AnimationState>
  /** Trigger animation to new value */
  animateTo: Atom.Writable<T, T>
  /** Snap immediately without animation */
  snapTo: Atom.Writable<T, T>
  /** Stop current animation */
  stop: Atom.Writable<void, void>
  /** Reverse to previous target */
  reverse: Atom.Writable<void, void>
}

// =============================================================================
// DEFAULT INTERPOLATORS
// =============================================================================

/** Linear interpolation for numbers */
export const lerpNumber: Interpolator<number> = (from, to, t) =>
  from + (to - from) * t

/** Interpolate objects with numeric values */
export const lerpObject = <T extends Record<string, number>>(
  from: T,
  to: T,
  t: number
): T => {
  const result = {} as T
  for (const key in from) {
    if (typeof from[key] === 'number' && typeof to[key] === 'number') {
      result[key] = lerpNumber(from[key], to[key], t) as T[typeof key]
    } else {
      result[key] = t < 0.5 ? from[key] : to[key]
    }
  }
  return result
}

/** Interpolate arrays of numbers */
export const lerpArray: Interpolator<number[]> = (from, to, t) =>
  from.map((v, i) => lerpNumber(v, to[i] ?? v, t))

/** Interpolate colors (hex strings) */
export const lerpColor: Interpolator<string> = (from, to, t) => {
  const parseHex = (hex: string) => {
    const h = hex.replace('#', '')
    return {
      r: parseInt(h.slice(0, 2), 16),
      g: parseInt(h.slice(2, 4), 16),
      b: parseInt(h.slice(4, 6), 16),
    }
  }
  const toHex = (n: number) =>
    Math.round(Math.max(0, Math.min(255, n)))
      .toString(16)
      .padStart(2, '0')

  const c1 = parseHex(from)
  const c2 = parseHex(to)

  return `#${toHex(lerpNumber(c1.r, c2.r, t))}${toHex(lerpNumber(c1.g, c2.g, t))}${toHex(lerpNumber(c1.b, c2.b, t))}`
}

/** Auto-detect interpolator based on value type */
export function autoInterpolator<T>(sample: T): Interpolator<T> {
  if (typeof sample === 'number') {
    return lerpNumber as Interpolator<T>
  }
  if (Array.isArray(sample) && typeof sample[0] === 'number') {
    return lerpArray as Interpolator<T>
  }
  if (typeof sample === 'string' && sample.startsWith('#')) {
    return lerpColor as Interpolator<T>
  }
  if (typeof sample === 'object' && sample !== null) {
    return lerpObject as Interpolator<T>
  }
  // Fallback: step function
  return ((from: T, to: T, t: number) => (t < 1 ? from : to)) as Interpolator<T>
}

// =============================================================================
// FALLBACK DRIVER (requestAnimationFrame-based)
// =============================================================================

/**
 * Simple RAF-based animation driver for when GSAP/anime.js aren't needed.
 */
export const rafDriver: AnimationDriver = {
  animate<T>(
    from: T,
    to: T,
    config: {
      duration: number
      ease?: string | ((t: number) => number)
      onUpdate: (value: T) => void
      onComplete: () => void
    },
    interpolate: Interpolator<T>
  ): () => void {
    const startTime = performance.now()
    const { duration, ease, onUpdate, onComplete } = config
    let rafId: number | null = null
    let cancelled = false

    // Simple easing functions
    const easeFunc =
      typeof ease === 'function'
        ? ease
        : ease === 'linear'
          ? (t: number) => t
          : (t: number) => t * (2 - t) // Default: easeOutQuad

    const tick = (now: number) => {
      if (cancelled) return

      const elapsed = now - startTime
      const rawProgress = Math.min(1, elapsed / duration)
      const easedProgress = easeFunc(rawProgress)

      const value = interpolate(from, to, easedProgress)
      onUpdate(value)

      if (rawProgress < 1) {
        rafId = requestAnimationFrame(tick)
      } else {
        onComplete()
      }
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      cancelled = true
      if (rafId !== null) {
        cancelAnimationFrame(rafId)
      }
    }
  },

  timeline<T>(
    phases: TimelinePhase<T>[],
    config: {
      onUpdate: (value: Partial<T>) => void
      onComplete: () => void
    }
  ) {
    let currentPhase = 0
    let isPlaying = false
    let cancelCurrent: (() => void) | null = null

    const runPhase = (index: number) => {
      if (index >= phases.length) {
        config.onComplete()
        return
      }

      const phase = phases[index]
      const delay = phase.delay ?? 0

      setTimeout(() => {
        if (!isPlaying) return

        cancelCurrent = rafDriver.animate(
          {} as T,
          phase.to as T,
          {
            duration: phase.duration,
            ease: phase.ease,
            onUpdate: (value) => config.onUpdate(value as Partial<T>),
            onComplete: () => runPhase(index + 1),
          },
          lerpObject as Interpolator<T>
        )
      }, delay)
    }

    return {
      play: () => {
        isPlaying = true
        runPhase(currentPhase)
      },
      pause: () => {
        isPlaying = false
        cancelCurrent?.()
      },
      reverse: () => {
        currentPhase = 0
        isPlaying = true
        runPhase(0)
      },
      seek: (_time: number) => {
        // Not implemented for RAF driver
      },
      kill: () => {
        isPlaying = false
        cancelCurrent?.()
        currentPhase = 0
      },
    }
  },
}

// =============================================================================
// GLOBAL DRIVER
// =============================================================================

let globalDriver: AnimationDriver = rafDriver

export function setDriver(driver: AnimationDriver): void {
  globalDriver = driver
}

export function getDriver(): AnimationDriver {
  return globalDriver
}

// =============================================================================
// ANIMATABLE FACTORY
// =============================================================================

/**
 * Create an Animatable - a set of atoms that animate between values.
 *
 * @example
 * ```tsx
 * const scaleAtoms = animatable(1, { duration: 200 })
 *
 * // In component:
 * const scale = useAtomValue(scaleAtoms.current)
 * const animateTo = useAtomSet(scaleAtoms.animateTo)
 *
 * // Trigger animation:
 * animateTo(1.5)
 * ```
 */
export function animatable<T>(
  initial: T,
  config: Partial<AnimatableConfig<T>> = {}
): AnimatableAtoms<T> {
  const {
    duration = 200,
    ease = EASING.gsap.snapSettle,
    onComplete,
    onUpdate,
  } = config

  // Interpolator for this value type
  const interpolate = autoInterpolator(initial)

  // Internal state - stored in a single atom for atomicity
  const stateAtom = Atom.make<AnimatableState<T>>({
    current: initial,
    target: initial,
    previous: null,
    progress: 1,
    state: 'idle',
  }).pipe(Atom.keepAlive)

  // Track cancel function outside atoms
  let cancelAnimation: (() => void) | null = null

  // Derived atoms for individual properties
  const currentAtom = Atom.make((get) => get(stateAtom).current)
  const targetAtom = Atom.make((get) => get(stateAtom).target)
  const progressAtom = Atom.make((get) => get(stateAtom).progress)
  const stateValueAtom = Atom.make((get) => get(stateAtom).state)

  // Action: animate to new value
  const animateToAtom: Atom.Writable<T, T> = Atom.writable(
    (get) => get(stateAtom).target,
    (ctx, newTarget) => {
      const state = ctx.get(stateAtom)

      // Cancel any running animation
      cancelAnimation?.()

      // Update state
      ctx.set(stateAtom, {
        ...state,
        target: newTarget,
        previous: state.target,
        progress: 0,
        state: 'animating',
      })

      // Start animation
      cancelAnimation = globalDriver.animate(
        state.current,
        newTarget,
        {
          duration,
          ease,
          onUpdate: (value) => {
            const current = ctx.get(stateAtom)
            ctx.set(stateAtom, {
              ...current,
              current: value,
            })
            onUpdate?.(value)
          },
          onComplete: () => {
            const current = ctx.get(stateAtom)
            ctx.set(stateAtom, {
              ...current,
              current: newTarget,
              progress: 1,
              state: 'completed',
            })
            cancelAnimation = null
            onComplete?.()
          },
        },
        interpolate
      )
    }
  )

  // Action: snap immediately
  const snapToAtom: Atom.Writable<T, T> = Atom.writable(
    (get) => get(stateAtom).current,
    (ctx, value) => {
      cancelAnimation?.()
      cancelAnimation = null

      ctx.set(stateAtom, {
        current: value,
        target: value,
        previous: ctx.get(stateAtom).target,
        progress: 1,
        state: 'idle',
      })
    }
  )

  // Action: stop animation
  const stopAtom: Atom.Writable<void, void> = Atom.writable(
    () => undefined,
    (ctx) => {
      cancelAnimation?.()
      cancelAnimation = null

      const state = ctx.get(stateAtom)
      ctx.set(stateAtom, {
        ...state,
        state: 'paused',
      })
    }
  )

  // Action: reverse to previous target
  const reverseAtom: Atom.Writable<void, void> = Atom.writable(
    () => undefined,
    (ctx) => {
      const state = ctx.get(stateAtom)
      if (state.previous !== null) {
        ctx.set(animateToAtom, state.previous)
      }
    }
  )

  return {
    current: currentAtom,
    target: targetAtom,
    progress: progressAtom,
    state: stateValueAtom,
    animateTo: animateToAtom,
    snapTo: snapToAtom,
    stop: stopAtom,
    reverse: reverseAtom,
  }
}

// =============================================================================
// REACT HOOK
// =============================================================================

import { useAtomValue, useAtomSet } from '@effect-atom/atom-react'

/**
 * React hook for using an Animatable.
 *
 * @example
 * ```tsx
 * const scaleAtoms = animatable(1, { duration: 200 })
 *
 * function MyComponent() {
 *   const { value, to, snap, stop, reverse, progress, state } = useAnimatable(scaleAtoms)
 *
 *   return (
 *     <div style={{ transform: `scale(${value})` }}>
 *       <button onClick={() => to(1.5)}>Scale Up</button>
 *       <button onClick={() => reverse()}>Reverse</button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useAnimatable<T>(atoms: AnimatableAtoms<T>) {
  const value = useAtomValue(atoms.current)
  const target = useAtomValue(atoms.target)
  const progress = useAtomValue(atoms.progress)
  const state = useAtomValue(atoms.state)

  const to = useAtomSet(atoms.animateTo)
  const snap = useAtomSet(atoms.snapTo)
  const stop = useAtomSet(atoms.stop)
  const reverse = useAtomSet(atoms.reverse)

  return {
    value,
    target,
    progress,
    state,
    to,
    snap,
    stop,
    reverse,
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export const Animatable = {
  make: animatable,
  setDriver,
  getDriver,
  interpolators: {
    number: lerpNumber,
    object: lerpObject,
    array: lerpArray,
    color: lerpColor,
    auto: autoInterpolator,
  },
}

export default Animatable
