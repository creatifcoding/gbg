/**
 * DataGrid A/B Testing
 *
 * Utilities for switching between legacy and unified DataGrid implementations.
 *
 * @example
 * ```tsx
 * // Enable unified implementation
 * setDataGridVariant('unified')
 *
 * // Use wrapper that auto-switches
 * <DataGridAB id="emitters" variant={tmnlDenseDark} rowData={data}>
 *   <DataGrid.Header>...</DataGrid.Header>
 *   <DataGrid.Body />
 * </DataGridAB>
 * ```
 *
 * @module
 */

import { createContext, useContext, useState, type ReactNode } from 'react'

// =============================================================================
// VARIANT TYPES
// =============================================================================

export type DataGridImplementation = 'legacy' | 'unified'

// =============================================================================
// GLOBAL STATE
// =============================================================================

/** Current global implementation (can be overridden per-instance) */
let globalImplementation: DataGridImplementation = 'legacy'

/**
 * Set the global DataGrid implementation.
 * Affects all grids that don't specify an explicit implementation.
 */
export function setDataGridImplementation(impl: DataGridImplementation): void {
  globalImplementation = impl
}

/**
 * Get the current global DataGrid implementation.
 */
export function getDataGridImplementation(): DataGridImplementation {
  return globalImplementation
}

// =============================================================================
// CONTEXT
// =============================================================================

interface DataGridABContextValue {
  implementation: DataGridImplementation
  setImplementation: (impl: DataGridImplementation) => void
}

const DataGridABContext = createContext<DataGridABContextValue | null>(null)

// =============================================================================
// PROVIDER
// =============================================================================

export interface DataGridABProviderProps {
  /** Initial implementation (defaults to global) */
  defaultImplementation?: DataGridImplementation
  /** Children */
  children: ReactNode
}

/**
 * DataGridABProvider
 *
 * Provides A/B testing context for DataGrid implementations.
 * Wrap your app or a section to enable switching.
 */
export function DataGridABProvider({
  defaultImplementation,
  children,
}: DataGridABProviderProps) {
  const [implementation, setImplementation] = useState<DataGridImplementation>(
    defaultImplementation ?? globalImplementation
  )

  return (
    <DataGridABContext.Provider value={{ implementation, setImplementation }}>
      {children}
    </DataGridABContext.Provider>
  )
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * useDataGridAB
 *
 * Access the current DataGrid implementation and setter.
 */
export function useDataGridAB(): DataGridABContextValue {
  const ctx = useContext(DataGridABContext)

  if (!ctx) {
    // No provider - use global
    return {
      implementation: globalImplementation,
      setImplementation: setDataGridImplementation,
    }
  }

  return ctx
}

/**
 * useIsUnifiedDataGrid
 *
 * Quick check if unified implementation is active.
 */
export function useIsUnifiedDataGrid(): boolean {
  const { implementation } = useDataGridAB()
  return implementation === 'unified'
}

// =============================================================================
// DISPLAY NAMES
// =============================================================================

DataGridABProvider.displayName = 'DataGridABProvider'
