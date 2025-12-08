/**
 * DataGrid Context
 *
 * Context provider for compound DataGrid components.
 * Strict encapsulation — throws if used outside DataGrid.Root.
 */

import { createContext, useContext, useMemo, type ReactNode, type RefObject } from 'react'
import type { ColDef, GridApi, RowClassParams } from 'ag-grid-community'
import type { DataGridRow, GridBehaviorConfig, DragCallbacks } from './types'

// =============================================================================
// SCALE UTILITIES
// =============================================================================

const SCALE_MIN = 0.5
const SCALE_MAX = 2.0

/** Clamp scale factor to valid range */
export function clampScale(value: number): number {
  return Math.max(SCALE_MIN, Math.min(SCALE_MAX, value))
}

/** Create scale helper functions */
export function createScaleHelpers(scaleFactor: number) {
  const clamped = clampScale(scaleFactor)

  // Short-circuit at 1.0 for performance
  const scaled = (basePx: number): number =>
    clamped === 1.0 ? basePx : Math.round(basePx * clamped)

  const scaledPx = (basePx: number): string => `${scaled(basePx)}px`

  return { scaled, scaledPx, scaleFactor: clamped }
}

// =============================================================================
// CONTEXT TYPES
// =============================================================================

export interface DataGridContextValue {
  // Identity
  readonly id: string

  // Data
  readonly rowData: DataGridRow[]
  readonly behavior: GridBehaviorConfig

  // Scale
  readonly scaleFactor: number
  readonly scaled: (basePx: number) => number
  readonly scaledPx: (basePx: number) => string

  // Grid API (set by Body on mount)
  readonly gridApi: GridApi | null
  readonly setGridApi: (api: GridApi | null) => void

  // Refs
  readonly containerRef: RefObject<HTMLDivElement>

  // Column config
  readonly columnDefs: ColDef<DataGridRow>[]
  readonly defaultColDef: ColDef

  // Callbacks
  readonly dragCallbacks?: DragCallbacks
  readonly getRowClass?: (params: RowClassParams) => string
  readonly onGridReady?: (api: GridApi) => void
}

// =============================================================================
// CONTEXT
// =============================================================================

const DataGridContext = createContext<DataGridContextValue | null>(null)

DataGridContext.displayName = 'DataGridContext'

// =============================================================================
// PROVIDER
// =============================================================================

export interface DataGridProviderProps {
  value: DataGridContextValue
  children: ReactNode
}

export function DataGridProvider({ value, children }: DataGridProviderProps) {
  // Memoize the value to prevent unnecessary re-renders
  const memoizedValue = useMemo(() => value, [
    value.id,
    value.rowData,
    value.behavior,
    value.scaleFactor,
    value.gridApi,
    value.containerRef,
    value.columnDefs,
    value.defaultColDef,
    value.dragCallbacks,
    value.getRowClass,
    value.onGridReady,
    value.scaled,
    value.scaledPx,
    value.setGridApi,
  ])

  return (
    <DataGridContext.Provider value={memoizedValue}>
      {children}
    </DataGridContext.Provider>
  )
}

// =============================================================================
// HOOK
// =============================================================================

/**
 * Access DataGrid context.
 *
 * @throws Error if used outside DataGrid.Root
 */
export function useDataGrid(): DataGridContextValue {
  const ctx = useContext(DataGridContext)

  if (!ctx) {
    throw new Error(
      'useDataGrid must be used within DataGrid.Root. ' +
        'Wrap your component tree with <DataGrid id="..." rowData={...}>.'
    )
  }

  return ctx
}

/**
 * Access DataGrid context without throwing.
 * Returns null if outside DataGrid.Root.
 */
export function useDataGridMaybe(): DataGridContextValue | null {
  return useContext(DataGridContext)
}
