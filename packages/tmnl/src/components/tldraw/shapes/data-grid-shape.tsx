/**
 * DataGridWidgetShape
 *
 * AG-Grid embedded in tldraw with hybrid drag:
 * - Internal reordering via AG-Grid's rowDragManaged
 * - External drop via pointer events + ghost shape
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
  createShapeId,
} from 'tldraw'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Table2, GripVertical, Settings2 } from 'lucide-react'
import { AgGridReact } from 'ag-grid-react'
import {
  ModuleRegistry,
  AllCommunityModule,
  type ColDef,
  type GridReadyEvent,
  type ICellRendererParams,
  type GridApi,
  type RowDragEnterEvent,
  type RowDragEndEvent,
  type RowDragMoveEvent,
  type RowDragLeaveEvent,
} from 'ag-grid-community'
import { gsap } from 'gsap'

// Import from modular data-grid
import { tmnlDataGridTheme, TMNL_TOKENS, STATUS_COLORS, VariantBuilder } from '@/components/data-grid'
import type { DataGridRow } from '@/components/data-grid'

// Drawer and TableService integration
import { useDrawer } from '@/lib/drawer'
import { useTableService, type GridId } from '@/lib/table-service'
import type { GridVariant, GridVariantPartial } from '@/lib/data-grid/schemas/variant'

// Re-export for backwards compatibility
export type { DataGridRow }

// Register AG-Grid modules
ModuleRegistry.registerModules([AllCommunityModule])

// =============================================================================
// CELL RENDERERS
// =============================================================================

function IdCellRenderer(params: ICellRendererParams) {
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

function StatusCellRenderer(params: ICellRendererParams) {
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

function ValueCellRenderer(params: ICellRendererParams) {
  const value = params.value as number
  const intensity = Math.min(1, value / 100)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
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

function DragHandleRenderer(_params: ICellRendererParams) {
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
// SETTINGS DRAWER CONTENT
// =============================================================================

interface GridSettingsDrawerProps {
  gridId: string
  drawerId: string
}

function GridSettingsDrawer({ gridId, drawerId }: GridSettingsDrawerProps) {
  const drawer = useDrawer()
  const {
    activeVariant,
    getVariantForGrid,
    setGridOverride,
    clearGridOverride,
    isReady,
  } = useTableService()

  const [localVariant, setLocalVariant] = useState<GridVariant | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Load variant for this grid
  useEffect(() => {
    if (isReady) {
      getVariantForGrid(gridId as GridId).then(setLocalVariant).catch(console.error)
    }
  }, [gridId, isReady, getVariantForGrid])

  const handleVariantChange = useCallback((updates: Partial<GridVariant>) => {
    setLocalVariant((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        ...updates,
        colors: updates.colors
          ? {
              background: { ...prev.colors.background, ...updates.colors.background },
              text: { ...prev.colors.text, ...updates.colors.text },
              signal: { ...prev.colors.signal, ...updates.colors.signal },
              border: { ...prev.colors.border, ...updates.colors.border },
              flash: updates.colors.flash ?? prev.colors.flash,
            }
          : prev.colors,
        behavior: updates.behavior
          ? {
              ...prev.behavior,
              ...updates.behavior,
              microInteractions: {
                ...prev.behavior.microInteractions,
                ...updates.behavior.microInteractions,
              },
              resize: { ...prev.behavior.resize, ...updates.behavior?.resize },
              sort: { ...prev.behavior.sort, ...updates.behavior?.sort },
              drag: { ...prev.behavior.drag, ...updates.behavior?.drag },
            }
          : prev.behavior,
        density: updates.density
          ? { ...prev.density, ...updates.density }
          : prev.density,
      }
    })
    setHasChanges(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!localVariant) return
    const overrides: GridVariantPartial = {
      colors: localVariant.colors,
      behavior: localVariant.behavior,
      density: localVariant.density,
    }
    await setGridOverride(gridId as GridId, overrides)
    setHasChanges(false)
    drawer.close(drawerId)
  }, [gridId, localVariant, setGridOverride, drawer, drawerId])

  const handleReset = useCallback(async () => {
    await clearGridOverride(gridId as GridId)
    const fresh = await getVariantForGrid(gridId as GridId)
    setLocalVariant(fresh)
    setHasChanges(false)
  }, [gridId, clearGridOverride, getVariantForGrid])

  const handleCancel = useCallback(() => {
    drawer.close(drawerId)
  }, [drawer, drawerId])

  if (!localVariant) {
    return (
      <div className="p-4 text-neutral-500 font-mono" style={{ fontSize: 10 }}>
        Loading variant...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-4 py-3 border-b border-neutral-800">
        <div className="font-mono uppercase tracking-widest text-neutral-300" style={{ fontSize: 11 }}>
          Grid Settings
        </div>
        <div className="font-mono text-neutral-600" style={{ fontSize: 9 }}>
          ID: {gridId}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <VariantBuilder variant={localVariant} onChange={handleVariantChange} />
      </div>

      <div className="flex-shrink-0 px-4 py-3 border-t border-neutral-800 flex items-center justify-between">
        <button
          onClick={handleReset}
          className="px-3 py-1.5 border border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-white transition-colors font-mono uppercase"
          style={{ fontSize: 9 }}
        >
          Reset
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 border border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-white transition-colors font-mono uppercase"
            style={{ fontSize: 9 }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`
              px-3 py-1.5 border transition-colors font-mono uppercase
              ${hasChanges
                ? 'border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10'
                : 'border-neutral-800 text-neutral-600 cursor-not-allowed'
              }
            `}
            style={{ fontSize: 9 }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

// =============================================================================
// SHAPE TYPE
// =============================================================================

export type DataGridWidgetShape = TLBaseShape<
  'data-grid-widget',
  {
    w: number
    h: number
    rowData: DataGridRow[]
    title: string
  }
>

// =============================================================================
// SPAWN DATA CARD
// =============================================================================

function spawnDataCard(
  editor: ReturnType<typeof useEditor>,
  rowData: DataGridRow,
  point: { x: number; y: number },
  sourceGridId: string
) {
  console.log('[spawnDataCard] Creating card for:', rowData.name, 'at', point)

  const cardWidth = 180
  const cardHeight = 100
  const shapeId = createShapeId()

  try {
    editor.createShape({
      id: shapeId,
      type: 'data-card',
      x: point.x - cardWidth / 2,
      y: point.y - cardHeight / 2,
      props: {
        w: cardWidth,
        h: cardHeight,
        rowData: rowData,
        sourceGridId: sourceGridId,
      },
    })

    console.log('[spawnDataCard] Created shape:', shapeId)
    editor.select(shapeId)

    // Animate spawn
    requestAnimationFrame(() => {
      const shapeEl = document.querySelector(`[data-shape-id="${shapeId}"]`)
      if (shapeEl) {
        gsap.fromTo(
          shapeEl,
          { scale: 0.5, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(1.7)' }
        )
      }
    })
  } catch (err) {
    console.error('[spawnDataCard] Error:', err)
  }
}

// =============================================================================
// DRAG STATE
// =============================================================================

interface DragState {
  isDragging: boolean
  isOutsideGrid: boolean
  rowData: DataGridRow | null
  ghostId: string | null
}

const INITIAL_DRAG_STATE: DragState = {
  isDragging: false,
  isOutsideGrid: false,
  rowData: null,
  ghostId: null,
}

// =============================================================================
// DATA GRID COMPONENT
// =============================================================================

function DataGridComponent({ shape }: { shape: DataGridWidgetShape }) {
  const editor = useEditor()
  const drawer = useDrawer()
  const { rowData, title, w, h } = shape.props
  const gridRef = useRef<AgGridReact>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const gridApiRef = useRef<GridApi | null>(null)

  // Hybrid drag state
  const [dragState, setDragState] = useState<DragState>(INITIAL_DRAG_STATE)

  // Settings drawer
  const settingsDrawerId = `grid-settings-${shape.id}`
  const handleOpenSettings = useCallback(() => {
    drawer.open({
      id: settingsDrawerId,
      slot: 'global',
      content: <GridSettingsDrawer gridId={shape.id} drawerId={settingsDrawerId} />,
      side: 'right',
      width: 320,
    })
  }, [drawer, shape.id, settingsDrawerId])
  const dragStateRef = useRef(dragState)
  dragStateRef.current = dragState

  const gridHeight = h - 22
  const gridWidth = w - 2

  // ===========================================================================
  // COLUMN DEFINITIONS
  // ===========================================================================

  const columnDefs = useMemo<ColDef<DataGridRow>[]>(
    () => [
      {
        headerName: '',
        width: 28,
        rowDrag: true,
        suppressSizeToFit: true,
        cellRenderer: DragHandleRenderer,
        cellStyle: { padding: 0 },
      },
      {
        field: 'id',
        headerName: 'ID',
        width: 50,
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
        width: 90,
        cellRenderer: ValueCellRenderer,
      },
      {
        field: 'status',
        headerName: 'STATUS',
        width: 90,
        cellRenderer: StatusCellRenderer,
      },
    ],
    []
  )

  const defaultColDef = useMemo<ColDef>(() => ({
    resizable: true,
    sortable: true,
  }), [])

  // ===========================================================================
  // GHOST SHAPE MANAGEMENT
  // ===========================================================================

  const createGhost = useCallback(
    (rowData: DataGridRow, screenPos: { x: number; y: number }) => {
      const canvasPos = editor.screenToPage(screenPos)
      const ghostId = createShapeId()

      console.log('[createGhost] Creating at canvas pos:', canvasPos)

      editor.createShape({
        id: ghostId,
        type: 'acquire-ghost',
        x: canvasPos.x - 30,
        y: canvasPos.y - 30,
        props: {
          w: 60,
          h: 60,
          rowName: rowData.name,
          status: rowData.status,
        },
      })

      return ghostId
    },
    [editor]
  )

  const updateGhost = useCallback(
    (ghostId: string, screenPos: { x: number; y: number }) => {
      const canvasPos = editor.screenToPage(screenPos)
      const ghost = editor.getShape(ghostId as any)
      if (ghost) {
        editor.updateShape({
          id: ghostId as any,
          type: 'acquire-ghost',
          x: canvasPos.x - 30,
          y: canvasPos.y - 30,
        })
      }
    },
    [editor]
  )

  const removeGhost = useCallback(
    (ghostId: string) => {
      console.log('[removeGhost] Removing:', ghostId)
      try {
        editor.deleteShape(ghostId as any)
      } catch (e) {
        // Shape may already be deleted
      }
    },
    [editor]
  )

  // ===========================================================================
  // POINTER EVENT HANDLERS (for canvas tracking)
  // ===========================================================================

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current
      if (!state.isOutsideGrid || !state.ghostId) return

      updateGhost(state.ghostId, { x: e.clientX, y: e.clientY })
    }

    const handlePointerUp = (e: PointerEvent) => {
      const state = dragStateRef.current
      if (!state.isOutsideGrid || !state.rowData) return

      console.log('[handlePointerUp] Dropping at:', e.clientX, e.clientY)

      // Remove ghost
      if (state.ghostId) {
        removeGhost(state.ghostId)
      }

      // Spawn data card
      const canvasPos = editor.screenToPage({ x: e.clientX, y: e.clientY })
      spawnDataCard(editor, state.rowData, canvasPos, shape.id)

      // Reset state
      setDragState(INITIAL_DRAG_STATE)

      // Reset visual feedback
      if (containerRef.current) {
        gsap.to(containerRef.current, {
          borderColor: TMNL_TOKENS.colors.border,
          boxShadow: 'none',
          duration: 0.2,
        })
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const state = dragStateRef.current
        if (state.ghostId) {
          removeGhost(state.ghostId)
        }
        setDragState(INITIAL_DRAG_STATE)

        if (containerRef.current) {
          gsap.to(containerRef.current, {
            borderColor: TMNL_TOKENS.colors.border,
            boxShadow: 'none',
            duration: 0.2,
          })
        }
      }
    }

    // Only attach listeners when in canvas tracking mode
    if (dragState.isOutsideGrid) {
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      window.addEventListener('keydown', handleKeyDown)

      return () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [dragState.isOutsideGrid, editor, shape.id, updateGhost, removeGhost])

  // ===========================================================================
  // AG-GRID EVENT HANDLERS
  // ===========================================================================

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit()
    gridApiRef.current = params.api
    console.log('[AG-Grid] Ready')
  }, [])

  const onRowDragEnter = useCallback((event: RowDragEnterEvent) => {
    const row = event.node.data as DataGridRow
    console.log('[AG-Grid] Row drag enter:', row.name)

    setDragState({
      isDragging: true,
      isOutsideGrid: false,
      rowData: row,
      ghostId: null,
    })

    // Highlight row
    const rowEl = event.node.rowElement
    if (rowEl) {
      gsap.to(rowEl, {
        boxShadow: 'inset 0 0 15px rgba(255, 255, 255, 0.15)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        duration: 0.2,
      })
    }

    // Glow container
    if (containerRef.current) {
      gsap.to(containerRef.current, {
        borderColor: 'rgba(255, 255, 255, 0.5)',
        boxShadow: '0 0 15px rgba(255, 255, 255, 0.2)',
        duration: 0.3,
      })
    }
  }, [])

  const onRowDragMove = useCallback(
    (event: RowDragMoveEvent) => {
      const state = dragStateRef.current
      if (!state.isDragging || !state.rowData) return

      // Check if cursor is outside grid bounds
      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      const { clientX, clientY } = event.event as MouseEvent
      const isOutside =
        clientX < containerRect.left ||
        clientX > containerRect.right ||
        clientY < containerRect.top ||
        clientY > containerRect.bottom

      if (isOutside && !state.isOutsideGrid) {
        // Transition to canvas tracking
        console.log('[AG-Grid] Exiting grid bounds, switching to pointer tracking')

        const ghostId = createGhost(state.rowData, { x: clientX, y: clientY })

        setDragState((prev) => ({
          ...prev,
          isOutsideGrid: true,
          ghostId,
        }))
      }
    },
    [createGhost]
  )

  const onRowDragLeave = useCallback((event: RowDragLeaveEvent) => {
    console.log('[AG-Grid] Row drag leave')
    // This fires when drag leaves grid - we handle this in onRowDragMove
  }, [])

  const onRowDragEnd = useCallback(
    (event: RowDragEndEvent) => {
      console.log('[AG-Grid] Row drag end')

      const state = dragStateRef.current

      // If we're in canvas tracking mode, pointer handlers will handle cleanup
      if (state.isOutsideGrid) {
        return
      }

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

      // Reset drag state
      setDragState(INITIAL_DRAG_STATE)
    },
    []
  )

  // Resize columns when shape dimensions change
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.sizeColumnsToFit()
    }
  }, [w, h])

  // ===========================================================================
  // RENDER
  // ===========================================================================

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-black border border-neutral-800 flex flex-col overflow-hidden group relative"
      style={{ transition: 'border-color 0.15s ease' }}
      onPointerDown={stopEventPropagation}
      onPointerMove={stopEventPropagation}
      onPointerUp={stopEventPropagation}
      onWheel={stopEventPropagation}
      onKeyDown={stopEventPropagation}
    >
      {/* Corner decorations */}
      <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-neutral-700" />
      <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-neutral-700" />
      <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-neutral-700" />
      <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-neutral-700" />

      {/* Header */}
      <div className="h-6 flex-shrink-0 flex items-center px-2 border-b border-neutral-800 bg-neutral-900/30">
        <Table2 size={12} className="text-neutral-600 mr-1.5" />
        <span
          className="font-mono uppercase tracking-widest text-neutral-500 group-hover:text-white transition-colors"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          {title}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="font-mono text-neutral-600 uppercase"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            {rowData.length} rows
          </span>
          <button
            onClick={handleOpenSettings}
            className="flex items-center justify-center w-5 h-5 text-neutral-600 hover:text-white transition-colors"
            aria-label="Grid settings"
          >
            <Settings2 size={11} />
          </button>
          <div
            className="w-1.5 h-1.5 bg-white/50"
            style={{ boxShadow: '0 0 4px rgba(255, 255, 255, 0.3)' }}
          />
        </div>
      </div>

      {/* Grid Area */}
      <div style={{ height: gridHeight, width: gridWidth }}>
        <AgGridReact
          ref={gridRef}
          theme={tmnlDataGridTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onGridReady={onGridReady}
          animateRows={true}
          rowSelection="single"
          suppressMovableColumns={true}
          rowDragManaged={true}
          onRowDragEnter={onRowDragEnter}
          onRowDragMove={onRowDragMove}
          onRowDragLeave={onRowDragLeave}
          onRowDragEnd={onRowDragEnd}
        />
      </div>
    </div>
  )
}

// =============================================================================
// SHAPE UTIL
// =============================================================================

export class DataGridWidgetShapeUtil extends BaseBoxShapeUtil<DataGridWidgetShape> {
  static override type = 'data-grid-widget' as const
  static override props = {
    w: T.number,
    h: T.number,
    rowData: T.arrayOf(
      T.object({
        id: T.string,
        name: T.string,
        value: T.number,
        status: T.string,
      })
    ),
    title: T.string,
  }

  override canResize() {
    return true
  }

  override canEdit() {
    return false
  }

  getDefaultProps(): DataGridWidgetShape['props'] {
    return {
      w: 340,
      h: 220,
      title: 'DATA_GRID',
      rowData: [
        { id: '001', name: 'Alpha Signal', value: 42, status: 'active' },
        { id: '002', name: 'Beta Channel', value: 87, status: 'pending' },
        { id: '003', name: 'Gamma Flux', value: 23, status: 'active' },
        { id: '004', name: 'Delta Wave', value: 56, status: 'inactive' },
        { id: '005', name: 'Epsilon Core', value: 91, status: 'active' },
      ],
    }
  }

  override onResize(
    shape: DataGridWidgetShape,
    info: TLResizeInfo<DataGridWidgetShape>
  ) {
    return resizeBox(shape, info)
  }

  override component(shape: DataGridWidgetShape) {
    return (
      <HTMLContainer
        id={shape.id}
        style={{ width: '100%', height: '100%', pointerEvents: 'all' }}
      >
        <DataGridComponent shape={shape} />
      </HTMLContainer>
    )
  }

  override indicator(shape: DataGridWidgetShape) {
    return <rect x={0} y={0} width={shape.props.w} height={shape.props.h} />
  }
}
