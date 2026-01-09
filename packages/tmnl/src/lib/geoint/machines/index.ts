/**
 * GEOINT Machines Module
 *
 * XState machines and providers for GEOINT dashboard state management.
 *
 * @module geoint/machines
 */

// Dashboard Machine
export {
  dashboardMachine,
  type DashboardContext,
  type DashboardEvent,
  type DashboardMachine,
  type DashboardSnapshot,
} from './dashboardMachine'

// Dashboard Provider (XState + effect-atom integration)
export {
  DashboardProvider,
  GeointRegistryProvider,
  useDashboard,
  useSearchResults,
  useResultsBySource,
  useSourceCounts,
  useSelectedEntity,
  useLayerVisibility,
  useDashboardState,
  // Note: Atoms are exported from ../atoms, not re-exported here to avoid conflicts
} from './DashboardProvider'
