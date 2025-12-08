/**
 * DataGridStatusIndicator
 *
 * Row count indicator + status dot.
 * Self-contained — only re-renders when rowCount changes.
 */

import { memo } from 'react'
import { useDataGrid } from '../DataGridContext'

export interface DataGridStatusIndicatorProps {
  className?: string
}

export const DataGridStatusIndicator = memo(function DataGridStatusIndicator({
  className = '',
}: DataGridStatusIndicatorProps) {
  const { rowData, scaledPx } = useDataGrid()

  return (
    <div className={`ml-auto flex items-center gap-2 ${className}`}>
      <span
        className="font-mono text-neutral-600 uppercase"
        style={{ fontSize: scaledPx(7) }}
      >
        {rowData.length} rows
      </span>
      <div
        className="w-1.5 h-1.5 bg-white/50"
        style={{ boxShadow: '0 0 4px rgba(255, 255, 255, 0.3)' }}
      />
    </div>
  )
})

DataGridStatusIndicator.displayName = 'DataGrid.StatusIndicator'
