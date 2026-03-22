/**
 * CurveTrait
 *
 * Value transformation curve - linear, logarithmic, decibel, exponential.
 * Pure behavioral trait with no visual output.
 */

import { createTrait } from '@/lib/traits'
import type { CurveSlot } from '../types'

// =============================================================================
// CURVE UTILITY FUNCTIONS
// =============================================================================

/**
 * Convert normalized value (0-1) to actual value using curve
 */
export function normalizedToValue(
  normalized: number,
  min: number,
  max: number,
  curve: CurveSlot
): number {
  const range = max - min

  switch (curve.type) {
    case 'linear':
      return min + normalized * range

    case 'logarithmic': {
      const base = curve.base ?? 10
      // Log scale: 0 maps to min, 1 maps to max
      const logMin = Math.log(1) / Math.log(base)
      const logMax = Math.log(range + 1) / Math.log(base)
      const logValue = logMin + normalized * (logMax - logMin)
      return min + Math.pow(base, logValue) - 1
    }

    case 'decibel': {
      // Decibel curve: often used for audio (-inf to 0dB)
      // Normalized 0 = min, 1 = max
      if (normalized === 0) return min
      const dbRange = max - min
      const db = min + Math.pow(normalized, 2) * dbRange
      return db
    }

    case 'exponential': {
      const exponent = curve.exponent ?? 2
      return min + Math.pow(normalized, exponent) * range
    }

    default:
      return min + normalized * range
  }
}

/**
 * Convert actual value to normalized (0-1) using curve
 */
export function valueToNormalized(
  value: number,
  min: number,
  max: number,
  curve: CurveSlot
): number {
  const range = max - min
  const relative = value - min

  switch (curve.type) {
    case 'linear':
      return relative / range

    case 'logarithmic': {
      const base = curve.base ?? 10
      const logRange = Math.log(range + 1) / Math.log(base)
      const logValue = Math.log(relative + 1) / Math.log(base)
      return logValue / logRange
    }

    case 'decibel': {
      if (value === min) return 0
      const dbRange = max - min
      return Math.sqrt((value - min) / dbRange)
    }

    case 'exponential': {
      const exponent = curve.exponent ?? 2
      return Math.pow(relative / range, 1 / exponent)
    }

    default:
      return relative / range
  }
}

// =============================================================================
// TRAIT DEFINITION
// =============================================================================

export const CurveTrait = createTrait<CurveSlot>({
  id: 'slider-curve',

  // Pure behavior - no render
  render: () => null,

  defaultSlot: {
    type: 'linear',
  },
})

export default CurveTrait
