/**
 * StatusCellRenderer
 *
 * Renders status with colored indicator dot and label.
 * Supports flash severity highlighting.
 *
 * @module
 */

import type { ICellRendererParams } from 'ag-grid-community'
import { useDataGridContextMaybe } from '../components/DataGridContext'
import { STATUS_COLORS, TYPOGRAPHY } from '../theme'
import { extractStatusColors } from '../composer'

// =============================================================================
// TYPES
// =============================================================================

export type StatusType = 'active' | 'pending' | 'inactive' | string

// =============================================================================
// COMPONENT
// =============================================================================

export function StatusCellRenderer(params: ICellRendererParams) {
  const ctx = useDataGridContextMaybe()
  const status = params.value as StatusType

  // Use variant status colors if available, fall back to tokens
  const statusColors = ctx?.variant
    ? extractStatusColors(ctx.variant)
    : STATUS_COLORS

  const color =
    status === 'active'
      ? statusColors.active
      : status === 'pending'
        ? statusColors.pending
        : status === 'inactive'
          ? statusColors.inactive
          : statusColors.default

  const fontSize = ctx?.variant.density.fontSizeXs ?? TYPOGRAPHY.fontSizeXs

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {/* Indicator dot with glow */}
      <div
        style={{
          width: '6px',
          height: '6px',
          backgroundColor: color,
          boxShadow: `0 0 4px ${color}60`,
        }}
      />
      {/* Status label */}
      <span
        style={{
          color,
          fontSize,
          fontFamily: TYPOGRAPHY.fontFamilyString,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 500,
        }}
      >
        {status}
      </span>
    </div>
  )
}

StatusCellRenderer.displayName = 'StatusCellRenderer'
