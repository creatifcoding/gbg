/**
 * ValueCellRenderer
 *
 * Renders numeric values with inline progress bar.
 * Bar intensity scales with value (0-100 default range).
 *
 * @module
 */

import type { ICellRendererParams } from 'ag-grid-community'
import { useDataGridContextMaybe } from '../components/DataGridContext'
import { COLORS, TYPOGRAPHY } from '../theme'

// =============================================================================
// TYPES
// =============================================================================

export interface ValueCellRendererParams extends ICellRendererParams {
  /** Maximum value for intensity calculation (default: 100) */
  maxValue?: number
  /** Show progress bar (default: true) */
  showBar?: boolean
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ValueCellRenderer(params: ValueCellRendererParams) {
  const ctx = useDataGridContextMaybe()
  const value = params.value as number
  const maxValue = params.maxValue ?? 100
  const showBar = params.showBar ?? true

  // Calculate intensity (0-1)
  const intensity = Math.min(1, Math.max(0, value / maxValue))

  // Colors from variant or tokens
  const textColor = ctx?.variant.colors.text.primary ?? COLORS.textPrimary
  const borderColor = ctx?.variant.colors.border.primary ?? COLORS.borderDefault
  const accentColor = ctx?.variant.colors.signal.accent ?? COLORS.accentCyan

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
      {/* Numeric value */}
      <span
        style={{
          color: textColor,
          fontFamily: TYPOGRAPHY.fontFamilyString,
          fontVariantNumeric: 'tabular-nums',
          minWidth: '24px',
        }}
      >
        {value}
      </span>

      {/* Progress bar */}
      {showBar && (
        <div
          style={{
            flex: 1,
            height: '3px',
            backgroundColor: borderColor,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${intensity * 100}%`,
              height: '100%',
              backgroundColor: accentColor,
              opacity: 0.5,
              transition: 'width 0.2s ease-out',
            }}
          />
        </div>
      )}
    </div>
  )
}

ValueCellRenderer.displayName = 'ValueCellRenderer'
