/**
 * Rolodex Animation
 *
 * Isometric card-stack transition using anime.js v4.
 * - Exit: lift + rotateX + blur + fade
 * - Enter: inverse rise + sharpen + hairline border strobe
 *
 * @module
 */

import { animate, createTimeline } from 'animejs'
import type { RolodexConfig } from '../types'
import { DEFAULT_ROLODEX_CONFIG } from '../types'

// =============================================================================
// ROLODEX OUT (Exit Animation)
// =============================================================================

/**
 * Animate drawer exiting with rolodex lift effect.
 *
 * Phase 1 (0-70%): Lift + blur + fade to 0.3
 * Phase 2 (70-100%): Complete fade to 0
 *
 * @param element - DOM element to animate
 * @param config - Animation configuration
 * @returns Promise that resolves when animation completes
 */
export function rolodexOut(
  element: HTMLElement,
  config: Partial<RolodexConfig> = {}
): Promise<void> {
  const c = { ...DEFAULT_ROLODEX_CONFIG, ...config }

  const timeline = createTimeline({
    defaults: { ease: 'outQuart' },
  })

  // Phase 1: Lift + blur + fade (0-70%)
  timeline.add(
    element,
    {
      translateY: -c.liftDistance,
      translateZ: -50,
      rotateX: c.rotateX,
      filter: `blur(${c.blurMax}px)`,
      opacity: [1, 0.3],
      duration: c.duration * 0.7,
    },
    0
  )

  // Phase 2: Complete fade (70-100%)
  timeline.add(
    element,
    {
      opacity: 0,
      duration: c.duration * 0.3,
    },
    c.duration * 0.7
  )

  return new Promise((resolve) => {
    timeline.play()
    // anime.js v4 doesn't have .finished, use setTimeout
    setTimeout(resolve, c.duration)
  })
}

// =============================================================================
// ROLODEX IN (Enter Animation)
// =============================================================================

/**
 * Animate drawer entering with rolodex rise effect.
 *
 * Phase 1 (0-70%): Rise + sharpen + fade from 0.3
 * Phase 2 (70-100%): Hairline border strobe (cyan pulse)
 *
 * @param element - DOM element to animate
 * @param config - Animation configuration
 * @returns Promise that resolves when animation completes
 */
export function rolodexIn(
  element: HTMLElement,
  config: Partial<RolodexConfig> = {}
): Promise<void> {
  const c = { ...DEFAULT_ROLODEX_CONFIG, ...config }

  // Set initial state: below, rotated, blurred
  element.style.transform = `translateY(${c.liftDistance}px) translateZ(-50px) rotateX(${-c.rotateX}deg)`
  element.style.filter = `blur(${c.blurMax}px)`
  element.style.opacity = '0'

  const timeline = createTimeline({
    defaults: { ease: 'outQuart' },
  })

  // Phase 1: Rise + sharpen (0-70%)
  timeline.add(
    element,
    {
      translateY: 0,
      translateZ: 0,
      rotateX: 0,
      filter: 'blur(0px)',
      opacity: [0.3, 1],
      duration: c.duration * 0.7,
    },
    0
  )

  // Phase 2: Hairline strobe (70-100%)
  timeline.add(
    element,
    {
      boxShadow: [
        '0 0 0 1px transparent',
        `0 0 0 1px ${c.strobeColor}`,
        '0 0 0 1px transparent',
      ],
      duration: c.strobeDuration,
    },
    c.duration * 0.7
  )

  return new Promise((resolve) => {
    timeline.play()
    setTimeout(resolve, c.duration)
  })
}

// =============================================================================
// ROLODEX SWITCH (Combined exit/enter for drawer replacement)
// =============================================================================

/**
 * Animate switching between two drawers with rolodex effect.
 * Runs exit and enter in parallel with slight stagger.
 *
 * @param exitElement - Element to animate out
 * @param enterElement - Element to animate in
 * @param config - Animation configuration
 * @returns Promise that resolves when both animations complete
 */
export async function rolodexSwitch(
  exitElement: HTMLElement,
  enterElement: HTMLElement,
  config: Partial<RolodexConfig> = {}
): Promise<void> {
  const c = { ...DEFAULT_ROLODEX_CONFIG, ...config }

  // Stagger enter by 30% of exit duration for overlap
  const stagger = c.duration * 0.3

  const exitPromise = rolodexOut(exitElement, c)
  const enterPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      rolodexIn(enterElement, c).then(resolve)
    }, stagger)
  })

  await Promise.all([exitPromise, enterPromise])
}

// =============================================================================
// UTILITY: Reset element styles after animation
// =============================================================================

/**
 * Reset element styles to neutral state after animation.
 */
export function resetRolodexStyles(element: HTMLElement): void {
  element.style.transform = ''
  element.style.filter = ''
  element.style.opacity = ''
  element.style.boxShadow = ''
}
