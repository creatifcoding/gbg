/**
 * window(durationMs) — Sliding time window operator.
 *
 * Maintains a buffer of signals within the last N milliseconds.
 * Each invocation: evict expired entries, return current window.
 *
 * When d2ts is installed, this extends UnaryOperator.
 * For now: pure function operating on signal arrays.
 *
 * @module tsingou-flow/operators/window
 */

import type { BaseSignal } from '../schemas/base-signal'

/**
 * Create a sliding time window operator.
 *
 * @param durationMs - Window duration in milliseconds
 * @returns Function that filters signals within the window
 *
 * @example
 * ```typescript
 * const last5s = windowOperator(5000)
 * const recent = last5s(allSignals)
 * ```
 */
export const windowOperator = (durationMs: number) => {
  return (signals: ReadonlyArray<BaseSignal>): ReadonlyArray<BaseSignal> => {
    const cutoff = Date.now() - durationMs
    return signals.filter((s) => s.timestamp.getTime() >= cutoff)
  }
}

/**
 * Stateful sliding window that maintains its own buffer.
 * Append new signals, get current window, auto-evict expired.
 */
export const createSlidingWindow = (durationMs: number) => {
  let buffer: BaseSignal[] = []

  return {
    /** Add signals to the window */
    push: (...signals: BaseSignal[]) => {
      buffer.push(...signals)
    },

    /** Get current window (evicts expired entries) */
    get: (): ReadonlyArray<BaseSignal> => {
      const cutoff = Date.now() - durationMs
      buffer = buffer.filter((s) => s.timestamp.getTime() >= cutoff)
      return buffer
    },

    /** Current buffer size */
    size: () => buffer.length,

    /** Clear the buffer */
    clear: () => { buffer = [] },
  }
}
