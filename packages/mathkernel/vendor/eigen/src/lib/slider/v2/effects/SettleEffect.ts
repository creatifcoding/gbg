/**
 * SettleEffect
 *
 * Tactical 50-80ms follow-through on release with kinetic thumb animation.
 * Combines position settle + scale "pop" for tactile feedback.
 */

import { Effect } from 'effect'
import { animate } from 'animejs'
import { TIMING, EASING } from '../types'

/**
 * Create a settle animation Effect program (position only)
 *
 * @param thumbElement - The thumb DOM element to animate
 * @param targetX - Target X position (in pixels or %)
 * @param settleMs - Duration in milliseconds
 * @param easing - Easing function name
 * @returns Effect that completes when animation finishes
 */
export const createSettleEffect = (
  thumbElement: HTMLElement,
  targetX: number,
  settleMs: number = TIMING.settle,
  easing: string = EASING.settleBack
): Effect.Effect<void, Error> =>
  Effect.withSpan('slider:settle')(
    Effect.async<void, Error>((resume) => {
      try {
        const anim = animate(thumbElement, {
          translateX: targetX,
          duration: settleMs,
          easing,
        })

        // Resume on completion
        anim.then(() => resume(Effect.succeed(undefined)))

        // Return cleanup (fiber cancellation)
        return Effect.sync(() => {
          anim.pause()
        })
      } catch (error) {
        resume(Effect.fail(new Error(`Settle animation failed: ${error}`)))
        return Effect.void
      }
    })
  )

/**
 * Create a kinetic thumb settle effect with scale "pop"
 *
 * Combines:
 * - Scale pop animation (1.0 -> 1.15 -> 1.0, 150ms, easeOutBack)
 * - Position settle animation (65ms settle to target)
 *
 * Both animations run in parallel.
 *
 * @param thumbElement - The thumb DOM element to animate
 * @param targetX - Target X position (in pixels or %)
 * @param settleMs - Duration for position animation (default: 65ms)
 * @param popMs - Duration for scale pop (default: 150ms)
 * @returns Effect that completes when both animations finish
 */
export const createThumbSettleEffect = (
  thumbElement: HTMLElement,
  targetX: number,
  settleMs: number = TIMING.settle,
  popMs: number = 150
): Effect.Effect<void, Error> =>
  Effect.withSpan('slider:thumb-settle')(
    Effect.async<void, Error>((resume) => {
      try {
        // Scale pop animation (1 -> 1.15 -> 1)
        const scaleAnim = animate(thumbElement, {
          scale: [1, 1.15, 1],
          duration: popMs,
          easing: 'easeOutBack',
        })

        // Position settle animation
        const positionAnim = animate(thumbElement, {
          translateX: targetX,
          duration: settleMs,
          easing: EASING.settleBack,
        })

        // Wait for both animations to complete
        Promise.all([scaleAnim, positionAnim]).then(() => {
          resume(Effect.succeed(undefined))
        })

        // Return cleanup (fiber cancellation)
        return Effect.sync(() => {
          scaleAnim.pause()
          positionAnim.pause()
        })
      } catch (error) {
        resume(Effect.fail(new Error(`Thumb settle animation failed: ${error}`)))
        return Effect.void
      }
    })
  )

/**
 * Create a settle animation for the fill bar
 *
 * @param fillElement - The fill bar DOM element
 * @param targetWidth - Target width as percentage string (e.g., "75%")
 * @param settleMs - Duration in milliseconds
 * @param easing - Easing function name
 * @returns Effect that completes when animation finishes
 */
export const createFillSettleEffect = (
  fillElement: HTMLElement,
  targetWidth: string,
  settleMs: number = TIMING.settle,
  easing: string = EASING.settleBack
): Effect.Effect<void, Error> =>
  Effect.withSpan('slider:fill-settle')(
    Effect.async<void, Error>((resume) => {
      try {
        const anim = animate(fillElement, {
          width: targetWidth,
          duration: settleMs,
          easing,
        })

        anim.then(() => resume(Effect.succeed(undefined)))

        return Effect.sync(() => {
          anim.pause()
        })
      } catch (error) {
        resume(Effect.fail(new Error(`Fill settle animation failed: ${error}`)))
        return Effect.void
      }
    })
  )
