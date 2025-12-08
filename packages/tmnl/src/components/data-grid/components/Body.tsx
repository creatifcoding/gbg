/**
 * DataGridBody
 *
 * AG-Grid wrapper with drag handlers and animations.
 */

import { useCallback, useRef, useEffect } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { GridReadyEvent, RowDragEnterEvent, RowDragEndEvent } from 'ag-grid-community'
import { gsap } from 'gsap'
import { useDataGrid } from '../DataGridContext'
import { tmnlDataGridTheme, TMNL_TOKENS } from '../theme'
import type { DataGridRow } from '../types'

export interface DataGridBodyProps {
  className?: string
}

export function DataGridBody({ className = '' }: DataGridBodyProps) {
  const {
    id,
    rowData,
    columnDefs,
    defaultColDef,
    behavior,
    containerRef,
    setGridApi,
    dragCallbacks,
    getRowClass,
    onGridReady: onGridReadyProp,
  } = useDataGrid()

  const gridRef = useRef<AgGridReact>(null)

  // ===========================================================================
  // GRID READY
  // ===========================================================================

  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
      params.api.sizeColumnsToFit()
      setGridApi(params.api)
      onGridReadyProp?.(params.api)
    },
    [setGridApi, onGridReadyProp]
  )

  // ===========================================================================
  // ROW DRAG HANDLERS
  // ===========================================================================

  const onRowDragEnter = useCallback(
    (event: RowDragEnterEvent) => {
      const rowDataItem = event.node.data as DataGridRow
      console.log('[DataGrid.Body] Row drag enter:', rowDataItem.name)

      // Highlight row
      const rowEl = event.node.rowElement
      if (rowEl) {
        gsap.to(rowEl, {
          boxShadow: 'inset 0 0 15px rgba(255, 255, 255, 0.15)',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          duration: 0.2,
          ease: 'power2.out',
        })
      }

      // Glow container
      if (containerRef.current) {
        gsap.to(containerRef.current, {
          borderColor: 'rgba(255, 255, 255, 0.5)',
          boxShadow:
            '0 0 15px rgba(255, 255, 255, 0.2), inset 0 0 20px rgba(255, 255, 255, 0.05)',
          duration: 0.3,
          ease: 'power2.out',
        })
      }

      // Fire callback
      if (dragCallbacks?.onDragStart) {
        dragCallbacks.onDragStart({
          _tag: 'GridDragStart',
          rowData: rowDataItem,
          gridId: id,
          startPos: { x: event.event.clientX, y: event.event.clientY },
        })
      }
    },
    [containerRef, dragCallbacks, id]
  )

  const onRowDragEnd = useCallback(
    (event: RowDragEndEvent) => {
      console.log('[DataGrid.Body] Row drag end')

      // Reset row highlight
      const rowEl = event.node.rowElement
      if (rowEl) {
        gsap.to(rowEl, {
          boxShadow: 'none',
          backgroundColor: 'transparent',
          duration: 0.2,
        })
      }

      // Reset container
      if (containerRef.current) {
        gsap.to(containerRef.current, {
          borderColor: TMNL_TOKENS.colors.border,
          boxShadow: 'none',
          duration: 0.2,
        })
      }
    },
    [containerRef]
  )

  // Resize columns when data changes
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.sizeColumnsToFit()
    }
  }, [rowData])

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div className={`flex-1 ${className}`}>
      <AgGridReact
        ref={gridRef}
        theme={tmnlDataGridTheme}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        onGridReady={onGridReady}
        animateRows={true}
        rowSelection={{ mode: 'singleRow' }}
        suppressMovableColumns={!behavior.enableReorder}
        rowDragManaged={behavior.enableReorder}
        onRowDragEnter={onRowDragEnter}
        onRowDragEnd={onRowDragEnd}
        getRowClass={getRowClass}
      />
    </div>
  )
}

DataGridBody.displayName = 'DataGrid.Body'
