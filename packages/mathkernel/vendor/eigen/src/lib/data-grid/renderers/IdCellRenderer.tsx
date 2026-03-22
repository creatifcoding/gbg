/**
 * IdCellRenderer
 *
 * Renders row IDs with muted styling and monospace font.
 *
 * @module
 */

import type { ICellRendererParams } from 'ag-grid-community'
import { useDataGridContextMaybe } from '../components/DataGridContext'
import { COLORS, TYPOGRAPHY } from '../theme'

// =============================================================================
// COMPONENT
// =============================================================================

export function IdCellRenderer(params: ICellRendererParams) {
  const ctx = useDataGridContextMaybe()

  // Use variant colors if in context, fall back to tokens
  const color = ctx?.variant.colors.text.muted ?? COLORS.textMuted
  const fontSize = ctx?.variant.density.fontSizeXs ?? TYPOGRAPHY.fontSizeXs

  return (
    <span
      style={{
        color,
        fontSize,
        fontFamily: TYPOGRAPHY.fontFamilyString,
        letterSpacing: '0.05em',
      }}
    >
      {params.value}
    </span>
  )
}

IdCellRenderer.displayName = 'IdCellRenderer'
