/**
 * anime.js Animation Driver
 *
 * Specialized for SVG animations - reticle rings, path morphing, stagger effects.
 * Complements GSAP for lighter-weight SVG-specific animations.
 */

import { animate, createTimeline, stagger, utils } from 'animejs'
import type { AnimationDriver, Interpolator } from '../Animatable'
import type { TimelinePhase } from '../tokens'
import { COLORS, GEOMETRY, TIMING } from '../tokens'

// =============================================================================
// ANIME.JS DRIVER IMPLEMENTATION
// =============================================================================

export const animeDriver: AnimationDriver = {
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

    // Proxy object for anime.js to animate
    const proxy = { progress: 0 }

    const animation = animate(proxy, {
      progress: 1,
      duration,
      ease: typeof ease === 'string' ? ease : 'outQuad',
      onUpdate: () => {
        const value = interpolate(from, to, proxy.progress)
        onUpdate(value)
      },
      onComplete,
    })

    return () => {
      animation.pause()
    }
  },

  timeline<T>(
    phases: TimelinePhase<T>[],
    config: {
      onUpdate: (value: Partial<T>) => void
      onComplete: () => void
    }
  ) {
    const tl = createTimeline({
      autoplay: false,
      onComplete: config.onComplete,
    })

    let currentState: Partial<T> = {}

    phases.forEach((phase) => {
      const phaseProxy = { progress: 0 }
      const phaseStartState = { ...currentState }

      tl.add(phaseProxy, {
        progress: 1,
        duration: phase.duration,
        ease: phase.ease ?? 'outQuad',
        onUpdate: () => {
          const interpolated: Partial<T> = {}
          for (const key in phase.to) {
            const fromVal = (phaseStartState as Record<string, unknown>)[key] ?? 0
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
      }, phase.delay ? `+=${phase.delay}` : undefined)

      currentState = { ...currentState, ...phase.to }
    })

    return {
      play: () => tl.play(),
      pause: () => tl.pause(),
      reverse: () => tl.reverse(),
      seek: (time: number) => tl.seek(time),
      kill: () => tl.pause(),
    }
  },
}

// =============================================================================
// SVG-SPECIFIC ANIMATION UTILITIES
// =============================================================================

/**
 * Create concentric pulsing rings for reticle handles.
 * Returns cleanup function.
 */
export function createReticleRings(
  container: SVGElement | HTMLElement,
  center: { x: number; y: number },
  options: {
    ringCount?: number
    baseRadius?: number
    color?: string
    period?: number
    strokeWidth?: number
  } = {}
): { start: () => void; stop: () => void; destroy: () => void } {
  const {
    ringCount = GEOMETRY.reticle.ringCount,
    baseRadius = GEOMETRY.reticle.ringRadius,
    color = COLORS.reticle.primary,
    period = TIMING.reticle.pulsePeriod,
    strokeWidth = GEOMETRY.emanation.strokeWidth.primary,
  } = options

  // Create SVG rings
  const rings: SVGCircleElement[] = []
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'reticle-rings')
  svg.style.position = 'absolute'
  svg.style.pointerEvents = 'none'
  svg.style.overflow = 'visible'
  svg.style.left = `${center.x}px`
  svg.style.top = `${center.y}px`
  svg.style.width = '1px'
  svg.style.height = '1px'

  for (let i = 0; i < ringCount; i++) {
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    ring.setAttribute('cx', '0')
    ring.setAttribute('cy', '0')
    ring.setAttribute('r', String(baseRadius))
    ring.setAttribute('fill', 'none')
    ring.setAttribute('stroke', color)
    ring.setAttribute('stroke-width', String(strokeWidth))
    ring.style.opacity = '0'
    ring.style.transformOrigin = 'center'
    svg.appendChild(ring)
    rings.push(ring)
  }

  container.appendChild(svg)

  let timeline: ReturnType<typeof createTimeline> | null = null

  return {
    start() {
      timeline = createTimeline({
        loop: true,
      })

      rings.forEach((ring, i) => {
        const delay = (i * period) / ringCount

        timeline!.add(ring, {
          scale: [1, 1.5],
          opacity: [0.8, 0],
          duration: period,
          ease: 'outQuad',
        }, delay)
      })

      timeline.play()
    },

    stop() {
      timeline?.pause()
      rings.forEach((ring) => {
        utils.set(ring, { opacity: 0, scale: 1 })
      })
    },

    destroy() {
      timeline?.pause()
      svg.remove()
    },
  }
}

/**
 * Create crosshair reticle that expands on activation.
 */
export function createCrosshair(
  container: SVGElement | HTMLElement,
  center: { x: number; y: number },
  options: {
    armLength?: number
    gap?: number
    color?: string
    strokeWidth?: number
  } = {}
): { expand: () => Promise<void>; collapse: () => Promise<void>; destroy: () => void } {
  const {
    armLength = GEOMETRY.reticle.crosshairLength,
    gap = GEOMETRY.reticle.crosshairGap,
    color = COLORS.reticle.primary,
    strokeWidth = 1.5,
  } = options

  // Create SVG crosshair
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'reticle-crosshair')
  svg.style.position = 'absolute'
  svg.style.pointerEvents = 'none'
  svg.style.overflow = 'visible'
  svg.style.left = `${center.x}px`
  svg.style.top = `${center.y}px`

  // Four arms: top, right, bottom, left
  const arms: SVGLineElement[] = []
  const directions = [
    { x1: 0, y1: -gap, x2: 0, y2: -gap - armLength },      // Top
    { x1: gap, y1: 0, x2: gap + armLength, y2: 0 },        // Right
    { x1: 0, y1: gap, x2: 0, y2: gap + armLength },        // Bottom
    { x1: -gap, y1: 0, x2: -gap - armLength, y2: 0 },      // Left
  ]

  directions.forEach((dir) => {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    line.setAttribute('x1', String(dir.x1))
    line.setAttribute('y1', String(dir.y1))
    line.setAttribute('x2', String(dir.x1)) // Start collapsed
    line.setAttribute('y2', String(dir.y1))
    line.setAttribute('stroke', color)
    line.setAttribute('stroke-width', String(strokeWidth))
    line.setAttribute('stroke-linecap', 'round')
    line.dataset.targetX2 = String(dir.x2)
    line.dataset.targetY2 = String(dir.y2)
    svg.appendChild(line)
    arms.push(line)
  })

  container.appendChild(svg)

  return {
    async expand() {
      return new Promise((resolve) => {
        const tl = createTimeline({
          onComplete: () => resolve(),
        })

        arms.forEach((arm, i) => {
          tl.add(arm, {
            attr: {
              x2: arm.dataset.targetX2,
              y2: arm.dataset.targetY2,
            },
            duration: TIMING.reticle.expandDuration,
            ease: 'outBack',
          }, stagger(20, { start: 0 })[i])
        })

        tl.play()
      })
    },

    async collapse() {
      return new Promise((resolve) => {
        const tl = createTimeline({
          onComplete: () => resolve(),
        })

        arms.forEach((arm) => {
          const x1 = arm.getAttribute('x1')
          const y1 = arm.getAttribute('y1')

          tl.add(arm, {
            attr: {
              x2: x1,
              y2: y1,
            },
            duration: TIMING.reticle.collapseDuration,
            ease: 'inQuad',
          }, 0)
        })

        tl.play()
      })
    },

    destroy() {
      svg.remove()
    },
  }
}

/**
 * Create corner emanation effect with staggered rings.
 */
export function createCornerEmanation(
  container: SVGElement | HTMLElement,
  corner: { x: number; y: number },
  options: {
    colors?: {
      primary?: string
      secondary?: string
      tertiary?: string
    }
    onComplete?: () => void
  } = {}
): { play: () => void; destroy: () => void } {
  const colors = {
    primary: options.colors?.primary ?? COLORS.reticle.primary,
    secondary: options.colors?.secondary ?? COLORS.reticle.secondary,
    tertiary: options.colors?.tertiary ?? COLORS.reticle.tertiary,
  }

  // Create SVG container
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'corner-emanation')
  svg.style.position = 'absolute'
  svg.style.pointerEvents = 'none'
  svg.style.overflow = 'visible'
  svg.style.left = `${corner.x}px`
  svg.style.top = `${corner.y}px`

  // Create three rings
  const rings = ['primary', 'secondary', 'tertiary'].map((type, i) => {
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    ring.setAttribute('cx', '0')
    ring.setAttribute('cy', '0')
    ring.setAttribute('r', String(GEOMETRY.emanation.primaryRadius))
    ring.setAttribute('fill', 'none')
    ring.setAttribute('stroke', colors[type as keyof typeof colors])
    ring.setAttribute('stroke-width', String(
      type === 'primary'
        ? GEOMETRY.emanation.strokeWidth.primary
        : type === 'secondary'
          ? GEOMETRY.emanation.strokeWidth.secondary
          : GEOMETRY.emanation.strokeWidth.tertiary
    ))
    ring.style.opacity = '0'
    ring.style.transform = 'scale(0)'
    ring.style.transformOrigin = 'center'
    svg.appendChild(ring)
    return ring
  })

  container.appendChild(svg)

  return {
    play() {
      const tl = createTimeline({
        onComplete: () => {
          options.onComplete?.()
          svg.remove()
        },
      })

      // Phase 1: Primary ring (0-15ms)
      tl.add(rings[0], {
        scale: [0, 1],
        opacity: [0.8, 0.8],
        duration: TIMING.emanation.primary.duration,
        ease: 'outQuad',
      }, 0)

      // Phase 2: Secondary ring (15-35ms)
      tl.add(rings[1], {
        scale: [0, 1.1],
        opacity: [0.6, 0.6],
        duration: TIMING.emanation.secondary.duration,
        ease: 'outQuad',
      }, TIMING.emanation.secondary.start)

      // Phase 3: Tertiary ring with fade (35-50ms)
      tl.add(rings[2], {
        scale: [0, 1.3],
        opacity: [0.4, 0],
        duration: TIMING.emanation.tertiary.duration,
        ease: 'inQuad',
      }, TIMING.emanation.tertiary.start)

      // Fade out all rings after completion
      tl.add(rings, {
        opacity: 0,
        duration: 150,
        ease: 'outQuad',
      }, TIMING.emanation.total)

      tl.play()
    },

    destroy() {
      svg.remove()
    },
  }
}

/**
 * Create staggered multi-corner emanation effect.
 * Fires emanation from all four corners of a bounding box.
 */
export function createBoundsEmanation(
  container: SVGElement | HTMLElement,
  bounds: { x: number; y: number; width: number; height: number },
  options: {
    staggerDelay?: number
    onComplete?: () => void
  } = {}
): { play: () => void; destroy: () => void } {
  const { staggerDelay = 10, onComplete } = options

  const corners = [
    { x: bounds.x, y: bounds.y },                                    // TL
    { x: bounds.x + bounds.width, y: bounds.y },                     // TR
    { x: bounds.x + bounds.width, y: bounds.y + bounds.height },     // BR
    { x: bounds.x, y: bounds.y + bounds.height },                    // BL
  ]

  const emanations = corners.map((corner) =>
    createCornerEmanation(container, corner)
  )

  let completedCount = 0

  return {
    play() {
      emanations.forEach((emanation, i) => {
        setTimeout(() => {
          emanation.play()
          completedCount++
          if (completedCount === emanations.length) {
            // Wait for animations to finish
            setTimeout(onComplete, TIMING.emanation.total + 150)
          }
        }, i * staggerDelay)
      })
    },

    destroy() {
      emanations.forEach((e) => e.destroy())
    },
  }
}

export default animeDriver
