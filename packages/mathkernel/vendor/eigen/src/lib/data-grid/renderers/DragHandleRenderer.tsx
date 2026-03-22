/**
 * DragHandleRenderer
 *
 * Renders a drag handle grip icon for row dragging.
 *
 * @module
 */

import type { ICellRendererParams } from 'ag-grid-community'
import { useDataGridContextMaybe } from '../components/DataGridContext'
import { COLORS } from '../theme'

// =============================================================================
// GRIP ICON
// =============================================================================

function GripIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="9" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="19" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DragHandleRenderer(_params: ICellRendererParams) {
  const ctx = useDataGridContextMaybe()

  const color = ctx?.variant.colors.text.muted ?? COLORS.textMuted
  const iconSize = ctx?.variant.density.iconSize ?? 12

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        cursor: 'grab',
        color,
        transition: 'color 0.15s ease',
      }}
      className="drag-handle"
    >
      <GripIcon size={iconSize} />
    </div>
  )
}

DragHandleRenderer.displayName = 'DragHandleRenderer'
