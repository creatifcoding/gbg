/**
 * Session Persistence Atoms
 *
 * effect-atom integration for reactive session state in React.
 * Provides runtime atoms and operation atoms for session persistence.
 *
 * @module lib/session/atoms
 */

import { Atom } from "@effect-atom/atom"
import { Effect } from "effect"
import { SessionPersistence } from "./service"
import { RouteState, PanelConfig, AppState, type SessionId } from "./schemas"

// =============================================================================
// Runtime Atom
// =============================================================================

/**
 * Session runtime atom - provides Effect runtime for all session operations
 */
export const sessionRuntimeAtom = Atom.runtime(SessionPersistence.Live)

// =============================================================================
// Initialization Atom
// =============================================================================

/**
 * Initialization state - tracks whether tables have been created
 */
export const sessionInitializedAtom = Atom.make(false)

/**
 * Initialize session persistence (call once on app start)
 */
export const initializeSession = sessionRuntimeAtom.fn(() =>
  Effect.gen(function* () {
    const service = yield* SessionPersistence
    yield* service.initialize
    Atom.set(sessionInitializedAtom, true)
  })
)

// =============================================================================
// Route State Atoms
// =============================================================================

/**
 * Current route state cache
 */
export const currentRouteStateAtom = Atom.make<RouteState | null>(null)

/**
 * Load route state for a given path
 */
export const loadRouteState = sessionRuntimeAtom.fn((path: string) =>
  Effect.gen(function* () {
    const service = yield* SessionPersistence
    const state = yield* service.loadRoute(path)
    if (state) {
      Atom.set(currentRouteStateAtom, state)
    }
    return state
  })
)

/**
 * Save route state (updates cache and persists)
 */
export const saveRouteState = sessionRuntimeAtom.fn((state: RouteState) =>
  Effect.gen(function* () {
    const service = yield* SessionPersistence
    yield* service.saveRoute(state)
    Atom.set(currentRouteStateAtom, state)
  })
)

/**
 * Quick save current scroll position for a path
 */
export const saveCurrentScroll = sessionRuntimeAtom.fn(
  (params: { path: string; scrollX: number; scrollY: number }) =>
    Effect.gen(function* () {
      const service = yield* SessionPersistence
      const state = new RouteState({
        id: `route-${params.path.replace(/\//g, "-")}` as SessionId,
        route_path: params.path,
        scroll_x: params.scrollX,
        scroll_y: params.scrollY,
        timestamp: Date.now(),
      })
      yield* service.saveRoute(state)
      Atom.set(currentRouteStateAtom, state)
    })
)

// =============================================================================
// Panel Config Atoms
// =============================================================================

/**
 * All panel configurations cache
 */
export const panelConfigsAtom = Atom.make<readonly PanelConfig[]>([])

/**
 * Load all panel configurations
 */
export const loadAllPanels = sessionRuntimeAtom.fn(() =>
  Effect.gen(function* () {
    const service = yield* SessionPersistence
    const panels = yield* service.loadAllPanels()
    Atom.set(panelConfigsAtom, panels)
    return panels
  })
)

/**
 * Save panel configuration
 */
export const savePanelConfig = sessionRuntimeAtom.fn((config: PanelConfig) =>
  Effect.gen(function* () {
    const service = yield* SessionPersistence
    yield* service.savePanel(config)
    // Update cache
    Atom.update(panelConfigsAtom, (panels) => {
      const filtered = panels.filter((p) => p.panel_id !== config.panel_id)
      return [...filtered, config].sort((a, b) => a.z_index - b.z_index)
    })
  })
)

/**
 * Get panel config by ID (derived atom)
 */
export const panelConfigAtom = Atom.family((panelId: string) =>
  Atom.make((get) => {
    const panels = get(panelConfigsAtom)
    return panels.find((p) => p.panel_id === panelId) ?? null
  })
)

// =============================================================================
// App State Atoms
// =============================================================================

/**
 * App state cache (keyed by app_key)
 */
export const appStatesAtom = Atom.make<Map<string, AppState>>(new Map())

/**
 * Load app state for a given key
 */
export const loadAppState = sessionRuntimeAtom.fn((appKey: string) =>
  Effect.gen(function* () {
    const service = yield* SessionPersistence
    const state = yield* service.loadAppState(appKey)
    if (state) {
      Atom.update(appStatesAtom, (map) => {
        const newMap = new Map(map)
        newMap.set(appKey, state)
        return newMap
      })
    }
    return state
  })
)

/**
 * Save app state
 */
export const saveAppState = sessionRuntimeAtom.fn((state: AppState) =>
  Effect.gen(function* () {
    const service = yield* SessionPersistence
    yield* service.saveAppState(state)
    Atom.update(appStatesAtom, (map) => {
      const newMap = new Map(map)
      newMap.set(state.app_key, state)
      return newMap
    })
  })
)

/**
 * Convenience: Save typed state for an app key
 */
export const saveTypedAppState = sessionRuntimeAtom.fn(
  <T>(params: { appKey: string; state: T }) =>
    Effect.gen(function* () {
      const service = yield* SessionPersistence
      const appState = AppState.create(params.appKey, params.state)
      yield* service.saveAppState(appState)
      Atom.update(appStatesAtom, (map) => {
        const newMap = new Map(map)
        newMap.set(params.appKey, appState)
        return newMap
      })
    })
)

/**
 * Get app state by key (derived atom)
 */
export const appStateAtom = Atom.family((appKey: string) =>
  Atom.make((get) => {
    const states = get(appStatesAtom)
    return states.get(appKey) ?? null
  })
)

// =============================================================================
// Cleanup
// =============================================================================

/**
 * Clear all session data
 */
export const clearAllSessionData = sessionRuntimeAtom.fn(() =>
  Effect.gen(function* () {
    const service = yield* SessionPersistence
    yield* service.clearAll
    Atom.set(currentRouteStateAtom, null)
    Atom.set(panelConfigsAtom, [])
    Atom.set(appStatesAtom, new Map())
  })
)

// =============================================================================
// Session Operations (grouped export)
// =============================================================================

export const sessionOps = {
  // Initialization
  initialize: initializeSession,

  // Route state
  loadRoute: loadRouteState,
  saveRoute: saveRouteState,
  saveScroll: saveCurrentScroll,

  // Panel config
  loadPanels: loadAllPanels,
  savePanel: savePanelConfig,

  // App state
  loadApp: loadAppState,
  saveApp: saveAppState,
  saveTypedApp: saveTypedAppState,

  // Cleanup
  clearAll: clearAllSessionData,
} as const
