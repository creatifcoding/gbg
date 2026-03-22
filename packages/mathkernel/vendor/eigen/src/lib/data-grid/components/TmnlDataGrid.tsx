/**
 * TmnlDataGrid
 *
 * Wrapper component for AG-Grid with TMNL variant system integration.
 * Handles theme composition, flash tracking, and variant-aware defaults.
 *
 * ## Usage
 *
 * ```tsx
 * import { TmnlDataGrid, tmnlDenseDark } from '@/lib/data-grid'
 *
 * <TmnlDataGrid
 *   variant={tmnlDenseDark}
 *   rowData={data}
 *   columnDefs={columns}
 * />
 * ```
 */

import {
  forwardRef,
  useMemo,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from 'react'
import { AgGridReact, type AgGridReactProps } from 'ag-grid-react'
import {
  ModuleRegistry,
  AllCommunityModule,
  type GridApi,
  type ColDef,
} from 'ag-grid-community'

import { composeAgGridTheme } from '../composer'
import { useFlashTracker, type FlashState } from '../flash'
import type { GridVariantType } from '../schemas'
import type { RowUpdate } from '../mocking'

// Register AG-Grid modules once
ModuleRegistry.registerModules([AllCommunityModule])

// =============================================================================
// TYPES
// =============================================================================

/**
 * Context passed to cell renderers via AG-Grid's context prop.
 */
export interface TmnlGridContext<TData = unknown> {
  /** The active variant */
  variant: GridVariantType
  /** Get flash state for a cell (if flash tracking enabled) */
  getFlashState: (rowId: string, field: string) => FlashState | undefined
  /** Check if a cell has an active flash */
  hasFlash: (rowId: string, field: string) => boolean
  /** Custom context data from consumer */
  custom?: TData
}

/**
 * Flash configuration for the grid.
 */
export interface FlashConfig {
  /** Enable custom severity-based flash (vs AG-Grid native) */
  enabled: boolean
  /** Maximum delta for intensity calculation */
  maxDelta?: number
  /** Flash expiration time in ms */
  expirationMs?: number
  /** Updates to process (from streaming hook) */
  updates?: readonly RowUpdate[]
}

/**
 * TmnlDataGrid props.
 * Extends AgGridReactProps with variant system integration.
 */
export interface TmnlDataGridProps<TData = unknown>
  extends Omit<AgGridReactProps<TData>, 'theme' | 'context'> {
  /** Grid variant (required) */
  variant: GridVariantType
  /** Custom context data to pass to cell renderers */
  customContext?: unknown
  /** Flash configuration */
  flash?: FlashConfig
  /** Container className */
  className?: string
  /** Container style */
  style?: React.CSSProperties
  /** Auto-size columns to fit on ready */
  autoSizeOnReady?: boolean
}

/**
 * Ref handle for TmnlDataGrid.
 */
export interface TmnlDataGridHandle {
  /** AG-Grid API instance */
  api: GridApi | null
  /** Refresh all cells */
  refreshCells: () => void
  /** Size columns to fit container */
  sizeColumnsToFit: () => void
}

// =============================================================================
// COMPONENT
// =============================================================================

function TmnlDataGridInner<TData = unknown>(
  props: TmnlDataGridProps<TData>,
  ref: Ref<TmnlDataGridHandle>
) {
  const {
    variant,
    customContext,
    flash,
    className,
    style,
    autoSizeOnReady = true,
    defaultColDef,
    onGridReady,
    ...agGridProps
  } = props

  // Internal ref
  const gridRef = useRef<AgGridReact<TData>>(null)

  // Compose theme from variant
  const theme = useMemo(() => composeAgGridTheme(variant), [variant])

  // Flash tracking
  const flashEnabled = flash?.enabled ?? false
  const { processUpdates, getFlashState, hasFlash } = useFlashTracker({
    maxDelta: flash?.maxDelta ?? 20,
    flashExpirationMs: flash?.expirationMs ?? 1500,
  })

  // Process flash updates
  useEffect(() => {
    if (flashEnabled && flash?.updates && flash.updates.length > 0) {
      processUpdates(flash.updates)
    }
  }, [flashEnabled, flash?.updates, processUpdates])

  // Refresh cells when flash mode changes
  useEffect(() => {
    if (gridRef.current?.api) {
      gridRef.current.api.refreshCells({ force: true })
    }
  }, [flashEnabled])

  // Build context for cell renderers
  const gridContext = useMemo<TmnlGridContext>(
    () => ({
      variant,
      getFlashState: flashEnabled ? getFlashState : () => undefined,
      hasFlash: flashEnabled ? hasFlash : () => false,
      custom: customContext,
    }),
    [variant, flashEnabled, getFlashState, hasFlash, customContext]
  )

  // Merged default column def
  const mergedDefaultColDef = useMemo<ColDef<TData>>(
    () => ({
      resizable: variant.behavior.resize.enableColumnResize,
      sortable: variant.behavior.sort.enabled,
      ...defaultColDef,
    }),
    [variant.behavior.resize.enableColumnResize, variant.behavior.sort.enabled, defaultColDef]
  )

  // Handle grid ready
  const handleGridReady = (params: { api: GridApi<TData> }) => {
    if (autoSizeOnReady) {
      params.api.sizeColumnsToFit()
    }
    onGridReady?.(params as Parameters<NonNullable<typeof onGridReady>>[0])
  }

  // Expose handle
  useImperativeHandle(ref, () => ({
    get api() {
      return gridRef.current?.api ?? null
    },
    refreshCells() {
      gridRef.current?.api?.refreshCells({ force: true })
    },
    sizeColumnsToFit() {
      gridRef.current?.api?.sizeColumnsToFit()
    },
  }))

  // Container styles from variant
  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      height: '100%',
      width: '100%',
      borderColor: variant.colors.border.primary,
      backgroundColor: variant.colors.background.base,
      ...style,
    }),
    [variant.colors.border.primary, variant.colors.background.base, style]
  )

  // Generate unique ID for scoped CSS
  const scopeId = useMemo(() => `tmnl-grid-${Math.random().toString(36).slice(2, 8)}`, [])

  // Build CSS for microinteractions not covered by AG-Grid theme params
  const microInteractionCSS = useMemo(() => {
    const { selectedRow, selectedRowTransitionMs } = variant.behavior.microInteractions
    const transitionMs = selectedRowTransitionMs ?? 150
    const rules: string[] = []

    // Selected row styling based on microinteraction type
    if (selectedRow === 'invert') {
      // Invert: black background, white text
      rules.push(`
        .${scopeId} .ag-row-selected {
          background-color: ${variant.colors.background.selected} !important;
          transition: background-color ${transitionMs}ms ease-out, color ${transitionMs}ms ease-out;
        }
        .${scopeId} .ag-row-selected .ag-cell {
          color: ${variant.colors.text.primary === '#000000' ? '#ffffff' : '#000000'} !important;
        }
      `)
    } else if (selectedRow === 'leftAccent') {
      // Left accent: colored left border
      rules.push(`
        .${scopeId} .ag-row-selected {
          border-left: 3px solid ${variant.colors.signal.accent} !important;
          transition: border-color ${transitionMs}ms ease-out;
        }
      `)
    } else if (selectedRow === 'fill') {
      // Fill is default AG-Grid behavior, just add transition
      rules.push(`
        .${scopeId} .ag-row-selected {
          transition: background-color ${transitionMs}ms ease-out;
        }
      `)
    }

    return rules.join('\n')
  }, [variant, scopeId])

  return (
    <div className={`${scopeId} ${className ?? ''}`} style={containerStyle}>
      {microInteractionCSS && <style>{microInteractionCSS}</style>}
      <AgGridReact<TData>
        ref={gridRef}
        theme={theme}
        context={gridContext}
        defaultColDef={mergedDefaultColDef}
        animateRows={variant.behavior.microInteractions.animateRows}
        rowSelection={
          variant.behavior.selection === 'none'
            ? undefined
            : { mode: variant.behavior.selection === 'single' ? 'singleRow' : 'multiRow' }
        }
        onGridReady={handleGridReady}
        {...agGridProps}
      />
    </div>
  )
}

/**
 * TmnlDataGrid - Variant-aware AG-Grid wrapper.
 *
 * Provides:
 * - Automatic theme composition from variant
 * - Flash tracking integration
 * - Variant context for cell renderers
 * - Default column behaviors from variant
 */
export const TmnlDataGrid = forwardRef(TmnlDataGridInner) as <TData = unknown>(
  props: TmnlDataGridProps<TData> & { ref?: Ref<TmnlDataGridHandle> }
) => React.ReactElement

// Re-export context type for cell renderers
export type { FlashState }
