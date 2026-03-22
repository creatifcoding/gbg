/**
 * TableService
 *
 * Effect service for TmnlDataGrid variant configuration.
 * Manages presets, per-grid overrides, and localStorage persistence.
 *
 * @example
 * ```tsx
 * // In a component
 * import { useTableService } from '@/lib/table-service'
 *
 * function MyComponent() {
 *   const { presets, createPreset, activeVariant } = useTableService()
 *   // ...
 * }
 * ```
 *
 * @module
 */

// Types
export type {
  PresetId,
  GridId,
  Preset,
  GridOverride,
  TableServiceState,
  PersistedState,
} from './types'

export {
  PresetId as PresetIdSchema,
  GridId as GridIdSchema,
  Preset as PresetSchema,
  GridOverride as GridOverrideSchema,
  TableServiceState as TableServiceStateSchema,
  PersistedState as PersistedStateSchema,
  CURRENT_VERSION,
  STORAGE_KEY,
  initialState,
} from './types'

// Service
export { TableService, type TableServiceShape } from './TableService'

// Persistence utilities
export {
  deepMerge,
  loadPersistedState,
  savePersistedState,
  createDebouncedPersist,
  PersistenceError,
} from './persistence'

// Atoms
export {
  // Materialized views
  presetsAtom,
  activePresetIdAtom,
  activeVariantAtom,
  gridOverridesAtom,
  isReadyAtom,
  // Derived
  userPresetCountAtom,
  activePresetAtom,
  hasActivePresetAtom,
  // Runtime
  tableServiceRuntimeAtom,
  // Operations
  presetOps,
  gridOps,
  persistOps,
} from './atoms'

// Hooks
export { useTableService, type UseTableServiceResult } from './hooks'
