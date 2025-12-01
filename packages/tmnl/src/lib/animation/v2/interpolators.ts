/**
 * Animation Library v2 - Interpolators
 *
 * Pure functions for interpolating between values.
 * No side effects, no dependencies beyond types.
 */

import type {
  AnimationValue,
  NumericValue,
  VectorValue,
  ObjectValue,
  ColorValue,
  Interpolator,
  InterpolatorRegistry,
} from './types'

// =============================================================================
// NUMERIC INTERPOLATION
// =============================================================================

/** Linear interpolation for numbers */
export const lerpNumber: Interpolator<NumericValue> = (from, to, t) =>
  from + (to - from) * t

// =============================================================================
// VECTOR INTERPOLATION
// =============================================================================

/** Interpolate arrays of numbers element-wise */
export const lerpVector: Interpolator<VectorValue> = (from, to, t) =>
  from.map((v, i) => lerpNumber(v, to[i] ?? v, t))

// =============================================================================
// OBJECT INTERPOLATION
// =============================================================================

/** Interpolate objects with numeric values */
export const lerpObject: Interpolator<ObjectValue> = (from, to, t) => {
  const result: Record<string, number> = {}
  for (const key in from) {
    const fromVal = from[key]
    const toVal = to[key]
    if (typeof fromVal === 'number' && typeof toVal === 'number') {
      result[key] = lerpNumber(fromVal, toVal, t)
    } else if (typeof fromVal === 'number') {
      result[key] = fromVal
    }
  }
  return result
}

// =============================================================================
// COLOR INTERPOLATION
// =============================================================================

/** Parse hex color to RGB */
const parseHex = (hex: string): { r: number; g: number; b: number } => {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

/** Convert number to 2-digit hex */
const toHex = (n: number): string =>
  Math.round(Math.max(0, Math.min(255, n)))
    .toString(16)
    .padStart(2, '0')

/** Interpolate hex colors */
export const lerpColor: Interpolator<ColorValue> = (from, to, t) => {
  const c1 = parseHex(from)
  const c2 = parseHex(to)

  const r = lerpNumber(c1.r, c2.r, t)
  const g = lerpNumber(c1.g, c2.g, t)
  const b = lerpNumber(c1.b, c2.b, t)

  return `#${toHex(r)}${toHex(g)}${toHex(b)}` as ColorValue
}

// =============================================================================
// REGISTRY
// =============================================================================

/** All interpolators in one registry */
export const interpolators: InterpolatorRegistry = {
  number: lerpNumber,
  vector: lerpVector,
  object: lerpObject,
  color: lerpColor,
}

// =============================================================================
// AUTO-DETECT INTERPOLATOR
// =============================================================================

/** Detect the correct interpolator based on value type */
export function getInterpolator<T extends AnimationValue>(
  sample: T
): Interpolator<T> {
  if (typeof sample === 'number') {
    return lerpNumber as Interpolator<T>
  }

  if (Array.isArray(sample)) {
    return lerpVector as Interpolator<T>
  }

  if (typeof sample === 'string' && sample.startsWith('#')) {
    return lerpColor as Interpolator<T>
  }

  if (typeof sample === 'object' && sample !== null) {
    return lerpObject as Interpolator<T>
  }

  // Fallback: step function (instant transition at t=1)
  return ((from: T, to: T, t: number) => (t < 1 ? from : to)) as Interpolator<T>
}
