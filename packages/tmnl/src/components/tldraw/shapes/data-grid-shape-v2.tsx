/**
 * DataGridWidgetShapeV2
 *
 * AG-Grid embedded in tldraw using the NEW Tmnl.DataGrid compound component.
 * Mirror of data-grid-shape.tsx but using the consolidated implementation.
 */

import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type TLBaseShape,
  type TLResizeInfo,
  resizeBox,
  stopEventPropagation,
  useEditor,
} from 'tldraw'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Table2, Settings2 } from 'lucide-react'
import type { ColDef, GridReadyEvent, GridApi } from 'ag-grid-community'

// NEW: Unified DataGrid from lib/data-grid
import {
  Tmnl,
  tmnlDenseDark,
  tmnlUltraOps,
  type GridVariantType,
  IdCellRenderer,
  StatusCellRenderer,
  ValueCellRenderer,
  DragHandleRenderer,
} from '@/lib/data-grid'

// Drawer and TableService integration
import { useDrawer } from '@/lib/drawer'
import { useTableService, type GridId } from '@/lib/table-service'

// =============================================================================
// SHAPE TYPE
// =============================================================================

export interface DataGridRowV2 {
  id: string
  name: string
  value: number
  status: 'active' | 'pending' | 'inactive' | 'alert'
}

export type DataGridWidgetShapeV2 = TLBaseShape<
  'data-grid-widget-v2',
  {
    w: number
    h: number
    title: string
    rowData: DataGridRowV2[]
    gridId: string
    variantId: string
  }
>

// =============================================================================
// GRID COMPONENT (V2)
// =============================================================================

interface DataGridWidgetV2ComponentProps {
  shape: DataGridWidgetShapeV2
}

function DataGridWidgetV2Component({ shape }: DataGridWidgetV2ComponentProps) {
  const editor = useEditor()
  const drawer = useDrawer()
  const {
    activeVariant,
    getVariantForGrid,
    isReady,
  } = useTableService()

  const { title, rowData, gridId, variantId } = shape.props

  // Load variant for this grid
  const [variant, setVariant] = useState<GridVariantType>(tmnlDenseDark)

  useEffect(() => {
    if (isReady) {
      getVariantForGrid(gridId as GridId).then((v) => {
        if (v) setVariant(v)
      }).catch(console.error)
    }
  }, [gridId, isReady, getVariantForGrid])

  // Column definitions
  const columnDefs = useMemo<ColDef<DataGridRowV2>[]>(() => [
    {
      field: 'drag',
      headerName: '',
      width: 28,
      suppressSizeToFit: true,
      rowDrag: true,
      cellRenderer: DragHandleRenderer,
    },
    {
      field: 'id',
      headerName: 'ID',
      width: 70,
      suppressSizeToFit: true,
      cellRenderer: IdCellRenderer,
    },
    {
      field: 'name',
      headerName: 'NAME',
      flex: 1,
      cellStyle: {
        textTransform: 'uppercase',
        letterSpacing: '0.02em',
      },
    },
    {
      field: 'value',
      headerName: 'VALUE',
      width: 100,
      cellRenderer: ValueCellRenderer,
    },
    {
      field: 'status',
      headerName: 'STATUS',
      width: 90,
      cellRenderer: StatusCellRenderer,
    },
  ], [])

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
  }), [])

  // Open settings drawer
  const handleSettingsClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    drawer.openDrawer({
      id: `grid-settings-${gridId}`,
      side: 'right',
      renderContent: () => (
        <div className="p-4">
          <div
            className="font-mono uppercase tracking-widest text-neutral-500 mb-4"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Grid Settings (V2)
          </div>
          <div className="text-neutral-400" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Grid ID: {gridId}
          </div>
          <div className="text-neutral-400 mt-2" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Variant: {variant.id}
          </div>
          <div className="text-neutral-600 mt-4 italic" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
            Full variant builder coming soon...
          </div>
        </div>
      ),
    })
  }, [drawer, gridId, variant.id])

  // Update title
  const handleTitleChange = useCallback((newTitle: string) => {
    editor.updateShape<DataGridWidgetShapeV2>({
      id: shape.id,
      type: 'data-grid-widget-v2',
      props: { title: newTitle },
    })
  }, [editor, shape.id])

  return (
    <div
      className="w-full h-full bg-black border border-neutral-800 flex flex-col overflow-hidden group"
      onPointerDown={stopEventPropagation}
    >
      {/* Using Tmnl.DataGrid compound component */}
      <Tmnl.DataGrid
        id={gridId}
        variant={variant}
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        getRowId={(params) => params.data.id}
      >
        <Tmnl.DataGrid.Header>
          <Tmnl.DataGrid.Title title={title} badge={rowData.length} />
          <button
            onClick={handleSettingsClick}
            className="p-1 hover:bg-white/5 transition-colors"
          >
            <Settings2
              size={12}
              className="text-neutral-600 hover:text-white transition-colors"
            />
          </button>
        </Tmnl.DataGrid.Header>
        <Tmnl.DataGrid.Body />
        <Tmnl.DataGrid.StatusBar>
          <span className="text-cyan-500">V2</span>
          <span>{rowData.length} rows</span>
        </Tmnl.DataGrid.StatusBar>
        <Tmnl.DataGrid.CornerDecorations />
      </Tmnl.DataGrid>
    </div>
  )
}

// =============================================================================
// SHAPE UTIL
// =============================================================================

export class DataGridWidgetShapeUtilV2 extends BaseBoxShapeUtil<DataGridWidgetShapeV2> {
  static override type = 'data-grid-widget-v2' as const
  static override props = {
    w: T.number,
    h: T.number,
    title: T.string,
    rowData: T.arrayOf(T.any),
    gridId: T.string,
    variantId: T.string,
  }

  override canResize() {
    return true
  }

  override canEdit() {
    return false
  }

  getDefaultProps(): DataGridWidgetShapeV2['props'] {
    const gridId = `grid-v2-${Date.now()}`
    return {
      w: 400,
      h: 300,
      title: 'DATA GRID V2',
      rowData: [
        { id: 'E001', name: 'RADAR-ALPHA', value: 92, status: 'active' },
        { id: 'E002', name: 'COMMS-DELTA', value: 67, status: 'active' },
        { id: 'E003', name: 'JAMMER-SIGMA', value: 45, status: 'pending' },
        { id: 'E004', name: 'BEACON-OMEGA', value: 88, status: 'active' },
        { id: 'E005', name: 'SAT-UPLINK', value: 23, status: 'inactive' },
        { id: 'E006', name: 'RELAY-THETA', value: 71, status: 'active' },
      ],
      gridId,
      variantId: 'tmnl-dense-dark',
    }
  }

  override onResize(shape: DataGridWidgetShapeV2, info: TLResizeInfo<DataGridWidgetShapeV2>) {
    return resizeBox(shape, info)
  }

  override component(shape: DataGridWidgetShapeV2) {
    return (
      <HTMLContainer
        id={shape.id}
        style={{
          width: '100%',
          height: '100%',
          pointerEvents: 'all',
        }}
      >
        <DataGridWidgetV2Component shape={shape} />
      </HTMLContainer>
    )
  }

  override indicator(shape: DataGridWidgetShapeV2) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  }
}
