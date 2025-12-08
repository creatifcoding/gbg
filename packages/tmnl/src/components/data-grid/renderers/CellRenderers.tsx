/**
 * Cell Renderers
 *
 * Custom AG-Grid cell renderers with TMNL styling.
 */

import { GripVertical } from 'lucide-react'
import type { ICellRendererParams } from 'ag-grid-community'
import { TMNL_TOKENS, STATUS_COLORS } from '../theme'

// =============================================================================
// ID CELL
// =============================================================================

export function IdCellRenderer(params: ICellRendererParams) {
  return (
    <span
      style={{
        color: TMNL_TOKENS.colors.textMuted,
        fontSize: TMNL_TOKENS.typography.fontSizeXs,
        letterSpacing: '0.05em',
      }}
    >
      {params.value}
    </span>
  )
}

// =============================================================================
// STATUS CELL
// =============================================================================

export function StatusCellRenderer(params: ICellRendererParams) {
  const status = params.value as keyof typeof STATUS_COLORS
  const color = STATUS_COLORS[status] || STATUS_COLORS.default

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div
        style={{
          width: '6px',
          height: '6px',
          backgroundColor: color,
          boxShadow: `0 0 4px ${color}60`,
        }}
      />
      <span
        style={{
          color,
          fontSize: TMNL_TOKENS.typography.fontSizeXs,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          fontWeight: 500,
        }}
      >
        {params.value}
      </span>
    </div>
  )
}

// =============================================================================
// VALUE CELL (with progress bar)
// =============================================================================

export function ValueCellRenderer(params: ICellRendererParams) {
  const value = params.value as number
  const intensity = Math.min(1, value / 100)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%',
      }}
    >
      <span
        style={{
          color: TMNL_TOKENS.colors.text,
          fontVariantNumeric: 'tabular-nums',
          minWidth: '24px',
        }}
      >
        {value}
      </span>
      <div
        style={{
          flex: 1,
          height: '3px',
          backgroundColor: TMNL_TOKENS.colors.border,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${intensity * 100}%`,
            height: '100%',
            backgroundColor: TMNL_TOKENS.colors.accent,
            opacity: 0.5,
            transition: 'width 0.2s ease-out',
          }}
        />
      </div>
    </div>
  )
}

// =============================================================================
// DRAG HANDLE
// =============================================================================

export function DragHandleRenderer(_params: ICellRendererParams) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        cursor: 'grab',
        color: TMNL_TOKENS.colors.textMuted,
        transition: 'color 0.15s ease',
      }}
      className="drag-handle"
    >
      <GripVertical size={12} />
    </div>
  )
}

// =============================================================================
// NAME CELL (editable)
// =============================================================================

export function NameCellRenderer(params: ICellRendererParams) {
  return (
    <span
      style={{
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      }}
    >
      {params.value}
    </span>
  )
}
