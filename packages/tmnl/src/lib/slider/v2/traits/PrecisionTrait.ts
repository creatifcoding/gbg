/**
 * PrecisionTrait
 *
 * Modifier key sensitivity control for fine-grained adjustments.
 * Shift = fine (0.1x), Ctrl = ultra-fine (0.01x), Alt = snap/reset.
 */

import { createTrait } from '@/lib/traits'
import type { PrecisionSlot, ModifierKeys } from '../types'

// =============================================================================
// TRAIT DEFINITION
// =============================================================================

export const PrecisionTrait = createTrait<PrecisionSlot>({
  id: 'slider-precision',

  // Pure behavior - no render
  render: () => null,

  defaultSlot: {
    baseSensitivity: 1.0,
    shiftMultiplier: 0.1,   // Fine control
    ctrlMultiplier: 0.01,   // Ultra-fine control
    altBehavior: 'snap',    // Snap to nearest step
  },
})

/**
 * Calculate effective sensitivity based on modifier keys
 *
 * @param slot - Precision trait configuration
 * @param modifiers - Current modifier key state
 * @returns Effective sensitivity multiplier
 */
export function calculateSensitivity(
  slot: PrecisionSlot,
  modifiers: ModifierKeys
): number {
  let sensitivity = slot.baseSensitivity

  // Shift = fine control
  if (modifiers.shift) {
    sensitivity *= slot.shiftMultiplier
  }

  // Ctrl = ultra-fine control (stacks with shift)
  if (modifiers.ctrl) {
    sensitivity *= slot.ctrlMultiplier
  }

  return sensitivity
}

/**
 * Apply precision to a delta value
 *
 * @param delta - Raw input delta (pixels moved)
 * @param slot - Precision trait configuration
 * @param modifiers - Current modifier key state
 * @param trackLength - Track length for normalization
 * @returns Adjusted delta value
 */
export function applyPrecision(
  delta: number,
  slot: PrecisionSlot,
  modifiers: ModifierKeys,
  trackLength: number
): number {
  const sensitivity = calculateSensitivity(slot, modifiers)
  return (delta / trackLength) * sensitivity
}

/**
 * Handle alt-key behavior
 *
 * @param behavior - Alt behavior type
 * @param currentValue - Current normalized value
 * @param snapPoints - Available snap points (0-1 normalized)
 * @returns New normalized value, or null if no change
 */
export function handleAltBehavior(
  behavior: PrecisionSlot['altBehavior'],
  currentValue: number,
  snapPoints?: number[]
): number | null {
  switch (behavior) {
    case 'snap':
      // Snap to nearest point
      if (!snapPoints || snapPoints.length === 0) return null
      return snapPoints.reduce((nearest, point) =>
        Math.abs(point - currentValue) < Math.abs(nearest - currentValue)
          ? point
          : nearest
      )

    case 'reset':
      // Reset to center
      return 0.5

    case 'none':
    default:
      return null
  }
}

export default PrecisionTrait
