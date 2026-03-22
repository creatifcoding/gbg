/**
 * Card Stack Animation
 *
 * Clean, no-bullshit drawer animation.
 * Slide + subtle scale parallax. Stack depth awareness.
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

export interface StackDepthConfig {
  /** Offset per depth level (px) - how much each card peeks */
  offsetPerLevel: number
  /** Scale reduction per depth level */
  scalePerLevel: number
  /** Opacity reduction per depth level */
  opacityPerLevel: number
  /** Animation duration (ms) */
  duration: number
  /** Easing function */
  ease: string
}

export const DEFAULT_CARD_STACK_CONFIG: CardStackConfig = {
  duration: 250,
  scaleStart: 0.98,
  ease: 'outQuart',
}

export const DEFAULT_STACK_DEPTH_CONFIG: StackDepthConfig = {
  offsetPerLevel: 16,
  scalePerLevel: 0.03,
  opacityPerLevel: 0.15,
  duration: 200,
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
// STACK DEPTH (Recessed card effect)
// =============================================================================

/**
 * Get offset direction based on drawer side.
 * Cards recede in the opposite direction of the drawer edge.
 */
function getDepthOffset(
  side: DrawerSide,
  depth: number,
  offsetPerLevel: number
): { x: number; y: number } {
  const offset = depth * offsetPerLevel
  switch (side) {
    case 'right':
      return { x: -offset, y: 0 } // Peek left
    case 'left':
      return { x: offset, y: 0 } // Peek right
    case 'bottom':
      return { x: 0, y: -offset } // Peek up
    case 'top':
      return { x: 0, y: offset } // Peek down
  }
}

/**
 * Animate drawer to its stack depth position.
 * depth 0 = topmost (no recession), depth 1+ = recessed cards.
 */
export function animateStackDepth(
  element: HTMLElement,
  depth: number,
  side: DrawerSide = 'right',
  config: Partial<StackDepthConfig> = {}
): Promise<void> {
  const c = { ...DEFAULT_STACK_DEPTH_CONFIG, ...config }
  const { x, y } = getDepthOffset(side, depth, c.offsetPerLevel)

  const scale = Math.max(0.85, 1 - depth * c.scalePerLevel)
  const opacity = Math.max(0.4, 1 - depth * c.opacityPerLevel)

  return new Promise((resolve) => {
    animate(element, {
      translateX: `${x}px`,
      translateY: `${y}px`,
      scale,
      opacity,
      duration: c.duration,
      ease: c.ease,
    })
    setTimeout(resolve, c.duration)
  })
}

/**
 * Apply stack depth styles instantly (no animation).
 * Use for initial render of already-recessed cards.
 */
export function applyStackDepth(
  element: HTMLElement,
  depth: number,
  side: DrawerSide = 'right',
  config: Partial<StackDepthConfig> = {}
): void {
  const c = { ...DEFAULT_STACK_DEPTH_CONFIG, ...config }
  const { x, y } = getDepthOffset(side, depth, c.offsetPerLevel)

  const scale = Math.max(0.85, 1 - depth * c.scalePerLevel)
  const opacity = Math.max(0.4, 1 - depth * c.opacityPerLevel)

  element.style.transform = `translateX(${x}px) translateY(${y}px) scale(${scale})`
  element.style.opacity = `${opacity}`
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
