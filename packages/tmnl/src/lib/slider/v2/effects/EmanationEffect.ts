/**
 * EmanationEffect
 *
 * Soft clamp glow burst at boundary or snap points.
 * Creates temporary glow ring that expands and fades.
 */

import { Effect } from 'effect'
import { animate } from 'animejs'
import { TIMING, EASING, GLOW_COLORS } from '../types'
import type { GlowSlot } from '../types'

/**
 * Create an emanation (glow burst) Effect program
 *
 * @param containerElement - The container to append the glow ring to
 * @param position - Position of the emanation (x, y relative to container)
 * @param color - Glow color from palette
 * @param duration - Emanation duration in ms
 * @returns Effect that completes when animation finishes and cleans up
 */
export const createEmanationEffect = (
  containerElement: HTMLElement,
  position: { x: number; y: number },
  color: GlowSlot['color'] = 'cyan',
  duration: number = TIMING.emanation
): Effect.Effect<void, Error> =>
  Effect.withSpan('slider:emanation')(
    Effect.async<void, Error>((resume) => {
      try {
        // Create the glow ring element
        const ring = document.createElement('div')
        ring.className = 'slider-emanation-ring'
        ring.style.cssText = `
          position: absolute;
          left: ${position.x}px;
          top: ${position.y}px;
          width: 0;
          height: 0;
          border-radius: 50%;
          pointer-events: none;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 0 0 ${GLOW_COLORS[color]};
          background: transparent;
        `

        containerElement.appendChild(ring)

        // Animate: expand and fade
        const anim = animate(ring, {
          width: ['0px', '40px'],
          height: ['0px', '40px'],
          boxShadow: [
            `0 0 0 0 ${GLOW_COLORS[color]}`,
            `0 0 20px 10px transparent`,
          ],
          opacity: [1, 0],
          duration: duration * 2, // Expand + fade takes longer
          easing: EASING.glow,
        })

        // Cleanup on completion
        anim.then(() => {
          ring.remove()
          resume(Effect.succeed(undefined))
        })

        // Return cleanup (fiber cancellation)
        return Effect.sync(() => {
          anim.pause()
          ring.remove()
        })
      } catch (error) {
        resume(Effect.fail(new Error(`Emanation animation failed: ${error}`)))
        return Effect.void
      }
    })
  )

/**
 * Create a boundary emanation at either end of the slider
 *
 * @param trackElement - The track element
 * @param boundary - Which boundary ('min' or 'max')
 * @param color - Glow color
 * @returns Effect that completes when animation finishes
 */
export const createBoundaryEmanationEffect = (
  trackElement: HTMLElement,
  boundary: 'min' | 'max',
  color: GlowSlot['color'] = 'cyan'
): Effect.Effect<void, Error> => {
  const rect = trackElement.getBoundingClientRect()
  const position = {
    x: boundary === 'min' ? 0 : rect.width,
    y: rect.height / 2,
  }

  return createEmanationEffect(trackElement, position, color)
}

/**
 * Create emanation at a snap point
 *
 * @param trackElement - The track element
 * @param normalizedPosition - Snap point position (0-1)
 * @param color - Glow color
 * @returns Effect that completes when animation finishes
 */
export const createSnapEmanationEffect = (
  trackElement: HTMLElement,
  normalizedPosition: number,
  color: GlowSlot['color'] = 'cyan'
): Effect.Effect<void, Error> => {
  const rect = trackElement.getBoundingClientRect()
  const position = {
    x: normalizedPosition * rect.width,
    y: rect.height / 2,
  }

  return createEmanationEffect(trackElement, position, color)
}
