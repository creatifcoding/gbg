/**
 * DataGridContext
 *
 * React context providing per-grid runtime and configuration.
 * Each DataGrid instance gets its own DataManager + TableService + FlashTracking.
 *
 * @module
 */

import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import type { ColDef, GetRowIdFunc, GridApi } from 'ag-grid-community'
import { createDataGridRuntime, type DataGridRuntime } from '../services'
import type { GridVariantType } from '../schemas'

// =============================================================================
// CONTEXT VALUE
// =============================================================================

export interface DataGridContextValue<TData = unknown> {
  /** Unique grid identifier */
  gridId: string
  /** Per-grid Effect runtime with all services */
  runtime: DataGridRuntime
  /** Active grid variant (can be reactive if wired to TableService) */
  variant: GridVariantType
  /** Row data (flows from root to children) */
  rowData: TData[]
  /** Column definitions (flows from root to children) */
  columnDefs: ColDef<TData>[]
  /** Default column definition */
  defaultColDef?: ColDef<TData>
  /** Row ID getter */
  getRowId?: GetRowIdFunc<TData>
  /** Grid API setter (called by Body on grid ready) */
  setGridApi: (api: GridApi | null) => void
  /** Current grid API */
  gridApi: GridApi | null
}

// =============================================================================
// CONTEXT
// =============================================================================

const DataGridContext = createContext<DataGridContextValue | null>(null)

// =============================================================================
// PROVIDER
// =============================================================================

export interface DataGridProviderProps<TData = unknown> {
  /** Unique grid identifier */
  gridId: string
  /** Grid variant (required) */
  variant: GridVariantType
  /** Row data */
  rowData: TData[]
  /** Column definitions */
  columnDefs: ColDef<TData>[]
  /** Default column definition */
  defaultColDef?: ColDef<TData>
  /** Row ID getter */
  getRowId?: GetRowIdFunc<TData>
  /** Grid API state */
  gridApi: GridApi | null
  /** Grid API setter */
  setGridApi: (api: GridApi | null) => void
  /** Children */
  children: ReactNode
}

/**
 * DataGridProvider
 *
 * Wraps children with a per-grid runtime context.
 * Creates a new Atom.runtime for each grid instance.
 */
export function DataGridProvider<TData = unknown>({
  gridId,
  variant,
  rowData,
  columnDefs,
  defaultColDef,
  getRowId,
  gridApi,
  setGridApi,
  children,
}: DataGridProviderProps<TData>) {
  // Create per-grid runtime (memoized on gridId)
  const runtime = useMemo(() => createDataGridRuntime(), [gridId])

  // Build context value
  const contextValue = useMemo<DataGridContextValue<TData>>(
    () => ({
      gridId,
      runtime,
      variant,
      rowData,
      columnDefs,
      defaultColDef,
      getRowId,
      gridApi,
      setGridApi,
    }),
    [gridId, runtime, variant, rowData, columnDefs, defaultColDef, getRowId, gridApi, setGridApi]
  )

  return (
    <DataGridContext.Provider value={contextValue as DataGridContextValue}>
      {children}
    </DataGridContext.Provider>
  )
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * useDataGridContext
 *
 * Access the DataGrid context. Throws if used outside DataGridProvider.
 */
export function useDataGridContext(): DataGridContextValue {
  const ctx = useContext(DataGridContext)
  if (!ctx) {
    throw new Error('useDataGridContext must be used within a DataGridProvider')
  }
  return ctx
}

/**
 * useDataGridContextMaybe
 *
 * Access the DataGrid context. Returns null if used outside DataGridProvider.
 */
export function useDataGridContextMaybe(): DataGridContextValue | null {
  return useContext(DataGridContext)
}

/**
 * useGridId
 *
 * Get the current grid ID from context.
 */
export function useGridId(): string {
  return useDataGridContext().gridId
}

/**
 * useGridRuntime
 *
 * Get the current grid runtime from context.
 */
export function useGridRuntime(): DataGridRuntime {
  return useDataGridContext().runtime
}

/**
 * useGridVariant
 *
 * Get the current grid variant from context.
 */
export function useGridVariant(): GridVariantType {
  return useDataGridContext().variant
}

// =============================================================================
// DISPLAY NAME
// =============================================================================

DataGridProvider.displayName = 'DataGridProvider'
