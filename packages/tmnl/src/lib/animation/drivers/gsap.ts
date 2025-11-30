/**
 * GSAP Animation Driver
 *
 * Provides sub-millisecond precision for timeline animations.
 * Used for the corner emanation reticle system.
 */

import { gsap } from 'gsap'
import type { AnimationDriver, Interpolator } from '../Animatable'
import type { TimelinePhase } from '../tokens'

// =============================================================================
// GSAP DRIVER IMPLEMENTATION
// =============================================================================

export const gsapDriver: AnimationDriver = {
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
    const { duration, ease, onUpdate, onComplete } = config

    // Proxy object for GSAP to tween
    const proxy = { progress: 0 }

    const tween = gsap.to(proxy, {
      progress: 1,
      duration: duration / 1000, // GSAP uses seconds
      ease: typeof ease === 'string' ? ease : 'power2.out',
      onUpdate: () => {
        const value = interpolate(from, to, proxy.progress)
        onUpdate(value)
      },
      onComplete,
    })

    return () => {
      tween.kill()
    }
  },

  timeline<T>(
    phases: TimelinePhase<T>[],
    config: {
      onUpdate: (value: Partial<T>) => void
      onComplete: () => void
    }
  ) {
    const tl = gsap.timeline({
      paused: true,
      onComplete: config.onComplete,
    })

    // Track the accumulated state across phases
    let currentState: Partial<T> = {}

    phases.forEach((phase, index) => {
      // Create a proxy for this phase
      const phaseProxy = { progress: 0 }
      const phaseStartState = { ...currentState }
      const phaseEndState = { ...phaseStartState, ...phase.to }

      // Calculate position in timeline
      const position = phase.delay
        ? `+=${phase.delay / 1000}`
        : index === 0
          ? 0
          : undefined

      tl.to(
        phaseProxy,
        {
          progress: 1,
          duration: phase.duration / 1000,
          ease: phase.ease ?? 'power2.out',
          onUpdate: () => {
            // Interpolate each property
            const interpolated: Partial<T> = {}
            for (const key in phase.to) {
              const fromVal = (phaseStartState as Record<string, unknown>)[key]
              const toVal = (phase.to as Record<string, unknown>)[key]

              if (typeof fromVal === 'number' && typeof toVal === 'number') {
                ;(interpolated as Record<string, unknown>)[key] =
                  fromVal + (toVal - fromVal) * phaseProxy.progress
              } else {
                ;(interpolated as Record<string, unknown>)[key] =
                  phaseProxy.progress < 1 ? fromVal : toVal
              }
            }

            currentState = { ...currentState, ...interpolated }
            config.onUpdate(currentState)
          },
        },
        position
      )

      // Update current state for next phase
      currentState = phaseEndState

      // Add label if provided
      if (phase.label) {
        tl.addLabel(phase.label)
      }
    })

    return {
      play: () => tl.play(),
      pause: () => tl.pause(),
      reverse: () => tl.reverse(),
      seek: (time: number) => tl.seek(time / 1000),
      kill: () => tl.kill(),
    }
  },
}

// =============================================================================
// SPECIALIZED GSAP UTILITIES
// =============================================================================

/**
 * Create a corner emanation timeline with precise sub-50ms phases.
 */
export function createEmanationTimeline(
  targets: {
    primary: HTMLElement | SVGElement
    secondary: HTMLElement | SVGElement
    tertiary: HTMLElement | SVGElement
  },
  options: {
    origin: { x: number; y: number }
    colors?: {
      primary?: string
      secondary?: string
      tertiary?: string
    }
    onComplete?: () => void
  }
): gsap.core.Timeline {
  const { origin, colors, onComplete } = options

  const tl = gsap.timeline({
    paused: true,
    onComplete,
  })

  // Phase 1: Primary ring (0-15ms)
  tl.fromTo(
    targets.primary,
    {
      scale: 0,
      opacity: 0.8,
      x: origin.x,
      y: origin.y,
      transformOrigin: 'center center',
    },
    {
      scale: 1,
      opacity: 0.8,
      duration: 0.015, // 15ms
      ease: 'power2.out',
    },
    0
  )

  // Phase 2: Secondary ring (15-35ms)
  tl.fromTo(
    targets.secondary,
    {
      scale: 0,
      opacity: 0.6,
      x: origin.x,
      y: origin.y,
      transformOrigin: 'center center',
    },
    {
      scale: 1.1,
      opacity: 0.6,
      duration: 0.020, // 20ms
      ease: 'power1.out',
    },
    0.015 // Start at 15ms
  )

  // Phase 3: Tertiary ring with fade (35-50ms)
  tl.fromTo(
    targets.tertiary,
    {
      scale: 0,
      opacity: 0.4,
      x: origin.x,
      y: origin.y,
      transformOrigin: 'center center',
    },
    {
      scale: 1.3,
      opacity: 0,
      duration: 0.015, // 15ms
      ease: 'power1.in',
    },
    0.035 // Start at 35ms
  )

  // Apply colors if provided
  if (colors?.primary) {
    gsap.set(targets.primary, { stroke: colors.primary })
  }
  if (colors?.secondary) {
    gsap.set(targets.secondary, { stroke: colors.secondary })
  }
  if (colors?.tertiary) {
    gsap.set(targets.tertiary, { stroke: colors.tertiary })
  }

  return tl
}

/**
 * Create an elastic snap animation for grid snapping feedback.
 */
export function createSnapAnimation(
  target: HTMLElement | SVGElement,
  to: { x: number; y: number },
  options: {
    overshoot?: number
    duration?: number
    onComplete?: () => void
  } = {}
): gsap.core.Tween {
  const { overshoot = 1.5, duration = 200, onComplete } = options

  return gsap.to(target, {
    x: to.x,
    y: to.y,
    duration: duration / 1000,
    ease: `elastic.out(1, ${1 / overshoot})`,
    onComplete,
  })
}

/**
 * Create a momentum trail effect for dragged shapes.
 */
export function createTrailGhost(
  template: HTMLElement | SVGElement,
  position: { x: number; y: number },
  velocity: { x: number; y: number },
  options: {
    fadeDuration?: number
    scaleDecay?: number
    container: HTMLElement
    onComplete?: () => void
  }
): gsap.core.Tween {
  const {
    fadeDuration = 200,
    scaleDecay = 0.95,
    container,
    onComplete,
  } = options

  // Clone the template
  const ghost = template.cloneNode(true) as HTMLElement | SVGElement
  ghost.style.position = 'absolute'
  ghost.style.pointerEvents = 'none'
  ghost.style.opacity = '0.3'

  // Position at current location
  gsap.set(ghost, {
    x: position.x,
    y: position.y,
    scale: scaleDecay,
  })

  container.appendChild(ghost)

  // Fade out and remove
  return gsap.to(ghost, {
    opacity: 0,
    scale: scaleDecay * 0.8,
    duration: fadeDuration / 1000,
    ease: 'power1.out',
    onComplete: () => {
      ghost.remove()
      onComplete?.()
    },
  })
}

/**
 * Create a reticle pulse animation for resize handles.
 */
export function createReticlePulse(
  rings: (HTMLElement | SVGElement)[],
  options: {
    period?: number
    maxScale?: number
    infinite?: boolean
  } = {}
): gsap.core.Timeline {
  const { period = 800, maxScale = 1.2, infinite = true } = options

  const tl = gsap.timeline({
    repeat: infinite ? -1 : 0,
    paused: true,
  })

  rings.forEach((ring, index) => {
    const delay = (index * period) / rings.length / 1000

    tl.fromTo(
      ring,
      {
        scale: 1,
        opacity: 0.8,
      },
      {
        scale: maxScale,
        opacity: 0,
        duration: period / 1000,
        ease: 'power1.out',
      },
      delay
    )
  })

  return tl
}

// =============================================================================
// GSAP CONTEXT HELPER FOR REACT
// =============================================================================

/**
 * Create a GSAP context for React component cleanup.
 * Use with useGSAP from @gsap/react or manually in useEffect.
 */
export function createAnimationContext(scope?: Element | string) {
  const ctx = gsap.context(() => {}, scope)

  return {
    context: ctx,

    /** Add an animation to this context */
    add<T extends gsap.core.Animation>(animation: T): T {
      ctx.add(() => animation)
      return animation
    },

    /** Revert all animations in this context */
    revert() {
      ctx.revert()
    },

    /** Kill all animations in this context */
    kill() {
      ctx.kill()
    },
  }
}

export default gsapDriver
