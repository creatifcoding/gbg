/**
 * Parallax Lift Animation
 *
 * 3D card fan effect for stacked drawers.
 * Each layer lifts by decreasing amounts creating visual depth hierarchy.
 *
 * @module
 */

import { animate } from 'animejs'
import type { ParallaxConfig } from '../types'
import { DEFAULT_PARALLAX_CONFIG } from '../types'

// =============================================================================
// PARALLAX LIFT STACK
// =============================================================================

/**
 * Apply parallax lift effect to a stack of drawer elements.
 * Creates a 3D card fan with deeper layers appearing more recessed.
 *
 * @param drawers - Array of drawer elements (index 0 = bottom, last = top)
 * @param config - Animation configuration
 * @returns Promise that resolves when all animations complete
 */
export function parallaxLiftStack(
  drawers: HTMLElement[],
  config: Partial<ParallaxConfig> = {}
): Promise<void> {
  const c = { ...DEFAULT_PARALLAX_CONFIG, ...config }

  const animations = drawers.map((el, i) => {
    // depth: 0 = top (no effect), higher = further back
    const depth = drawers.length - i - 1

    return animate(el, {
      translateY: -depth * c.liftPerLayer,
      rotateX: -depth * c.rotatePerLayer,
      filter: `blur(${depth * c.blurPerLayer}px)`,
      opacity: 1 - depth * c.opacityDecay,
      duration: c.duration,
      ease: 'outQuart',
    })
  })

  return new Promise((resolve) => {
    // Wait for longest animation
    setTimeout(resolve, c.duration)
  })
}

// =============================================================================
// PARALLAX COLLAPSE (Reset stack to flat)
// =============================================================================

/**
 * Collapse parallax stack back to flat state.
 * All drawers return to neutral position.
 *
 * @param drawers - Array of drawer elements
 * @param config - Animation configuration
 * @returns Promise that resolves when all animations complete
 */
export function parallaxCollapse(
  drawers: HTMLElement[],
  config: Partial<ParallaxConfig> = {}
): Promise<void> {
  const c = { ...DEFAULT_PARALLAX_CONFIG, ...config }

  drawers.forEach((el) => {
    animate(el, {
      translateY: 0,
      rotateX: 0,
      filter: 'blur(0px)',
      opacity: 1,
      duration: c.duration,
      ease: 'outQuart',
    })
  })

  return new Promise((resolve) => {
    setTimeout(resolve, c.duration)
  })
}

// =============================================================================
// PARALLAX REORDER (Animate stack reordering)
// =============================================================================

/**
 * Animate stack reordering when bringing a drawer to front.
 * The target drawer rises while others compress down.
 *
 * @param drawers - Array of drawer elements in new order (last = top)
 * @param targetIndex - Index of the drawer being brought to front
 * @param config - Animation configuration
 * @returns Promise that resolves when animation completes
 */
export function parallaxReorder(
  drawers: HTMLElement[],
  targetIndex: number,
  config: Partial<ParallaxConfig> = {}
): Promise<void> {
  const c = { ...DEFAULT_PARALLAX_CONFIG, ...config }

  drawers.forEach((el, i) => {
    const depth = drawers.length - i - 1
    const isTarget = i === targetIndex

    animate(el, {
      // Target rises fully, others stay recessed
      translateY: isTarget ? 0 : -depth * c.liftPerLayer,
      rotateX: isTarget ? 0 : -depth * c.rotatePerLayer,
      filter: isTarget ? 'blur(0px)' : `blur(${depth * c.blurPerLayer}px)`,
      opacity: isTarget ? 1 : 1 - depth * c.opacityDecay,
      // Target animates faster for snappy response
      duration: isTarget ? c.duration * 0.7 : c.duration,
      ease: 'outQuart',
    })
  })

  return new Promise((resolve) => {
    setTimeout(resolve, c.duration)
  })
}

// =============================================================================
// UTILITY: Apply static parallax styles (no animation)
// =============================================================================

/**
 * Apply parallax styles instantly without animation.
 * Useful for initial render of stack.
 *
 * @param drawers - Array of drawer elements
 * @param config - Parallax configuration
 */
export function applyParallaxStyles(
  drawers: HTMLElement[],
  config: Partial<ParallaxConfig> = {}
): void {
  const c = { ...DEFAULT_PARALLAX_CONFIG, ...config }

  drawers.forEach((el, i) => {
    const depth = drawers.length - i - 1

    el.style.transform = `translateY(${-depth * c.liftPerLayer}px) rotateX(${-depth * c.rotatePerLayer}deg)`
    el.style.filter = `blur(${depth * c.blurPerLayer}px)`
    el.style.opacity = `${1 - depth * c.opacityDecay}`
  })
}

/**
 * Reset parallax styles to neutral.
 */
export function resetParallaxStyles(drawers: HTMLElement[]): void {
  drawers.forEach((el) => {
    el.style.transform = ''
    el.style.filter = ''
    el.style.opacity = ''
  })
}
