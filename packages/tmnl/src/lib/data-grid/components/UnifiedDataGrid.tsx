/**
 * UnifiedDataGrid
 *
 * New consolidated DataGrid with compound component pattern.
 * Each grid instance gets its own runtime with DataManager + TableService.
 *
 * @example
 * ```tsx
 * <UnifiedDataGrid id="emitters" variant={tmnlDenseDark} rowData={data}>
 *   <UnifiedDataGrid.Header>
 *     <UnifiedDataGrid.Title title="EMITTERS" />
 *     <UnifiedDataGrid.SettingsButton />
 *   </UnifiedDataGrid.Header>
 *   <UnifiedDataGrid.Body />
 * </UnifiedDataGrid>
 * ```
 *
 * @module
 */

import {
  useMemo,
  useRef,
  useState,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
  type Ref,
} from 'react'
import {
  ModuleRegistry,
  AllCommunityModule,
  type ColDef,
  type GridApi,
} from 'ag-grid-community'
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react'

import { DataGridProvider, useDataGridContext } from './DataGridContext'
import { composeAgGridTheme } from '../composer'
import type { GridVariantType, GridVariantPartialType } from '../schemas'

// Drawer system
import { useDrawerStackSafe } from '@/lib/drawer'
// TableService for variant management
import { useTableService, type GridId } from '@/lib/table-service'
// VariantBuilder UI
import { VariantBuilder } from '@/components/data-grid/VariantBuilder'

// Register AG-Grid modules once
ModuleRegistry.registerModules([AllCommunityModule])

// =============================================================================
// TYPES
// =============================================================================

export interface UnifiedDataGridProps<TData = unknown> {
  /** Unique grid identifier */
  id: string
  /** Grid variant (required) */
  variant: GridVariantType
  /** Row data */
  rowData: TData[]
  /** Column definitions */
  columnDefs?: ColDef<TData>[]
  /** Default column definition */
  defaultColDef?: ColDef<TData>
  /** Row ID getter */
  getRowId?: (params: { data: TData }) => string
  /** Width (pixels or '100%') */
  width?: number | string
  /** Height (pixels or '100%') */
  height?: number | string
  /** Additional class names */
  className?: string
  /** Children for compound composition */
  children?: ReactNode
}

export interface UnifiedDataGridHandle {
  /** AG-Grid API instance */
  api: GridApi | null
  /** Refresh all cells */
  refreshCells: () => void
  /** Size columns to fit container */
  sizeColumnsToFit: () => void
}

// =============================================================================
// ROOT COMPONENT
// =============================================================================

function UnifiedDataGridRoot<TData = unknown>(
  props: UnifiedDataGridProps<TData>,
  ref: Ref<UnifiedDataGridHandle>
) {
  const {
    id,
    variant,
    rowData,
    columnDefs = [],
    defaultColDef,
    getRowId,
    width = '100%',
    height = '100%',
    className = '',
    children,
  } = props

  const containerRef = useRef<HTMLDivElement>(null)
  const [gridApi, setGridApi] = useState<GridApi | null>(null)

  // Expose handle
  useImperativeHandle(ref, () => ({
    get api() {
      return gridApi
    },
    refreshCells() {
      gridApi?.refreshCells({ force: true })
    },
    sizeColumnsToFit() {
      gridApi?.sizeColumnsToFit()
    },
  }))

  // Container style
  const containerStyle = useMemo(
    () => ({
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height,
    }),
    [width, height]
  )

  return (
    <DataGridProvider
      gridId={id}
      variant={variant}
      rowData={rowData}
      columnDefs={columnDefs as ColDef<unknown>[]}
      defaultColDef={defaultColDef as ColDef<unknown>}
      getRowId={getRowId as (params: { data: unknown }) => string}
      gridApi={gridApi}
      setGridApi={setGridApi}
    >
      <UnifiedDataGridInner
        containerRef={containerRef}
        containerStyle={containerStyle}
        className={className}
      >
        {children}
      </UnifiedDataGridInner>
    </DataGridProvider>
  )
}

// =============================================================================
// INNER COMPONENT (inside provider)
// =============================================================================

interface UnifiedDataGridInnerProps {
  containerRef: React.RefObject<HTMLDivElement>
  containerStyle: React.CSSProperties
  className: string
  children?: ReactNode
}

function UnifiedDataGridInner({
  containerRef,
  containerStyle,
  className,
  children,
}: UnifiedDataGridInnerProps) {
  const { rowData, columnDefs } = useDataGridContext()

  return (
    <div
      ref={containerRef}
      className={`bg-black border border-neutral-800 flex flex-col overflow-hidden relative ${className}`}
      style={containerStyle}
    >
      {children}
      {/* Default body if no children provided */}
      {!children && <UnifiedDataGridBody />}
    </div>
  )
}

// =============================================================================
// SUBCOMPONENTS
// =============================================================================

// --- Header ---
export interface UnifiedDataGridHeaderProps {
  children?: ReactNode
  className?: string
}

export function UnifiedDataGridHeader({ children, className = '' }: UnifiedDataGridHeaderProps) {
  const { variant } = useDataGridContext()

  return (
    <div
      className={`flex items-center justify-between px-3 border-b border-neutral-800 ${className}`}
      style={{
        height: variant.density.headerHeight,
        backgroundColor: variant.colors.background.header,
      }}
    >
      {children}
    </div>
  )
}
UnifiedDataGridHeader.displayName = 'UnifiedDataGrid.Header'

// --- Title ---
export interface UnifiedDataGridTitleProps {
  title: string
  badge?: string | number
  className?: string
}

export function UnifiedDataGridTitle({ title, badge, className = '' }: UnifiedDataGridTitleProps) {
  const { variant } = useDataGridContext()

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span
        className="font-mono uppercase tracking-wider"
        style={{
          fontSize: variant.density.fontSize,
          color: variant.colors.text.primary,
        }}
      >
        {title}
      </span>
      {badge !== undefined && (
        <span
          className="font-mono px-1.5 py-0.5 rounded bg-neutral-800"
          style={{
            fontSize: variant.density.fontSizeXs,
            color: variant.colors.text.secondary,
          }}
        >
          {badge}
        </span>
      )}
    </div>
  )
}
UnifiedDataGridTitle.displayName = 'UnifiedDataGrid.Title'

// --- Settings Button ---
export interface UnifiedDataGridSettingsButtonProps {
  className?: string
}

export function UnifiedDataGridSettingsButton({ className = '' }: UnifiedDataGridSettingsButtonProps) {
  const { gridId } = useDataGridContext()
  const drawerStack = useDrawerStackSafe()

  const handleClick = useCallback(() => {
    if (!drawerStack) {
      console.warn('[Tmnl.DataGrid.SettingsButton] No DrawerStackProvider found. Settings drawer unavailable.')
      return
    }

    const drawerId = `grid-settings-${gridId}`

    drawerStack.open({
      id: drawerId,
      slot: 'global',
      side: 'right',
      content: <GridSettingsDrawerContent gridId={gridId} drawerId={drawerId} />,
    })
  }, [drawerStack, gridId])

  // Visually indicate if drawer is unavailable
  const isDrawerAvailable = !!drawerStack

  return (
    <button
      onClick={handleClick}
      className={`flex items-center justify-center w-6 h-6 transition-colors ${className} ${
        isDrawerAvailable
          ? 'text-neutral-600 hover:text-white'
          : 'text-neutral-800 cursor-not-allowed'
      }`}
      aria-label="Grid settings"
      title={isDrawerAvailable ? 'Grid settings' : 'Settings unavailable (no drawer provider)'}
      disabled={!isDrawerAvailable}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    </button>
  )
}
UnifiedDataGridSettingsButton.displayName = 'UnifiedDataGrid.SettingsButton'

// --- Grid Settings Drawer Content ---
interface GridSettingsDrawerContentProps {
  gridId: string
  drawerId: string
}

function GridSettingsDrawerContent({ gridId, drawerId }: GridSettingsDrawerContentProps) {
  const drawerStack = useDrawerStackSafe()
  const {
    getVariantForGrid,
    setGridOverride,
    clearGridOverride,
    isReady,
  } = useTableService()

  const [localVariant, setLocalVariant] = useState<GridVariantType | null>(null)
  const [hasChanges, setHasChanges] = useState(false)

  // Load variant for this grid
  useEffect(() => {
    if (isReady) {
      getVariantForGrid(gridId as GridId).then(setLocalVariant).catch(console.error)
    }
  }, [gridId, isReady, getVariantForGrid])

  const handleVariantChange = useCallback((updates: Partial<GridVariantType>) => {
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
    const overrides: GridVariantPartialType = {
      colors: localVariant.colors,
      behavior: localVariant.behavior,
      density: localVariant.density,
    }
    await setGridOverride(gridId as GridId, overrides)
    setHasChanges(false)
    drawerStack?.close(drawerId)
  }, [gridId, localVariant, setGridOverride, drawerStack, drawerId])

  const handleReset = useCallback(async () => {
    await clearGridOverride(gridId as GridId)
    const fresh = await getVariantForGrid(gridId as GridId)
    setLocalVariant(fresh)
    setHasChanges(false)
  }, [gridId, clearGridOverride, getVariantForGrid])

  const handleCancel = useCallback(() => {
    drawerStack?.close(drawerId)
  }, [drawerStack, drawerId])

  if (!localVariant) {
    return (
      <div
        className="p-4 text-neutral-500 font-mono"
        style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
      >
        Loading variant...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-4 py-3 border-b border-neutral-800">
        <div
          className="font-mono uppercase tracking-widest text-neutral-300"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Grid Settings
        </div>
        <div
          className="font-mono text-neutral-600"
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
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
          style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
        >
          Reset
        </button>
        <div className="flex gap-2">
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 border border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-white transition-colors font-mono uppercase"
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
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
            style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
GridSettingsDrawerContent.displayName = 'GridSettingsDrawerContent'

// --- Body ---
export interface UnifiedDataGridBodyProps {
  className?: string
}

export function UnifiedDataGridBody({
  className = '',
}: UnifiedDataGridBodyProps = {}) {
  const {
    variant,
    rowData,
    columnDefs,
    defaultColDef: contextDefaultColDef,
    getRowId,
    setGridApi,
  } = useDataGridContext()

  // Compose theme from variant
  const theme = useMemo(() => composeAgGridTheme(variant), [variant])

  // Compute default col def
  const computedDefaultColDef = useMemo<ColDef>(
    () =>
      contextDefaultColDef ?? {
        resizable: variant.behavior.resize.columns,
        sortable: variant.behavior.sort.enabled,
      },
    [contextDefaultColDef, variant.behavior.resize.columns, variant.behavior.sort.enabled]
  )

  return (
    <div className={`flex-1 ${className}`}>
      <AgGridReact
        rowData={rowData}
        columnDefs={columnDefs}
        theme={theme}
        defaultColDef={computedDefaultColDef}
        getRowId={getRowId}
        animateRows={variant.behavior.microInteractions.animateRows}
        rowSelection={
          variant.behavior.selection === 'none'
            ? undefined
            : { mode: variant.behavior.selection === 'single' ? 'singleRow' : 'multiRow' }
        }
        onGridReady={(params) => setGridApi(params.api)}
      />
    </div>
  )
}
UnifiedDataGridBody.displayName = 'UnifiedDataGrid.Body'

// --- Status Bar ---
export interface UnifiedDataGridStatusBarProps {
  children?: ReactNode
  className?: string
}

export function UnifiedDataGridStatusBar({ children, className = '' }: UnifiedDataGridStatusBarProps) {
  const { variant } = useDataGridContext()

  return (
    <div
      className={`flex items-center justify-between px-3 border-t border-neutral-800 ${className}`}
      style={{
        height: 24,
        backgroundColor: variant.colors.background.base,
        fontSize: variant.density.fontSizeXs,
        color: variant.colors.text.muted,
      }}
    >
      {children}
    </div>
  )
}
UnifiedDataGridStatusBar.displayName = 'UnifiedDataGrid.StatusBar'

// --- Corner Decorations ---
export interface UnifiedDataGridCornerDecorationsProps {
  className?: string
}

export function UnifiedDataGridCornerDecorations({ className = '' }: UnifiedDataGridCornerDecorationsProps) {
  return (
    <>
      {/* Top-left corner */}
      <div className={`absolute top-0 left-0 w-2 h-2 border-t border-l border-neutral-700 ${className}`} />
      {/* Top-right corner */}
      <div className={`absolute top-0 right-0 w-2 h-2 border-t border-r border-neutral-700 ${className}`} />
      {/* Bottom-left corner */}
      <div className={`absolute bottom-0 left-0 w-2 h-2 border-b border-l border-neutral-700 ${className}`} />
      {/* Bottom-right corner */}
      <div className={`absolute bottom-0 right-0 w-2 h-2 border-b border-r border-neutral-700 ${className}`} />
    </>
  )
}
UnifiedDataGridCornerDecorations.displayName = 'UnifiedDataGrid.CornerDecorations'

// =============================================================================
// COMPOUND EXPORT
// =============================================================================

type UnifiedDataGridCompound = typeof UnifiedDataGridRoot & {
  Header: typeof UnifiedDataGridHeader
  Title: typeof UnifiedDataGridTitle
  SettingsButton: typeof UnifiedDataGridSettingsButton
  Body: typeof UnifiedDataGridBody
  StatusBar: typeof UnifiedDataGridStatusBar
  CornerDecorations: typeof UnifiedDataGridCornerDecorations
}

const UnifiedDataGridWithRef = forwardRef(UnifiedDataGridRoot) as <TData = unknown>(
  props: UnifiedDataGridProps<TData> & { ref?: Ref<UnifiedDataGridHandle> }
) => React.ReactElement

export const UnifiedDataGrid = UnifiedDataGridWithRef as UnifiedDataGridCompound
UnifiedDataGrid.Header = UnifiedDataGridHeader
UnifiedDataGrid.Title = UnifiedDataGridTitle
UnifiedDataGrid.SettingsButton = UnifiedDataGridSettingsButton
UnifiedDataGrid.Body = UnifiedDataGridBody
UnifiedDataGrid.StatusBar = UnifiedDataGridStatusBar
UnifiedDataGrid.CornerDecorations = UnifiedDataGridCornerDecorations
