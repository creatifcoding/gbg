/**
 * SliderBehavior Service
 *
 * Effect.Service pattern for slider value transformation.
 * Provides injectable behaviors that can be swapped at runtime.
 */

import { Context, Effect, Layer } from 'effect'
import type { ModifierKeys, SliderBehaviorShape, SliderConfig } from '../types'

// =============================================================================
// SERVICE DEFINITION
// =============================================================================

export class SliderBehavior extends Context.Tag('tmnl/slider/SliderBehavior')<
  SliderBehavior,
  SliderBehaviorShape
>() {}

// =============================================================================
// LINEAR BEHAVIOR
// =============================================================================

const linearBehavior: SliderBehaviorShape = {
  id: 'linear',
  name: 'Linear',

  normalize(value: number, min: number, max: number): number {
    return (value - min) / (max - min)
  },

  denormalize(normalized: number, min: number, max: number): number {
    return min + normalized * (max - min)
  },

  getSensitivity(modifiers: ModifierKeys, config: SliderConfig): number {
    if (modifiers.ctrl) return config.ctrlSensitivity
    if (modifiers.shift) return config.shiftSensitivity
    return config.baseSensitivity
  },

  snap(value: number, step: number | null, min: number, max: number): number {
    // Clamp first
    const clamped = Math.max(min, Math.min(max, value))

    if (step === null) return clamped

    // Snap to nearest step
    const steps = Math.round((clamped - min) / step)
    return Math.max(min, Math.min(max, min + steps * step))
  },

  format(value: number, precision: number, unit: string): string {
    const formatted = value.toFixed(precision)
    return unit ? `${formatted}${unit}` : formatted
  },

  getTicks(min: number, max: number, count: number): number[] {
    const ticks: number[] = []
    for (let i = 0; i <= count; i++) {
      ticks.push(min + (max - min) * (i / count))
    }
    return ticks
  },
}

export const LinearBehavior = {
  Default: Layer.succeed(SliderBehavior, linearBehavior),
  shape: linearBehavior,
}

// =============================================================================
// LOGARITHMIC BEHAVIOR (for frequency, gain)
// =============================================================================

const createLogarithmicBehavior = (
  base: number = 10,
  displayUnit: string = ''
): SliderBehaviorShape => ({
  id: `logarithmic-${base}`,
  name: `Logarithmic (base ${base})`,

  normalize(value: number, min: number, max: number): number {
    // Log scale: map min-max to 0-1 logarithmically
    const minLog = Math.log(Math.max(min, 0.001)) / Math.log(base)
    const maxLog = Math.log(max) / Math.log(base)
    const valueLog = Math.log(Math.max(value, 0.001)) / Math.log(base)
    return (valueLog - minLog) / (maxLog - minLog)
  },

  denormalize(normalized: number, min: number, max: number): number {
    const minLog = Math.log(Math.max(min, 0.001)) / Math.log(base)
    const maxLog = Math.log(max) / Math.log(base)
    const valueLog = minLog + normalized * (maxLog - minLog)
    return Math.pow(base, valueLog)
  },

  getSensitivity(modifiers: ModifierKeys, config: SliderConfig): number {
    // Log sliders need even finer control
    if (modifiers.ctrl) return config.ctrlSensitivity * 0.5
    if (modifiers.shift) return config.shiftSensitivity * 0.5
    return config.baseSensitivity
  },

  snap(value: number, step: number | null, min: number, max: number): number {
    const clamped = Math.max(min, Math.min(max, value))
    if (step === null) return clamped

    // Snap to nearest step
    const steps = Math.round((clamped - min) / step)
    return Math.max(min, Math.min(max, min + steps * step))
  },

  format(value: number, precision: number, unit: string): string {
    // Smart formatting for log values
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k${unit}`
    }
    return `${value.toFixed(precision)}${unit}`
  },

  getTicks(min: number, max: number, count: number): number[] {
    // Log-spaced ticks
    const ticks: number[] = []
    const minLog = Math.log(Math.max(min, 0.001)) / Math.log(base)
    const maxLog = Math.log(max) / Math.log(base)

    for (let i = 0; i <= count; i++) {
      const logValue = minLog + (maxLog - minLog) * (i / count)
      ticks.push(Math.pow(base, logValue))
    }
    return ticks
  },
})

export const LogarithmicBehavior = {
  Default: Layer.succeed(SliderBehavior, createLogarithmicBehavior(10)),
  layer: (base: number = 10) =>
    Layer.succeed(SliderBehavior, createLogarithmicBehavior(base)),
  shape: createLogarithmicBehavior,
}

// =============================================================================
// DECIBEL BEHAVIOR (special log with 0dB reference)
// =============================================================================

const decibelBehavior: SliderBehaviorShape = {
  id: 'decibel',
  name: 'Decibel (dB)',

  normalize(value: number, min: number, max: number): number {
    // dB scale with 0dB at a specific point (usually 75% up)
    // This gives more control around unity gain
    const dbMin = min
    const dbMax = max
    const dbRange = dbMax - dbMin

    // Non-linear mapping: more resolution around 0dB
    const normalized = (value - dbMin) / dbRange

    // Apply curve to give more resolution near 0
    return Math.pow(normalized, 0.75)
  },

  denormalize(normalized: number, min: number, max: number): number {
    const dbMin = min
    const dbMax = max
    const dbRange = dbMax - dbMin

    // Inverse curve
    const curved = Math.pow(normalized, 1 / 0.75)
    return dbMin + curved * dbRange
  },

  getSensitivity(modifiers: ModifierKeys, config: SliderConfig): number {
    if (modifiers.ctrl) return config.ctrlSensitivity * 0.5
    if (modifiers.shift) return config.shiftSensitivity
    return config.baseSensitivity
  },

  snap(value: number, step: number | null, min: number, max: number): number {
    const clamped = Math.max(min, Math.min(max, value))
    if (step === null) return clamped

    const steps = Math.round((clamped - min) / step)
    return Math.max(min, Math.min(max, min + steps * step))
  },

  format(value: number, precision: number, _unit: string): string {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(precision)}dB`
  },

  getTicks(min: number, max: number, _count: number): number[] {
    // Fixed dB ticks: -inf, -12, -6, -3, 0, +3, +6
    const standardTicks = [-48, -24, -12, -6, -3, 0, 3, 6]
    return standardTicks.filter((t) => t >= min && t <= max)
  },
}

export const DecibelBehavior = {
  Default: Layer.succeed(SliderBehavior, decibelBehavior),
  shape: decibelBehavior,
}

// =============================================================================
// STEPPED BEHAVIOR (discrete values only)
// =============================================================================

const createSteppedBehavior = (steps: number[]): SliderBehaviorShape => {
  const sortedSteps = [...steps].sort((a, b) => a - b)
  const min = sortedSteps[0]
  const max = sortedSteps[sortedSteps.length - 1]

  return {
    id: `stepped-${steps.length}`,
    name: `Stepped (${steps.length} values)`,

    normalize(value: number, _min: number, _max: number): number {
      // Find closest step index
      let closestIdx = 0
      let closestDist = Math.abs(value - sortedSteps[0])

      for (let i = 1; i < sortedSteps.length; i++) {
        const dist = Math.abs(value - sortedSteps[i])
        if (dist < closestDist) {
          closestDist = dist
          closestIdx = i
        }
      }

      return closestIdx / (sortedSteps.length - 1)
    },

    denormalize(normalized: number, _min: number, _max: number): number {
      const idx = Math.round(normalized * (sortedSteps.length - 1))
      return sortedSteps[Math.max(0, Math.min(sortedSteps.length - 1, idx))]
    },

    getSensitivity(modifiers: ModifierKeys, config: SliderConfig): number {
      // Stepped doesn't need fine control - always snap
      return config.baseSensitivity
    },

    snap(value: number, _step: number | null, _min: number, _max: number): number {
      // Always snap to nearest step
      let closest = sortedSteps[0]
      let closestDist = Math.abs(value - sortedSteps[0])

      for (const step of sortedSteps) {
        const dist = Math.abs(value - step)
        if (dist < closestDist) {
          closestDist = dist
          closest = step
        }
      }

      return closest
    },

    format(value: number, precision: number, unit: string): string {
      return `${value.toFixed(precision)}${unit}`
    },

    getTicks(_min: number, _max: number, _count: number): number[] {
      return sortedSteps
    },
  }
}

export const SteppedBehavior = {
  layer: (steps: number[]) =>
    Layer.succeed(SliderBehavior, createSteppedBehavior(steps)),
  shape: createSteppedBehavior,
}

// =============================================================================
// EXPONENTIAL BEHAVIOR (for time constants)
// =============================================================================

const createExponentialBehavior = (exponent: number = 2): SliderBehaviorShape => ({
  id: `exponential-${exponent}`,
  name: `Exponential (^${exponent})`,

  normalize(value: number, min: number, max: number): number {
    const range = max - min
    const normalized = (value - min) / range
    return Math.pow(normalized, 1 / exponent)
  },

  denormalize(normalized: number, min: number, max: number): number {
    const range = max - min
    return min + Math.pow(normalized, exponent) * range
  },

  getSensitivity(modifiers: ModifierKeys, config: SliderConfig): number {
    if (modifiers.ctrl) return config.ctrlSensitivity
    if (modifiers.shift) return config.shiftSensitivity
    return config.baseSensitivity
  },

  snap(value: number, step: number | null, min: number, max: number): number {
    const clamped = Math.max(min, Math.min(max, value))
    if (step === null) return clamped

    const steps = Math.round((clamped - min) / step)
    return Math.max(min, Math.min(max, min + steps * step))
  },

  format(value: number, precision: number, unit: string): string {
    // Smart time formatting
    if (unit === 'ms' && value >= 1000) {
      return `${(value / 1000).toFixed(2)}s`
    }
    return `${value.toFixed(precision)}${unit}`
  },

  getTicks(min: number, max: number, count: number): number[] {
    const ticks: number[] = []
    for (let i = 0; i <= count; i++) {
      const normalized = i / count
      const value = min + Math.pow(normalized, exponent) * (max - min)
      ticks.push(value)
    }
    return ticks
  },
})

export const ExponentialBehavior = {
  Default: Layer.succeed(SliderBehavior, createExponentialBehavior(2)),
  layer: (exponent: number = 2) =>
    Layer.succeed(SliderBehavior, createExponentialBehavior(exponent)),
  shape: createExponentialBehavior,
}

// =============================================================================
// BEHAVIOR REGISTRY (for runtime swapping)
// =============================================================================

export const BUILT_IN_BEHAVIORS = {
  linear: LinearBehavior,
  logarithmic: LogarithmicBehavior,
  decibel: DecibelBehavior,
  exponential: ExponentialBehavior,
  stepped: SteppedBehavior,
} as const

export type BehaviorType = keyof typeof BUILT_IN_BEHAVIORS
