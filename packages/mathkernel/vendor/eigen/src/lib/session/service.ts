/**
 * Session Persistence Service
 *
 * Effect.Service for persisting session state.
 * Currently uses localStorage; can be upgraded to SQLite later.
 *
 * @module lib/session/service
 */

import { Effect, Layer, Context } from "effect"
import {
  RouteState,
  PanelConfig,
  AppState,
  type SessionId,
} from "./schemas"

// =============================================================================
// Storage Keys
// =============================================================================

const STORAGE_KEYS = {
  ROUTES: "tmnl:session:routes",
  PANELS: "tmnl:session:panels",
  APP_STATES: "tmnl:session:apps",
} as const

// =============================================================================
// Storage Helpers
// =============================================================================

function getStorage<T>(key: string): Map<string, T> {
  try {
    if (typeof window === "undefined") return new Map()
    const data = localStorage.getItem(key)
    if (!data) return new Map()
    const parsed = JSON.parse(data)
    return new Map(Object.entries(parsed))
  } catch {
    return new Map()
  }
}

function setStorage<T>(key: string, map: Map<string, T>): void {
  try {
    if (typeof window === "undefined") return
    const obj = Object.fromEntries(map)
    localStorage.setItem(key, JSON.stringify(obj))
  } catch {
    // Ignore storage errors
  }
}

// =============================================================================
// Service Interface
// =============================================================================

export interface SessionPersistenceShape {
  // Initialization
  readonly initialize: Effect.Effect<void, Error>

  // Route state
  readonly saveRoute: (state: RouteState) => Effect.Effect<void, Error>
  readonly loadRoute: (path: string) => Effect.Effect<RouteState | null, Error>
  readonly deleteRoute: (path: string) => Effect.Effect<void, Error>

  // Panel configuration
  readonly savePanel: (config: PanelConfig) => Effect.Effect<void, Error>
  readonly loadPanel: (panelId: string) => Effect.Effect<PanelConfig | null, Error>
  readonly loadAllPanels: () => Effect.Effect<readonly PanelConfig[], Error>
  readonly deletePanel: (panelId: string) => Effect.Effect<void, Error>

  // Generic app state
  readonly saveAppState: (state: AppState) => Effect.Effect<void, Error>
  readonly loadAppState: (appKey: string) => Effect.Effect<AppState | null, Error>
  readonly deleteAppState: (appKey: string) => Effect.Effect<void, Error>

  // Cleanup
  readonly clearAll: () => Effect.Effect<void, Error>
}

// =============================================================================
// Service Tag
// =============================================================================

export class SessionPersistence extends Context.Tag("tmnl/SessionPersistence")<
  SessionPersistence,
  SessionPersistenceShape
>() {
  /**
   * Default layer using localStorage
   */
  static Live = Layer.succeed(SessionPersistence, {
    // =======================================================================
    // Initialize
    // =======================================================================
    initialize: Effect.sync(() => {
      // No-op for localStorage - ready immediately
    }),

    // =======================================================================
    // Route State Operations
    // =======================================================================
    saveRoute: (state: RouteState) =>
      Effect.sync(() => {
        const map = getStorage<RouteState>(STORAGE_KEYS.ROUTES)
        map.set(state.route_path, state)
        setStorage(STORAGE_KEYS.ROUTES, map)
      }),

    loadRoute: (path: string) =>
      Effect.sync(() => {
        const map = getStorage<RouteState>(STORAGE_KEYS.ROUTES)
        const data = map.get(path)
        if (!data) return null
        return new RouteState({
          id: data.id as SessionId,
          route_path: data.route_path,
          scroll_x: data.scroll_x,
          scroll_y: data.scroll_y,
          timestamp: data.timestamp,
        })
      }),

    deleteRoute: (path: string) =>
      Effect.sync(() => {
        const map = getStorage<RouteState>(STORAGE_KEYS.ROUTES)
        map.delete(path)
        setStorage(STORAGE_KEYS.ROUTES, map)
      }),

    // =======================================================================
    // Panel Config Operations
    // =======================================================================
    savePanel: (config: PanelConfig) =>
      Effect.sync(() => {
        const map = getStorage<PanelConfig>(STORAGE_KEYS.PANELS)
        map.set(config.panel_id, config)
        setStorage(STORAGE_KEYS.PANELS, map)
      }),

    loadPanel: (panelId: string) =>
      Effect.sync(() => {
        const map = getStorage<PanelConfig>(STORAGE_KEYS.PANELS)
        const data = map.get(panelId)
        if (!data) return null
        return new PanelConfig({
          id: data.id as SessionId,
          panel_id: data.panel_id,
          is_open: data.is_open,
          width: data.width,
          height: data.height,
          position: data.position,
          z_index: data.z_index,
          timestamp: data.timestamp,
        })
      }),

    loadAllPanels: () =>
      Effect.sync(() => {
        const map = getStorage<PanelConfig>(STORAGE_KEYS.PANELS)
        return Array.from(map.values())
          .map(
            (data) =>
              new PanelConfig({
                id: data.id as SessionId,
                panel_id: data.panel_id,
                is_open: data.is_open,
                width: data.width,
                height: data.height,
                position: data.position,
                z_index: data.z_index,
                timestamp: data.timestamp,
              })
          )
          .sort((a, b) => a.z_index - b.z_index)
      }),

    deletePanel: (panelId: string) =>
      Effect.sync(() => {
        const map = getStorage<PanelConfig>(STORAGE_KEYS.PANELS)
        map.delete(panelId)
        setStorage(STORAGE_KEYS.PANELS, map)
      }),

    // =======================================================================
    // App State Operations
    // =======================================================================
    saveAppState: (state: AppState) =>
      Effect.sync(() => {
        const map = getStorage<AppState>(STORAGE_KEYS.APP_STATES)
        map.set(state.app_key, state)
        setStorage(STORAGE_KEYS.APP_STATES, map)
      }),

    loadAppState: (appKey: string) =>
      Effect.sync(() => {
        const map = getStorage<AppState>(STORAGE_KEYS.APP_STATES)
        const data = map.get(appKey)
        if (!data) return null
        return new AppState({
          id: data.id as SessionId,
          app_key: data.app_key,
          state_json: data.state_json,
          timestamp: data.timestamp,
        })
      }),

    deleteAppState: (appKey: string) =>
      Effect.sync(() => {
        const map = getStorage<AppState>(STORAGE_KEYS.APP_STATES)
        map.delete(appKey)
        setStorage(STORAGE_KEYS.APP_STATES, map)
      }),

    // =======================================================================
    // Cleanup
    // =======================================================================
    clearAll: () =>
      Effect.sync(() => {
        if (typeof window === "undefined") return
        localStorage.removeItem(STORAGE_KEYS.ROUTES)
        localStorage.removeItem(STORAGE_KEYS.PANELS)
        localStorage.removeItem(STORAGE_KEYS.APP_STATES)
      }),
  })
}

// =============================================================================
// Future: SQLite Layer
// =============================================================================

/**
 * SQLite layer placeholder - to be implemented when Effect SQL is properly configured
 *
 * @example
 * ```typescript
 * // When ready, swap layers:
 * import { SessionPersistence, SqliteLive } from '@/lib/session'
 *
 * const layer = SqliteLive // instead of SessionPersistence.Live
 * ```
 */
export const SqliteLive = SessionPersistence.Live // Placeholder - swap when ready
