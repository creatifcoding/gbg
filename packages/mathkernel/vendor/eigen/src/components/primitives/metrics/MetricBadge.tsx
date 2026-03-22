/**
 * MetricBadge - Unified metric display primitive
 *
 * Variants:
 * - inline: Horizontal label + value (default)
 * - cell: Vertical layout with border separator
 *
 * @module primitives/metrics
 */

import { type ReactNode } from 'react'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Available accent colors for metric display.
 */
export type MetricAccent =
  | 'cyan'
  | 'amber'
  | 'green'
  | 'rose'
  | 'neutral'

/**
 * Layout variant.
 */
export type MetricVariant = 'inline' | 'cell'

/**
 * Value formatting strategy.
 */
export type MetricFormat = 'locale' | 'fixed' | 'none'

export interface MetricBadgeProps {
  /** Display label */
  label: string
  /** Numeric value to display */
  value: number | string
  /** Unit suffix (e.g., "/s", "μs", "ms") */
  unit?: string
  /** Color accent */
  accent?: MetricAccent
  /** Layout variant */
  variant?: MetricVariant
  /** Value formatting strategy */
  format?: MetricFormat
  /** Decimal places for fixed format */
  decimals?: number
  /** Additional className */
  className?: string
  /** Override value render */
  renderValue?: (value: number | string) => ReactNode
}

// =============================================================================
// ACCENT COLORS
// =============================================================================

const ACCENT_COLORS: Record<MetricAccent, string> = {
  cyan: 'text-cyan-400',
  amber: 'text-amber-400',
  green: 'text-green-400',
  rose: 'text-rose-400',
  neutral: 'text-neutral-300',
}

// =============================================================================
// VALUE FORMATTERS
// =============================================================================

function formatValue(
  value: number | string,
  format: MetricFormat,
  decimals: number
): string {
  if (typeof value === 'string') return value

  switch (format) {
    case 'locale':
      return value.toLocaleString()
    case 'fixed':
      return value.toFixed(decimals)
    case 'none':
    default:
      return String(value)
  }
}

// =============================================================================
// INLINE VARIANT
// =============================================================================

function InlineMetricBadge({
  label,
  value,
  unit,
  accent = 'neutral',
  format = 'locale',
  decimals = 1,
  className = '',
  renderValue,
}: MetricBadgeProps) {
  const formattedValue = formatValue(value, format, decimals)

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span
        className="text-neutral-500"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {label}:
      </span>
      <span
        className={`font-mono font-bold ${ACCENT_COLORS[accent]}`}
        style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}
      >
        {renderValue ? renderValue(value) : formattedValue}
        {unit && <span className="text-neutral-600 font-normal">{unit}</span>}
      </span>
    </div>
  )
}

// =============================================================================
// CELL VARIANT
// =============================================================================

function CellMetricBadge({
  label,
  value,
  unit,
  accent = 'neutral',
  format = 'locale',
  decimals = 1,
  className = '',
  renderValue,
}: MetricBadgeProps) {
  const formattedValue = formatValue(value, format, decimals)

  return (
    <div
      className={`flex flex-col items-center px-4 py-2 border-r border-neutral-800 last:border-r-0 ${className}`}
    >
      <span
        className="text-neutral-500 uppercase tracking-wider font-mono mb-1"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        {label}
      </span>
      <span
        className={`font-mono font-bold ${ACCENT_COLORS[accent]}`}
        style={{ fontSize: 'var(--tmnl-text-base, 16px)' }}
      >
        {renderValue ? renderValue(value) : formattedValue}
        {unit && (
          <span
            className="text-neutral-600 font-normal ml-1"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {unit}
          </span>
        )}
      </span>
    </div>
  )
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * Unified metric display primitive.
 *
 * @example Inline variant (default)
 * ```tsx
 * <MetricBadge label="Current" value={1234} unit="/s" accent="cyan" />
 * ```
 *
 * @example Cell variant (vertical)
 * ```tsx
 * <MetricBadge variant="cell" label="Total" value={50000} accent="neutral" />
 * ```
 *
 * @example Fixed decimal formatting
 * ```tsx
 * <MetricBadge label="Latency" value={2.5678} unit="ms" format="fixed" decimals={2} />
 * ```
 */
export function MetricBadge(props: MetricBadgeProps) {
  const { variant = 'inline' } = props

  if (variant === 'cell') {
    return <CellMetricBadge {...props} />
  }

  return <InlineMetricBadge {...props} />
}

export default MetricBadge
