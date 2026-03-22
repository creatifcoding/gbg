/**
 * KVRow Primitive
 *
 * Key-value display row for metadata.
 *
 * @module file-browser/primitives
 */

import { memo, type ReactNode } from 'react'

import { DARK_SIDE } from '../tokens'

// =============================================================================
// Types
// =============================================================================

export interface KVRowProps {
  /** Label text */
  label: string
  /** Value to display */
  value: ReactNode
  /** Highlight the value */
  highlight?: boolean
  /** Use monospace font for value */
  mono?: boolean
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Component
// =============================================================================

export const KVRow = memo(function KVRow({
  label,
  value,
  highlight = false,
  mono = true,
  className = '',
}: KVRowProps) {
  return (
    <div
      className={`kv-row ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: '80px 1fr',
        gap: DARK_SIDE.spacing['2'],
        marginBottom: DARK_SIDE.spacing['1'],
        fontSize: DARK_SIDE.typography.size.xs,
        alignItems: 'baseline',
      }}
    >
      <span
        style={{
          color: DARK_SIDE.colors.text.tertiary,
          textTransform: 'uppercase',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          letterSpacing: DARK_SIDE.typography.letterSpacing.wide,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? DARK_SIDE.typography.family.mono : DARK_SIDE.typography.family.sans,
          color: highlight ? DARK_SIDE.colors.accent.green : DARK_SIDE.colors.text.secondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {value || '-'}
      </span>
    </div>
  )
})
