/**
 * NameCellRenderer
 *
 * Renders entity names with uppercase styling.
 *
 * @module
 */

import type { ICellRendererParams } from 'ag-grid-community'
import { useDataGridContextMaybe } from '../components/DataGridContext'
import { COLORS, TYPOGRAPHY } from '../theme'

// =============================================================================
// COMPONENT
// =============================================================================

export function NameCellRenderer(params: ICellRendererParams) {
  const ctx = useDataGridContextMaybe()

  const color = ctx?.variant.colors.text.primary ?? COLORS.textPrimary

  return (
    <span
      style={{
        color,
        fontFamily: TYPOGRAPHY.fontFamilyString,
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      }}
    >
      {params.value}
    </span>
  )
}

NameCellRenderer.displayName = 'NameCellRenderer'
