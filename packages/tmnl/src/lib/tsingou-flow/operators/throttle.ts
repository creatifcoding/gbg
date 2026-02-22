/**
 * throttle(maxPerWindow) — Rate-limiting operator.
 *
 * Limits signals to max N per time window. Excess signals are dropped.
 *
 * When d2ts is installed, this extends UnaryOperator.
 * For now: pure function + stateful throttle.
 *
 * @module tsingou-flow/operators/throttle
 */

import type { BaseSignal } from '../schemas/base-signal'

/**
 * Stateless throttle: take first N signals from a batch.
 */
export const throttleOperator = (maxPerBatch: number) => {
  return (signals: ReadonlyArray<BaseSignal>): ReadonlyArray<BaseSignal> =>
    signals.slice(0, maxPerBatch)
}

/**
 * Stateful rate limiter: max N signals per windowMs.
 * Tracks count per window, resets when window expires.
 */
export const createRateLimiter = (maxPerWindow: number, windowMs: number) => {
  let windowStart = Date.now()
  let count = 0

  return {
    /** Check if a signal should be allowed (and count it if so) */
    allow: (): boolean => {
      const now = Date.now()
      if (now - windowStart >= windowMs) {
        // New window
        windowStart = now
        count = 1
        return true
      }
      if (count < maxPerWindow) {
        count++
        return true
      }
      return false // Rate limited
    },

    /** Filter a batch, keeping only allowed signals */
    filter: (signals: ReadonlyArray<BaseSignal>): ReadonlyArray<BaseSignal> => {
      const result: BaseSignal[] = []
      const now = Date.now()

      if (now - windowStart >= windowMs) {
        windowStart = now
        count = 0
      }

      for (const s of signals) {
        if (count < maxPerWindow) {
          result.push(s)
          count++
        }
      }
      return result
    },

    /** Current count in this window */
    currentCount: () => count,

    /** Reset the limiter */
    reset: () => { windowStart = Date.now(); count = 0 },
  }
}
