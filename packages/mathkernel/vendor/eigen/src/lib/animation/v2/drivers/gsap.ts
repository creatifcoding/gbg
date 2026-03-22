/**
 * Animation Library v2 - GSAP Driver
 *
 * Simple driver that runs animations using GSAP.
 * No timeline abstraction - use gsap.timeline() directly for sequences.
 */

import { gsap } from 'gsap'
import type { AnimationDriver, AnimationValue } from '../types'
import { getInterpolator } from '../interpolators'

// =============================================================================
// GSAP DRIVER
// =============================================================================

/**
 * GSAP-based animation driver.
 *
 * Uses a progress proxy to animate any value type.
 * GSAP handles timing, easing, and RAF management.
 */
export const gsapDriver: AnimationDriver = {
  run<T extends AnimationValue>(config: {
    readonly from: T
    readonly to: T
    readonly duration: number
    readonly ease: string | ((t: number) => number)
    readonly onTick: (value: T, progress: number) => void
    readonly onComplete: () => void
  }): () => void {
    const { from, to, duration, ease, onTick, onComplete } = config

    // Get the appropriate interpolator for this value type
    const interpolate = getInterpolator(from)

    // Proxy object for GSAP to tween
    const proxy = { progress: 0 }

    // Create the tween
    const tween = gsap.to(proxy, {
      progress: 1,
      duration: duration / 1000, // GSAP uses seconds
      ease: typeof ease === 'string' ? ease : 'power2.out',
      onUpdate: () => {
        const value = interpolate(from, to, proxy.progress)
        onTick(value, proxy.progress)
      },
      onComplete,
    })

    // Return cancel function
    return () => {
      tween.kill()
    }
  },
}

// =============================================================================
// EASING PRESETS
// =============================================================================

/**
 * Common easing presets for GSAP.
 *
 * These are just strings that GSAP understands.
 * Use them for consistency across the app.
 */
export const GSAP_EASE = {
  // Standard
  linear: 'none',

  // Power easings (most common)
  easeOut: 'power2.out',
  easeIn: 'power2.in',
  easeInOut: 'power2.inOut',

  // Snappy
  snapOut: 'power3.out',
  snapIn: 'power3.in',

  // Bouncy
  backOut: 'back.out(1.7)',
  backIn: 'back.in(1.7)',

  // Elastic
  elasticOut: 'elastic.out(1, 0.3)',
  elasticIn: 'elastic.in(1, 0.3)',

  // Mechanical (for robotic precision)
  mechanical: 'none',

  // UI defaults
  uiEnter: 'power2.out',
  uiExit: 'power2.in',
  uiMove: 'power2.inOut',
} as const

export type GsapEase = (typeof GSAP_EASE)[keyof typeof GSAP_EASE]

// =============================================================================
// DIRECT GSAP UTILITIES
// =============================================================================

/**
 * These are NOT part of the Animatable system.
 * They're direct GSAP utilities for DOM manipulation.
 * Use them when you need to animate actual elements.
 */

/** Fade an element */
export function fadeElement(
  element: Element,
  to: number,
  options: { duration?: number; ease?: string; onComplete?: () => void } = {}
): gsap.core.Tween {
  const { duration = 300, ease = GSAP_EASE.easeOut, onComplete } = options
  return gsap.to(element, {
    opacity: to,
    duration: duration / 1000,
    ease,
    onComplete,
  })
}

/** Scale an element */
export function scaleElement(
  element: Element,
  to: number,
  options: { duration?: number; ease?: string; onComplete?: () => void } = {}
): gsap.core.Tween {
  const { duration = 300, ease = GSAP_EASE.easeOut, onComplete } = options
  return gsap.to(element, {
    scale: to,
    duration: duration / 1000,
    ease,
    onComplete,
  })
}

/** Move an element */
export function moveElement(
  element: Element,
  to: { x?: number; y?: number },
  options: { duration?: number; ease?: string; onComplete?: () => void } = {}
): gsap.core.Tween {
  const { duration = 300, ease = GSAP_EASE.easeOut, onComplete } = options
  return gsap.to(element, {
    ...to,
    duration: duration / 1000,
    ease,
    onComplete,
  })
}

/** Create a GSAP context for React cleanup */
export function createGsapContext(scope?: Element | string): {
  add: (animation: gsap.core.Animation) => void
  revert: () => void
  kill: () => void
} {
  const ctx = gsap.context(() => {}, scope)

  return {
    add: (animation) => ctx.add(() => animation),
    revert: () => ctx.revert(),
    kill: () => ctx.kill(),
  }
}

export default gsapDriver
