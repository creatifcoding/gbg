/**
 * OvershootTrait
 *
 * Elastic behavior at boundaries - 15% visual overshoot with rubber-band return.
 * Pure behavioral trait with no visual output.
 */

import { createTrait } from '@/lib/traits'
import type { OvershootSlot } from '../types'
import { TIMING, EASING } from '../types'

// =============================================================================
// TRAIT DEFINITION
// =============================================================================

export const OvershootTrait = createTrait<OvershootSlot>({
  id: 'slider-overshoot',

  // Pure behavior - no render
  render: () => null,

  defaultSlot: {
    enabled: true,
    extent: 0.15,              // 15% visual overshoot
    settleMs: TIMING.settle,   // 65ms tactical timing
    easing: EASING.settleBack, // 'easeOutBack'
  },
})

/**
 * Calculate overshoot target position
 *
 * @param currentPosition - Current visual position (0-1 normalized)
 * @param boundaryPosition - Boundary that was hit (0 or 1)
 * @param extent - Overshoot extent (0.15 = 15%)
 * @returns Target position for overshoot animation
 */
export function calculateOvershootTarget(
  currentPosition: number,
  boundaryPosition: number,
  extent: number
): number {
  // Direction of overshoot (past boundary)
  const direction = boundaryPosition === 0 ? -1 : 1
  return boundaryPosition + (extent * direction)
}

/**
 * Check if position is at or beyond a boundary
 */
export function isAtBoundary(
  normalizedValue: number,
  tolerance = 0.001
): 'min' | 'max' | null {
  if (normalizedValue <= tolerance) return 'min'
  if (normalizedValue >= 1 - tolerance) return 'max'
  return null
}

export default OvershootTrait
