/**
 * View Mode State Machine
 *
 * Connected-only cycle: dot → sparkline → full → dot
 * Each mode determines what Tuftian data is visible:
 *   dot:       [●] (+ latency text inline)
 *   sparkline: [● sparkline 42ms]
 *   full:      [● sparkline 42ms · ws://local · 14m]
 *
 * @module connection-capsule/view-modes
 */

export type ViewMode = 'dot' | 'sparkline' | 'full'

/** Cycle order — wraps around */
export const MODE_CYCLE: readonly ViewMode[] = ['dot', 'sparkline', 'full'] as const

/** Advance to the next mode in the cycle */
export function nextMode(current: ViewMode): ViewMode {
  const i = MODE_CYCLE.indexOf(current)
  return MODE_CYCLE[(i + 1) % MODE_CYCLE.length]
}
