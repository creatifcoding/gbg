/**
 * DataGridTitle
 *
 * Grid title with scaled typography.
 * Self-contained — just renders its prop.
 */

import { memo } from 'react'
import { useDataGrid } from '../DataGridContext'
import { TMNL_TOKENS } from '../theme'

export interface DataGridTitleProps {
  /** The title text */
  title: string
  className?: string
}

export const DataGridTitle = memo(function DataGridTitle({
  title,
  className = '',
}: DataGridTitleProps) {
  const { scaledPx } = useDataGrid()

  return (
    <span
      className={`font-mono uppercase tracking-widest text-neutral-500 group-hover:text-white transition-colors ${className}`}
      style={{ fontSize: scaledPx(TMNL_TOKENS.typography.fontSizeSm) }}
    >
      {title}
    </span>
  )
})

DataGridTitle.displayName = 'DataGrid.Title'
