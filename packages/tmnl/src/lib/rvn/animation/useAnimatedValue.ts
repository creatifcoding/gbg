/**
 * useAnimatedValue - Anime.js Powered Value Animation Hook
 *
 * Provides butter-smooth animation for numeric values using anime.js.
 * Used by RvnTelemetryBar, RvnProgressBar, RvnThreatMeter, RvnMeter.
 *
 * Features:
 * - Spring physics for organic feel
 * - Stepped animation with anime.js steps() easing
 * - Elastic, bounce, and back easings
 * - Proper cleanup on unmount and value changes
 */

import { useState, useEffect, useRef } from 'react'
import { animate, type JSAnimation } from 'animejs'

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface BarAnimationConfig {
  /** Enable animation (default: true) */
  enabled?: boolean
  /** Animation duration in ms (default: 400) */
  duration?: number
  /** Anime.js easing string (default: 'easeOutQuart') */
  easing?: AnimationEasing
  /** Use stepped animation instead of smooth */
  stepped?: boolean
  /** Number of discrete steps for stepped animation */
  steps?: number
  /** Spring physics config: [mass, stiffness, damping, velocity] */
  spring?: [number, number, number, number]
  /** Callback fired on each animation frame */
  onUpdate?: (value: number) => void
  /** Callback fired when animation completes */
  onComplete?: (value: number) => void
}

/**
 * Anime.js easing types - includes all built-in easings plus spring/steps
 */
export type AnimationEasing =
  // Linear
  | 'linear'
  // Quad
  | 'easeInQuad'
  | 'easeOutQuad'
  | 'easeInOutQuad'
  // Cubic
  | 'easeInCubic'
  | 'easeOutCubic'
  | 'easeInOutCubic'
  // Quart (smoother than cubic)
  | 'easeInQuart'
  | 'easeOutQuart'
  | 'easeInOutQuart'
  // Quint (smoothest polynomial)
  | 'easeInQuint'
  | 'easeOutQuint'
  | 'easeInOutQuint'
  // Sine
  | 'easeInSine'
  | 'easeOutSine'
  | 'easeInOutSine'
  // Expo
  | 'easeInExpo'
  | 'easeOutExpo'
  | 'easeInOutExpo'
  // Circ
  | 'easeInCirc'
  | 'easeOutCirc'
  | 'easeInOutCirc'
  // Elastic (springy overshoot)
  | 'easeInElastic'
  | 'easeOutElastic'
  | 'easeInOutElastic'
  // Back (anticipation/overshoot)
  | 'easeInBack'
  | 'easeOutBack'
  | 'easeInOutBack'
  // Bounce
  | 'easeInBounce'
  | 'easeOutBounce'
  | 'easeInOutBounce'
  // Spring (custom via spring config)
  | 'spring'
  // Steps (discrete)
  | 'steps'

// -----------------------------------------------------------------------------
// Utility Functions
// -----------------------------------------------------------------------------

/**
 * Quantize a value to the nearest step.
 * @param value - Value to quantize (0-100)
 * @param steps - Number of steps (e.g., 10 = 10% increments)
 */
export function quantizeValue(value: number, steps: number): number {
  const stepSize = 100 / steps
  return Math.round(value / stepSize) * stepSize
}

/**
 * Build anime.js easing string from config
 */
function buildEasing(config: BarAnimationConfig): string {
  const { easing = 'easeOutQuart', stepped, steps = 10, spring } = config

  // Spring physics takes priority
  if (spring || easing === 'spring') {
    const [mass, stiffness, damping, velocity] = spring ?? [1, 100, 10, 0]
    return `spring(${mass}, ${stiffness}, ${damping}, ${velocity})`
  }

  // Stepped animation
  if (stepped || easing === 'steps') {
    return `steps(${steps})`
  }

  return easing
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

/**
 * Animate a numeric value using anime.js for butter-smooth interpolation.
 *
 * @example Smooth animation (default)
 * ```tsx
 * const animatedValue = useAnimatedValue(percentage)
 * ```
 *
 * @example Spring physics
 * ```tsx
 * const animatedValue = useAnimatedValue(percentage, {
 *   spring: [1, 100, 10, 0], // mass, stiffness, damping, velocity
 * })
 * ```
 *
 * @example Elastic overshoot
 * ```tsx
 * const animatedValue = useAnimatedValue(percentage, {
 *   easing: 'easeOutElastic',
 *   duration: 800,
 * })
 * ```
 *
 * @example Stepped animation
 * ```tsx
 * const animatedValue = useAnimatedValue(percentage, {
 *   stepped: true,
 *   steps: 10,
 *   duration: 500,
 * })
 * ```
 */
export function useAnimatedValue(
  targetValue: number,
  config: BarAnimationConfig = {}
): number {
  const { enabled = true, duration = 400, onUpdate, onComplete } = config

  const [animatedValue, setAnimatedValue] = useState(targetValue)
  const animationRef = useRef<JSAnimation | null>(null)
  const valueObjRef = useRef({ value: targetValue })
  const isFirstRender = useRef(true)

  useEffect(() => {
    // On first render, set initial value without animation
    if (isFirstRender.current) {
      isFirstRender.current = false
      valueObjRef.current.value = targetValue
      setAnimatedValue(targetValue)
      return
    }

    // If animation disabled, set immediately
    if (!enabled) {
      valueObjRef.current.value = targetValue
      setAnimatedValue(targetValue)
      return
    }

    // Skip if already at target (within floating point tolerance)
    if (Math.abs(valueObjRef.current.value - targetValue) < 0.001) {
      return
    }

    // Cancel any running animation
    if (animationRef.current) {
      animationRef.current.pause()
      animationRef.current = null
    }

    // Build easing string
    const easingStr = buildEasing(config)

    // Animate the value object
    animationRef.current = animate(valueObjRef.current, {
      value: targetValue,
      duration,
      easing: easingStr,
      onUpdate: () => {
        const currentValue = valueObjRef.current.value
        setAnimatedValue(currentValue)
        onUpdate?.(currentValue)
      },
      onComplete: () => {
        // Ensure we land exactly on target
        valueObjRef.current.value = targetValue
        setAnimatedValue(targetValue)
        onComplete?.(targetValue)
        animationRef.current = null
      },
    })

    // Cleanup on unmount or when target changes
    return () => {
      if (animationRef.current) {
        animationRef.current.pause()
        animationRef.current = null
      }
    }
  }, [targetValue, enabled, duration, config, onUpdate, onComplete])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        animationRef.current.pause()
        animationRef.current = null
      }
    }
  }, [])

  return enabled ? animatedValue : targetValue
}

// -----------------------------------------------------------------------------
// Presets
// -----------------------------------------------------------------------------

/**
 * Pre-configured animation configs for common use cases.
 * Now with anime.js spring physics and elastic easings.
 */
export const BAR_ANIMATION_PRESETS = {
  /** No animation - instant updates */
  none: {
    enabled: false,
  },

  /** Fast smooth animation (200ms) */
  fast: {
    enabled: true,
    duration: 200,
    easing: 'easeOutQuart' as const,
  },

  /** Default smooth animation (400ms, quart easing) */
  smooth: {
    enabled: true,
    duration: 400,
    easing: 'easeOutQuart' as const,
  },

  /** Slow smooth animation (600ms) */
  slow: {
    enabled: true,
    duration: 600,
    easing: 'easeOutQuint' as const,
  },

  /** Spring physics - organic, natural feel */
  spring: {
    enabled: true,
    spring: [1, 100, 10, 0] as [number, number, number, number],
  },

  /** Snappy spring - quick settle */
  springSnappy: {
    enabled: true,
    spring: [1, 180, 12, 0] as [number, number, number, number],
  },

  /** Bouncy spring - playful overshoot */
  springBouncy: {
    enabled: true,
    spring: [1, 80, 8, 0] as [number, number, number, number],
  },

  /** Elastic overshoot - rubberband effect */
  elastic: {
    enabled: true,
    duration: 800,
    easing: 'easeOutElastic' as const,
  },

  /** Back easing - anticipation/overshoot */
  back: {
    enabled: true,
    duration: 500,
    easing: 'easeOutBack' as const,
  },

  /** Bounce - ball drop effect */
  bounce: {
    enabled: true,
    duration: 800,
    easing: 'easeOutBounce' as const,
  },

  /** Coarse stepped (25% increments / 4 steps) */
  steppedCoarse: {
    enabled: true,
    stepped: true,
    steps: 4,
    duration: 400,
  },

  /** Medium stepped (10% increments / 10 steps) */
  steppedMedium: {
    enabled: true,
    stepped: true,
    steps: 10,
    duration: 500,
  },

  /** Fine stepped (5% increments / 20 steps) */
  steppedFine: {
    enabled: true,
    stepped: true,
    steps: 20,
    duration: 500,
  },

  /** Ultra-fine stepped (2% increments / 50 steps) */
  steppedUltraFine: {
    enabled: true,
    stepped: true,
    steps: 50,
    duration: 600,
  },

  /** Binary stepped (50% increments / 2 steps) */
  steppedBinary: {
    enabled: true,
    stepped: true,
    steps: 2,
    duration: 300,
  },

  /** Tactical - fast expo for ops consoles */
  tactical: {
    enabled: true,
    duration: 250,
    easing: 'easeOutExpo' as const,
  },

  /** Cinematic - slow dramatic reveal */
  cinematic: {
    enabled: true,
    duration: 1200,
    easing: 'easeInOutQuint' as const,
  },
} as const satisfies Record<string, BarAnimationConfig>

export type BarAnimationPreset = keyof typeof BAR_ANIMATION_PRESETS
