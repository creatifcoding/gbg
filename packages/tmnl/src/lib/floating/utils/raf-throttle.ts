/**
 * requestAnimationFrame Throttle
 *
 * Coalesces rapid calls (e.g., pointermove at 120Hz) to at most
 * 1 execution per animation frame (~60fps). Only the LATEST args
 * are applied — intermediate calls are dropped.
 *
 * @example
 * ```ts
 * const throttled = rafThrottle((x: number, y: number) => {
 *   updatePosition(x, y)
 * })
 *
 * element.addEventListener('pointermove', (e) => {
 *   throttled(e.clientX, e.clientY)  // Coalesced to 1/frame
 * })
 *
 * // Cleanup
 * throttled.cancel()
 * ```
 *
 * @module
 */

/**
 * Wraps a function so it executes at most once per animation frame.
 * The latest arguments are always used (intermediate calls coalesced).
 *
 * @returns Throttled function with .cancel() and .flush() methods
 */
export function rafThrottle<T extends (...args: any[]) => void>(
  fn: T
): T & { cancel: () => void; flush: () => void } {
  let rafId: number | null = null
  let lastArgs: Parameters<T> | null = null

  const throttled = ((...args: Parameters<T>) => {
    lastArgs = args

    if (rafId === null) {
      rafId = requestAnimationFrame(() => {
        rafId = null
        if (lastArgs) {
          const args = lastArgs
          lastArgs = null
          fn(...args)
        }
      })
    }
  }) as T & { cancel: () => void; flush: () => void }

  /**
   * Cancel any pending frame. Safe to call multiple times.
   */
  throttled.cancel = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    lastArgs = null
  }

  /**
   * Immediately execute with latest args if a frame is pending.
   * Use on pointerup to ensure the final position is applied.
   */
  throttled.flush = () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
    if (lastArgs) {
      const args = lastArgs
      lastArgs = null
      fn(...args)
    }
  }

  return throttled
}
