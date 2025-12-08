/**
 * OvershootEffect
 *
 * 15% elastic overshoot with rubber-band return.
 * Two-phase animation: fast extension, then tactical settle.
 */

import { Effect } from 'effect'
import { animate, createTimeline } from 'animejs'
import { TIMING, EASING } from '../types'

/**
 * Create an overshoot animation Effect program
 *
 * @param thumbElement - The thumb DOM element to animate
 * @param boundaryPosition - The boundary position (0 or 1 normalized → pixel value)
 * @param overshootTarget - The overshoot target position (extends past boundary)
 * @param settleMs - Rubber-band settle duration
 * @param easing - Easing for settle phase
 * @returns Effect that completes when animation finishes
 */
export const createOvershootEffect = (
  thumbElement: HTMLElement,
  boundaryPosition: number,
  overshootTarget: number,
  settleMs: number = TIMING.settle,
  easing: string = EASING.settleBack
): Effect.Effect<void, Error> =>
  Effect.withSpan('slider:overshoot')(
    Effect.async<void, Error>((resume) => {
      try {
        const timeline = createTimeline({
          autoplay: true,
        })

        // Phase 1: Fast extension to overshoot (30ms)
        timeline.add(thumbElement, {
          translateX: overshootTarget,
          duration: TIMING.overshootExtend,
          easing: EASING.extend,
        })

        // Phase 2: Rubber-band back to boundary
        timeline.add(thumbElement, {
          translateX: boundaryPosition,
          duration: settleMs,
          easing,
        })

        // Resume on completion
        timeline.then(() => resume(Effect.succeed(undefined)))

        // Return cleanup (fiber cancellation)
        return Effect.sync(() => {
          timeline.pause()
        })
      } catch (error) {
        resume(Effect.fail(new Error(`Overshoot animation failed: ${error}`)))
        return Effect.void
      }
    })
  )

/**
 * Create an overshoot animation for both thumb and fill
 *
 * @param thumbElement - The thumb DOM element
 * @param fillElement - The fill bar DOM element
 * @param boundaryPosition - Boundary position in pixels
 * @param overshootTarget - Overshoot target in pixels
 * @param boundaryWidth - Boundary width as percentage string
 * @param overshootWidth - Overshoot width as percentage string
 * @param settleMs - Rubber-band settle duration
 * @returns Effect that completes when animation finishes
 */
export const createDualOvershootEffect = (
  thumbElement: HTMLElement,
  fillElement: HTMLElement,
  boundaryPosition: number,
  overshootTarget: number,
  boundaryWidth: string,
  overshootWidth: string,
  settleMs: number = TIMING.settle
): Effect.Effect<void, Error> =>
  Effect.withSpan('slider:dual-overshoot')(
    Effect.async<void, Error>((resume) => {
      try {
        const timeline = createTimeline({
          autoplay: true,
        })

        // Phase 1: Fast extension
        timeline.add(thumbElement, {
          translateX: overshootTarget,
          duration: TIMING.overshootExtend,
          easing: EASING.extend,
        }, 0)

        timeline.add(fillElement, {
          width: overshootWidth,
          duration: TIMING.overshootExtend,
          easing: EASING.extend,
        }, 0)

        // Phase 2: Rubber-band back
        timeline.add(thumbElement, {
          translateX: boundaryPosition,
          duration: settleMs,
          easing: EASING.settleBack,
        })

        timeline.add(fillElement, {
          width: boundaryWidth,
          duration: settleMs,
          easing: EASING.settleBack,
        }, '<') // Sync with previous

        timeline.then(() => resume(Effect.succeed(undefined)))

        return Effect.sync(() => {
          timeline.pause()
        })
      } catch (error) {
        resume(Effect.fail(new Error(`Dual overshoot animation failed: ${error}`)))
        return Effect.void
      }
    })
  )
