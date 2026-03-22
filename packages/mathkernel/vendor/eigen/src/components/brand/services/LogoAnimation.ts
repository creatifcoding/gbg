/**
 * Logo Animation Service
 *
 * Effect.Service for logo animations with runtime-swappable strategies.
 *
 * @module components/brand/services
 */

import { Context, Effect, Layer } from 'effect'
import { animate as animeAnimate, createTimeline } from 'animejs'
import type { AnimationConfig, LogoRefs, AnimationType } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
// Service Interface
// ─────────────────────────────────────────────────────────────────────────────

export interface LogoAnimationShape {
  /**
   * Animate the logo with the given configuration.
   * Returns a cleanup function.
   */
  readonly animate: (
    refs: LogoRefs,
    config: AnimationConfig
  ) => Effect.Effect<() => void>

  /**
   * Reset paths to initial state.
   */
  readonly reset: (
    refs: LogoRefs,
    fillColor: string
  ) => Effect.Effect<void>
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Tag
// ─────────────────────────────────────────────────────────────────────────────

export class LogoAnimation extends Context.Tag('brand/LogoAnimation')<
  LogoAnimation,
  LogoAnimationShape
>() {}

// ─────────────────────────────────────────────────────────────────────────────
// Animation Implementations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * No animation - just set fill immediately.
 */
const noneAnimation: LogoAnimationShape = {
  animate: (refs, config) =>
    Effect.sync(() => {
      refs.paths.forEach((path) => {
        if (path) {
          path.style.fill = config.fillColor
          path.style.stroke = 'transparent'
          path.style.opacity = '1'
        }
      })
      return () => {} // No cleanup needed
    }),

  reset: (refs, fillColor) =>
    Effect.sync(() => {
      refs.paths.forEach((path) => {
        if (path) {
          path.style.fill = fillColor
          path.style.stroke = 'transparent'
        }
      })
    }),
}

/**
 * Stroke draw animation - line drawing effect.
 */
const strokeDrawAnimation: LogoAnimationShape = {
  animate: (refs, config) =>
    Effect.sync(() => {
      const { paths, svg } = refs
      const validPaths = paths.filter((p): p is SVGPathElement => p !== null)

      if (validPaths.length === 0) return () => {}

      // Get path lengths
      const pathLengths = validPaths.map((p) => p.getTotalLength())

      // Set initial state
      validPaths.forEach((path, i) => {
        path.style.fill = 'transparent'
        path.style.stroke = config.strokeColor
        path.style.strokeWidth = '40'
        path.style.strokeDasharray = `${pathLengths[i]}`
        path.style.strokeDashoffset = `${pathLengths[i]}`
        path.style.opacity = '1'
      })

      // Create timeline
      const timeline = createTimeline({
        defaults: { ease: config.easing },
      })

      // Calculate phase timings
      const strokeDuration = config.duration * 0.6
      const fillDuration = config.duration * 0.4
      const staggerDelay = strokeDuration * 0.2

      // Phase 1: Draw strokes (staggered per path)
      validPaths.forEach((path, i) => {
        timeline.add(
          path,
          {
            strokeDashoffset: [pathLengths[i], 0],
            duration: strokeDuration,
          },
          config.delay + i * staggerDelay
        )
      })

      // Phase 2: Fade in fills, fade out strokes
      const fillStart = config.delay + strokeDuration - staggerDelay
      timeline.add(
        validPaths,
        {
          fill: ['transparent', config.fillColor],
          stroke: [config.strokeColor, 'transparent'],
          duration: fillDuration,
        },
        fillStart
      )

      timeline.play()

      // Return cleanup
      return () => {
        timeline.pause()
      }
    }),

  reset: (refs, fillColor) =>
    Effect.sync(() => {
      refs.paths.forEach((path) => {
        if (path) {
          path.style.fill = fillColor
          path.style.stroke = 'transparent'
          path.style.strokeDasharray = ''
          path.style.strokeDashoffset = ''
        }
      })
    }),
}

/**
 * Fade in animation - simple opacity fade.
 */
const fadeInAnimation: LogoAnimationShape = {
  animate: (refs, config) =>
    Effect.sync(() => {
      const { paths } = refs
      const validPaths = paths.filter((p): p is SVGPathElement => p !== null)

      if (validPaths.length === 0) return () => {}

      // Set initial state
      validPaths.forEach((path) => {
        path.style.fill = config.fillColor
        path.style.stroke = 'transparent'
        path.style.opacity = '0'
      })

      // Animate opacity
      const anim = animeAnimate(validPaths, {
        opacity: [0, 1],
        duration: config.duration,
        delay: config.delay,
        ease: config.easing,
      })

      return () => {
        anim.pause()
      }
    }),

  reset: (refs, fillColor) =>
    Effect.sync(() => {
      refs.paths.forEach((path) => {
        if (path) {
          path.style.fill = fillColor
          path.style.opacity = '1'
        }
      })
    }),
}

/**
 * Scale reveal animation - grow from center.
 */
const scaleRevealAnimation: LogoAnimationShape = {
  animate: (refs, config) =>
    Effect.sync(() => {
      const { svg, paths } = refs
      const validPaths = paths.filter((p): p is SVGPathElement => p !== null)

      if (!svg || validPaths.length === 0) return () => {}

      // Set initial state
      validPaths.forEach((path) => {
        path.style.fill = config.fillColor
        path.style.stroke = 'transparent'
      })
      svg.style.transform = 'scale(0)'
      svg.style.opacity = '0'

      // Animate scale
      const anim = animeAnimate(svg, {
        scale: [0, 1],
        opacity: [0, 1],
        duration: config.duration,
        delay: config.delay,
        ease: 'outBack(1.5)',
      })

      return () => {
        anim.pause()
      }
    }),

  reset: (refs, fillColor) =>
    Effect.sync(() => {
      if (refs.svg) {
        refs.svg.style.transform = ''
        refs.svg.style.opacity = '1'
      }
      refs.paths.forEach((path) => {
        if (path) {
          path.style.fill = fillColor
        }
      })
    }),
}

/**
 * Pulse animation - continuous breathing effect.
 */
const pulseAnimation: LogoAnimationShape = {
  animate: (refs, config) =>
    Effect.sync(() => {
      const { svg, paths } = refs
      const validPaths = paths.filter((p): p is SVGPathElement => p !== null)

      if (!svg || validPaths.length === 0) return () => {}

      // Set fill immediately
      validPaths.forEach((path) => {
        path.style.fill = config.fillColor
        path.style.stroke = 'transparent'
      })

      // Animate pulse
      const anim = animeAnimate(svg, {
        scale: [1, 1.05, 1],
        opacity: [1, 0.8, 1],
        duration: config.duration,
        delay: config.delay,
        ease: 'inOutSine',
        loop: true,
      })

      return () => {
        anim.pause()
      }
    }),

  reset: (refs, fillColor) =>
    Effect.sync(() => {
      if (refs.svg) {
        refs.svg.style.transform = ''
        refs.svg.style.opacity = '1'
      }
      refs.paths.forEach((path) => {
        if (path) {
          path.style.fill = fillColor
        }
      })
    }),
}

// ─────────────────────────────────────────────────────────────────────────────
// Animation Registry
// ─────────────────────────────────────────────────────────────────────────────

const ANIMATIONS: Record<AnimationType, LogoAnimationShape> = {
  'none': noneAnimation,
  'stroke-draw': strokeDrawAnimation,
  'fade-in': fadeInAnimation,
  'scale-reveal': scaleRevealAnimation,
  'pulse': pulseAnimation,
}

/**
 * Get animation implementation by type.
 */
export function getAnimationImpl(type: AnimationType): LogoAnimationShape {
  return ANIMATIONS[type]
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Layers
// ─────────────────────────────────────────────────────────────────────────────

export const StrokeDrawLayer = Layer.succeed(LogoAnimation, strokeDrawAnimation)
export const FadeInLayer = Layer.succeed(LogoAnimation, fadeInAnimation)
export const ScaleRevealLayer = Layer.succeed(LogoAnimation, scaleRevealAnimation)
export const PulseLayer = Layer.succeed(LogoAnimation, pulseAnimation)
export const NoneLayer = Layer.succeed(LogoAnimation, noneAnimation)

/**
 * Dynamic layer that selects animation based on type.
 */
export const DynamicLayer = (type: AnimationType) =>
  Layer.succeed(LogoAnimation, getAnimationImpl(type))
