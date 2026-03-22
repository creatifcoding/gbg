/**
 * DataGrid Component (Root Orchestrator)
 *
 * Compound component pattern for modular AG-Grid.
 * Works both on and off the tldraw canvas.
 */

import { useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ModuleRegistry,
  AllCommunityModule,
  type ColDef,
  type GridApi,
  type RowClassParams,
} from 'ag-grid-community'
import { DataGridProvider, createScaleHelpers } from './DataGridContext'
import { TMNL_TOKENS } from './theme'
import {
  IdCellRenderer,
  StatusCellRenderer,
  ValueCellRenderer,
  DragHandleRenderer,
} from './renderers'
// Subcomponents imported but not used directly here — attached via index.ts
import type { DataGridRow, DragCallbacks, GridBehaviorConfig } from './types'

// Register AG-Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

// =============================================================================
// PROPS
// =============================================================================

export interface DataGridProps {
  /** Unique grid identifier */
  id: string
  /** Row data */
  rowData: DataGridRow[]
  /** Width (pixels or '100%') */
  width?: number | string
  /** Height (pixels or '100%') */
  height?: number | string
  /** Scale factor for typography [0.5, 2.0], default 1.0 */
  scaleFactor?: number
  /** Behavior configuration */
  behavior?: Partial<GridBehaviorConfig>
  /** Drag event callbacks */
  dragCallbacks?: DragCallbacks
  /** Called when grid is ready */
  onGridReady?: (api: GridApi) => void
  /** Row class callback for AG-Grid */
  getRowClass?: (params: RowClassParams) => string
  /** Additional class names */
  className?: string
  /** Custom children for compound composition */
  children: ReactNode
}

// =============================================================================
// DEFAULT BEHAVIOR
// =============================================================================

const DEFAULT_BEHAVIOR: GridBehaviorConfig = {
  enableDrag: true,
  enableExternalDrop: false,
  enableReorder: true,
  enableEdit: false,
  enableSort: true,
  enableResize: true,
}

// =============================================================================
// COMPONENT
// =============================================================================

export function DataGrid({
  id,
  rowData,
  width = '100%',
  height = '100%',
  scaleFactor = 1.0,
  behavior: behaviorOverrides = {},
  dragCallbacks,
  onGridReady,
  getRowClass,
  className = '',
  children,
}: DataGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [gridApi, setGridApi] = useState<GridApi | null>(null)

  const behavior = useMemo(
    () => ({ ...DEFAULT_BEHAVIOR, ...behaviorOverrides }),
    [behaviorOverrides]
  )

  // ===========================================================================
  // SCALE HELPERS
  // ===========================================================================

  const { scaled, scaledPx, scaleFactor: clampedScale } = useMemo(
    () => createScaleHelpers(scaleFactor),
    [scaleFactor]
  )

  // ===========================================================================
  // COLUMN DEFINITIONS
  // ===========================================================================

  const columnDefs = useMemo<ColDef<DataGridRow>[]>(
    () => [
      // Drag handle column
      ...(behavior.enableDrag
        ? [
            {
              headerName: '',
              width: 28,
              rowDrag: true,
              suppressSizeToFit: true,
              cellRenderer: DragHandleRenderer,
              cellStyle: { padding: 0 },
            } as ColDef<DataGridRow>,
          ]
        : []),
      // ID column
      {
        field: 'id' as const,
        headerName: 'ID',
        width: 50,
        suppressSizeToFit: true,
        cellRenderer: IdCellRenderer,
      },
      // Name column
      {
        field: 'name' as const,
        headerName: 'NAME',
        flex: 1,
        editable: behavior.enableEdit,
        cellStyle: {
          textTransform: 'uppercase',
          letterSpacing: '0.02em',
        },
      },
      // Value column
      {
        field: 'value' as const,
        headerName: 'VALUE',
        width: 90,
        editable: behavior.enableEdit,
        cellRenderer: ValueCellRenderer,
      },
      // Status column
      {
        field: 'status' as const,
        headerName: 'STATUS',
        width: 90,
        cellRenderer: StatusCellRenderer,
      },
    ],
    [behavior.enableDrag, behavior.enableEdit]
  )

  const defaultColDef = useMemo<ColDef>(
    () => ({
      resizable: behavior.enableResize,
      sortable: behavior.enableSort,
    }),
    [behavior.enableResize, behavior.enableSort]
  )

  // ===========================================================================
  // CONTEXT VALUE
  // ===========================================================================

  const contextValue = useMemo(
    () => ({
      id,
      rowData,
      behavior,
      scaleFactor: clampedScale,
      scaled,
      scaledPx,
      gridApi,
      setGridApi,
      containerRef,
      columnDefs,
      defaultColDef,
      dragCallbacks,
      getRowClass,
      onGridReady,
    }),
    [
      id,
      rowData,
      behavior,
      clampedScale,
      scaled,
      scaledPx,
      gridApi,
      containerRef,
      columnDefs,
      defaultColDef,
      dragCallbacks,
      getRowClass,
      onGridReady,
    ]
  )

  // ===========================================================================
  // CONTAINER STYLE
  // ===========================================================================

  const containerStyle = useMemo(
    () => ({
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
      transition: 'border-color 0.15s ease',
    }),
    [width, height]
  )

  // ===========================================================================
  // COMPOUND PATTERN - children required (enforced by types)
  // ===========================================================================

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <DataGridProvider value={contextValue}>
      <div
        ref={containerRef}
        className={`bg-black border border-neutral-800 flex flex-col overflow-hidden group relative ${className}`}
        style={containerStyle}
      >
        {children}
      </div>
    </DataGridProvider>
  )
}

// =============================================================================
// COMPOUND SUBCOMPONENTS (attached after import)
// =============================================================================

// These are attached in index.ts for dot-access pattern
