/**
 * ListHeader Component
 *
 * Level 3: Column headers for list view with sorting.
 *
 * @module file-browser/components/Content
 */

import { memo, useCallback } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

import { useFileBrowserContext } from '../FileBrowser/context'
import { DARK_SIDE } from '../../tokens'
import type { SortOrder } from '../../schemas'

// =============================================================================
// Types
// =============================================================================

export interface ListHeaderProps {
  /** Additional CSS class */
  className?: string
}

type SortField = SortOrder['field']

interface ColumnDef {
  field: SortField
  label: string
  width: string
  align?: 'left' | 'right' | 'center'
}

// =============================================================================
// Column Definitions
// =============================================================================

const COLUMNS: readonly ColumnDef[] = [
  { field: 'name', label: 'NAME', width: '3fr', align: 'left' },
  { field: 'size', label: 'SIZE', width: '100px', align: 'right' },
  { field: 'type', label: 'TYPE', width: '80px', align: 'left' },
  { field: 'modifiedAt', label: 'MODIFIED', width: '140px', align: 'right' },
]

// =============================================================================
// Component
// =============================================================================

export const ListHeader = memo(function ListHeader({ className = '' }: ListHeaderProps) {
  const { sortOrder, setSortOrder } = useFileBrowserContext()

  const handleSort = useCallback(
    (field: SortField) => {
      setSortOrder({
        field,
        direction:
          sortOrder.field === field
            ? sortOrder.direction === 'asc'
              ? 'desc'
              : 'asc'
            : 'asc',
      })
    },
    [sortOrder, setSortOrder]
  )

  return (
    <div
      className={`list-header ${className}`}
      style={{
        display: 'grid',
        gridTemplateColumns: COLUMNS.map((c) => c.width).join(' '),
        gap: DARK_SIDE.spacing['2'],
        padding: `${DARK_SIDE.spacing['2']} ${DARK_SIDE.spacing['4']}`,
        background: DARK_SIDE.colors.surfaceAlt,
        borderBottom: `1px solid ${DARK_SIDE.colors.border.default}`,
        fontFamily: DARK_SIDE.typography.family.mono,
        fontSize: DARK_SIDE.typography.size.xs,
        color: DARK_SIDE.colors.text.tertiary,
        letterSpacing: DARK_SIDE.typography.letterSpacing.wider,
        userSelect: 'none',
      }}
      role="row"
    >
      {COLUMNS.map((col) => {
        const isActive = sortOrder.field === col.field
        const Icon = sortOrder.direction === 'asc' ? ChevronUp : ChevronDown

        return (
          <button
            key={col.field}
            onClick={() => handleSort(col.field)}
            className="list-header-cell"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: col.align === 'right' ? 'flex-end' : 'flex-start',
              gap: DARK_SIDE.spacing['1'],
              padding: 0,
              background: 'transparent',
              border: 'none',
              color: isActive
                ? DARK_SIDE.colors.accent.cyan
                : DARK_SIDE.colors.text.tertiary,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              letterSpacing: 'inherit',
              transition: `color ${DARK_SIDE.animation.duration.fast}`,
            }}
            role="columnheader"
            aria-sort={
              isActive ? (sortOrder.direction === 'asc' ? 'ascending' : 'descending') : 'none'
            }
          >
            <span>{col.label}</span>
            {isActive && <Icon size={12} />}
          </button>
        )
      })}

      {/* Hover styles */}
      <style>{`
        .list-header-cell:hover {
          color: ${DARK_SIDE.colors.text.secondary} !important;
        }
      `}</style>
    </div>
  )
})
