/**
 * Session Persistence Module
 *
 * Local-first session state persistence using Effect SQL.
 * Enables route scroll restoration, panel layout persistence,
 * and generic app state for heterogeneous applications.
 *
 * @module lib/session
 *
 * @example Basic scroll restoration
 * ```tsx
 * import { useSessionRestore } from '@/lib/session'
 *
 * function MyPage() {
 *   useSessionRestore()
 *   return <div>Content...</div>
 * }
 * ```
 *
 * @example App state persistence
 * ```tsx
 * import { useAppState } from '@/lib/session'
 *
 * function MyTestbed() {
 *   const { state, setState } = useAppState('testbed/my-feature', { count: 0 })
 *   return <button onClick={() => setState({ count: state.count + 1 })}>{state.count}</button>
 * }
 * ```
 *
 * @example Manual session operations
 * ```tsx
 * import { sessionOps, PanelConfig } from '@/lib/session'
 *
 * // Save panel position
 * const config = PanelConfig.create('my-panel', { width: 400, height: 600 })
 * await sessionOps.savePanel(config)
 *
 * // Load all panels
 * const panels = await sessionOps.loadPanels()
 * ```
 */

// Schemas
export {
  // Types
  SessionId,
  RouteState,
  PanelConfig,
  PanelPosition,
  AppState,
  // Row types for SQL
  RouteStateRow,
  PanelConfigRow,
  AppStateRow,
} from "./schemas"

// Service
export { SessionPersistence, SqliteLive } from "./service"

// Atoms
export {
  // Runtime
  sessionRuntimeAtom,
  // State atoms
  sessionInitializedAtom,
  currentRouteStateAtom,
  panelConfigsAtom,
  appStatesAtom,
  // Derived atoms
  panelConfigAtom,
  appStateAtom,
  // Operations
  sessionOps,
  // Individual operations (for advanced use)
  initializeSession,
  loadRouteState,
  saveRouteState,
  saveCurrentScroll,
  loadAllPanels,
  savePanelConfig,
  loadAppState,
  saveAppState,
  saveTypedAppState,
  clearAllSessionData,
} from "./atoms"

// Hooks
export { useSessionRestore, useAppState } from "./hooks/useSessionRestore"
