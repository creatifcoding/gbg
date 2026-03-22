/**
 * LogSlider - Logarithmic scale slider primitive
 *
 * Specialized slider for exponential ranges (1 → 10k, 20Hz → 20kHz, etc.)
 * Uses logarithmic mapping for uniform perceptual control.
 *
 * Use Cases:
 * - Frequency controls (20Hz-20kHz)
 * - Throughput sliders (1-10,000 events/sec)
 * - Gain controls (non-dB)
 * - Time ranges spanning orders of magnitude
 *
 * @module primitives/slider
 */

import { useCallback, useMemo } from 'react'

// =============================================================================
// TYPES
// =============================================================================

export interface LogSliderProps {
  /** Current value (in actual units) */
  value: number
  /** Minimum value (must be > 0) */
  min: number
  /** Maximum value */
  max: number
  /** Change handler (receives actual value, not position) */
  onChange: (value: number) => void
  /** Disabled state */
  disabled?: boolean
  /** Step resolution for linear position (0.5 = smoother) */
  step?: number
  /** Show value display */
  showValue?: boolean
  /** Custom value formatter */
  formatValue?: (value: number) => string
  /** Additional className */
  className?: string
  /** Track className */
  trackClassName?: string
  /** Value display className */
  valueClassName?: string
  /** Accent color (CSS custom property or hex) */
  accentColor?: string
}

// =============================================================================
// UTILITIES
// =============================================================================

/**
 * Convert actual value to linear position (0-100).
 */
function valueToPosition(
  value: number,
  min: number,
  max: number
): number {
  const logMin = Math.log10(min)
  const logMax = Math.log10(max)
  const logValue = Math.log10(Math.max(min, value))
  return ((logValue - logMin) / (logMax - logMin)) * 100
}

/**
 * Convert linear position (0-100) to actual value.
 */
function positionToValue(
  position: number,
  min: number,
  max: number
): number {
  const logMin = Math.log10(min)
  const logMax = Math.log10(max)
  const logVal = logMin + (position / 100) * (logMax - logMin)
  return Math.round(Math.pow(10, logVal))
}

/**
 * Default value formatter with locale.
 */
function defaultFormatValue(value: number): string {
  return value.toLocaleString()
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Logarithmic slider for exponential ranges.
 *
 * @example Basic usage
 * ```tsx
 * <LogSlider
 *   value={eventsPerSecond}
 *   min={1}
 *   max={10000}
 *   onChange={setEventsPerSecond}
 * />
 * ```
 *
 * @example Frequency range with custom format
 * ```tsx
 * <LogSlider
 *   value={frequency}
 *   min={20}
 *   max={20000}
 *   onChange={setFrequency}
 *   formatValue={(v) => v >= 1000 ? `${(v/1000).toFixed(1)}kHz` : `${v}Hz`}
 * />
 * ```
 *
 * @example Disabled state
 * ```tsx
 * <LogSlider
 *   value={1000}
 *   min={1}
 *   max={10000}
 *   onChange={() => {}}
 *   disabled={isRunning}
 * />
 * ```
 */
export function LogSlider({
  value,
  min,
  max,
  onChange,
  disabled = false,
  step = 0.5,
  showValue = true,
  formatValue = defaultFormatValue,
  className = '',
  trackClassName = '',
  valueClassName = '',
  accentColor,
}: LogSliderProps) {
  // Validate min > 0 (required for logarithmic scale)
  const safeMin = Math.max(0.001, min)

  // Compute position from value
  const position = useMemo(
    () => valueToPosition(value, safeMin, max),
    [value, safeMin, max]
  )

  // Handle change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const linearPos = parseFloat(e.target.value)
      const actualValue = positionToValue(linearPos, safeMin, max)
      const clampedValue = Math.max(safeMin, Math.min(max, actualValue))
      onChange(clampedValue)
    },
    [safeMin, max, onChange]
  )

  // Dynamic accent color style
  const accentStyle = accentColor
    ? { accentColor: accentColor }
    : {}

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <input
        type="range"
        min={0}
        max={100}
        step={step}
        value={position}
        onChange={handleChange}
        disabled={disabled}
        className={`
          flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer
          accent-cyan-500
          disabled:opacity-50 disabled:cursor-not-allowed
          ${trackClassName}
        `}
        style={accentStyle}
      />
      {showValue && (
        <span
          className={`
            min-w-[4rem] text-right font-mono tabular-nums text-neutral-200
            ${valueClassName}
          `}
          style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
        >
          {formatValue(value)}
        </span>
      )}
    </div>
  )
}

// =============================================================================
// PRESET CONFIGURATIONS
// =============================================================================

/**
 * Preset configurations for common use cases.
 */
export const LogSliderPresets = {
  /** Events per second (1 - 10k) */
  throughput: {
    min: 1,
    max: 10000,
    formatValue: (v: number) => `${v.toLocaleString()}/s`,
  },

  /** Frequency range (20Hz - 20kHz) */
  frequency: {
    min: 20,
    max: 20000,
    formatValue: (v: number) =>
      v >= 1000 ? `${(v / 1000).toFixed(1)}kHz` : `${v}Hz`,
  },

  /** Time duration (1ms - 10s) */
  duration: {
    min: 1,
    max: 10000,
    formatValue: (v: number) =>
      v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${v}ms`,
  },

  /** Multiplier (0.01x - 100x) */
  multiplier: {
    min: 0.01,
    max: 100,
    formatValue: (v: number) => `${v.toFixed(2)}x`,
  },
} as const

export default LogSlider
