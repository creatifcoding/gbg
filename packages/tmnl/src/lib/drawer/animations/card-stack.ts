/**
 * Card Stack Animation
 *
 * Clean, no-bullshit drawer animation.
 * Slide + subtle scale parallax. That's it.
 *
 * @module
 */

import { animate } from 'animejs'
import type { DrawerSide } from '../types'

// =============================================================================
// CONFIG
// =============================================================================

export interface CardStackConfig {
  /** Animation duration (ms) */
  duration: number
  /** Scale factor at start (0.98 = subtle, 0.9 = dramatic) */
  scaleStart: number
  /** Easing function */
  ease: string
}

export const DEFAULT_CARD_STACK_CONFIG: CardStackConfig = {
  duration: 250,
  scaleStart: 0.98,
  ease: 'outQuart',
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Get initial transform based on drawer side.
 */
function getOffscreenTransform(side: DrawerSide): { x: string; y: string } {
  switch (side) {
    case 'right':
      return { x: '100%', y: '0' }
    case 'left':
      return { x: '-100%', y: '0' }
    case 'bottom':
      return { x: '0', y: '100%' }
    case 'top':
      return { x: '0', y: '-100%' }
  }
}

// =============================================================================
// CARD STACK IN (Enter)
// =============================================================================

/**
 * Animate drawer entering.
 * Slide from edge with subtle scale-up.
 */
export function cardStackIn(
  element: HTMLElement,
  side: DrawerSide = 'right',
  config: Partial<CardStackConfig> = {}
): Promise<void> {
  const c = { ...DEFAULT_CARD_STACK_CONFIG, ...config }
  const offset = getOffscreenTransform(side)

  // Set initial state: offscreen + scaled down
  element.style.transform = `translateX(${offset.x}) translateY(${offset.y}) scale(${c.scaleStart})`
  element.style.opacity = '1'

  return new Promise((resolve) => {
    animate(element, {
      translateX: '0%',
      translateY: '0%',
      scale: 1,
      duration: c.duration,
      ease: c.ease,
    })
    setTimeout(resolve, c.duration)
  })
}

// =============================================================================
// CARD STACK OUT (Exit)
// =============================================================================

/**
 * Animate drawer exiting.
 * Slide to edge with subtle scale-down.
 */
export function cardStackOut(
  element: HTMLElement,
  side: DrawerSide = 'right',
  config: Partial<CardStackConfig> = {}
): Promise<void> {
  const c = { ...DEFAULT_CARD_STACK_CONFIG, ...config }
  const offset = getOffscreenTransform(side)

  return new Promise((resolve) => {
    animate(element, {
      translateX: offset.x,
      translateY: offset.y,
      scale: c.scaleStart,
      duration: c.duration,
      ease: c.ease,
    })
    setTimeout(resolve, c.duration)
  })
}

// =============================================================================
// RESET
// =============================================================================

/**
 * Reset element styles to neutral state.
 */
export function resetCardStackStyles(element: HTMLElement): void {
  element.style.transform = ''
  element.style.opacity = ''
}
