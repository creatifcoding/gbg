/**
 * Session Persistence Schemas
 *
 * Effect Schema definitions for session state, route state, and panel configuration.
 * These schemas enable runtime validation and type inference for persistence layer.
 *
 * @module lib/session/schemas
 */

import { Schema } from "effect"

// =============================================================================
// Branded IDs
// =============================================================================

export const SessionId = Schema.String.pipe(
  Schema.brand("SessionId"),
  Schema.minLength(1)
)
export type SessionId = typeof SessionId.Type

// =============================================================================
// Route State
// =============================================================================

/**
 * RouteState - Persisted scroll position for a route
 *
 * Enables restoration of exact scroll position when navigating back to a route.
 */
export class RouteState extends Schema.Class<RouteState>("RouteState")({
  id: SessionId,
  route_path: Schema.String,
  scroll_x: Schema.Number,
  scroll_y: Schema.Number,
  timestamp: Schema.Number,
}) {
  static fromPath(path: string): RouteState {
    return new RouteState({
      id: `route-${path.replace(/\//g, "-")}` as SessionId,
      route_path: path,
      scroll_x: 0,
      scroll_y: 0,
      timestamp: Date.now(),
    })
  }

  withScroll(x: number, y: number): RouteState {
    return new RouteState({
      ...this,
      scroll_x: x,
      scroll_y: y,
      timestamp: Date.now(),
    })
  }
}

// =============================================================================
// Panel Configuration
// =============================================================================

/**
 * PanelPosition - X/Y coordinates for panel placement
 */
export const PanelPosition = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type PanelPosition = typeof PanelPosition.Type

/**
 * PanelConfig - Persisted panel layout state
 *
 * Enables restoration of drawer, floating panel, and overlay positions.
 */
export class PanelConfig extends Schema.Class<PanelConfig>("PanelConfig")({
  id: SessionId,
  panel_id: Schema.String,
  is_open: Schema.Boolean,
  width: Schema.Number,
  height: Schema.Number,
  position: PanelPosition,
  z_index: Schema.Number,
  timestamp: Schema.Number,
}) {
  static create(panelId: string, config: Partial<Omit<PanelConfig, "id" | "panel_id" | "timestamp">>): PanelConfig {
    return new PanelConfig({
      id: `panel-${panelId}` as SessionId,
      panel_id: panelId,
      is_open: config.is_open ?? true,
      width: config.width ?? 320,
      height: config.height ?? 480,
      position: config.position ?? { x: 0, y: 0 },
      z_index: config.z_index ?? 0,
      timestamp: Date.now(),
    })
  }

  withPosition(x: number, y: number): PanelConfig {
    return new PanelConfig({
      ...this,
      position: { x, y },
      timestamp: Date.now(),
    })
  }

  withSize(width: number, height: number): PanelConfig {
    return new PanelConfig({
      ...this,
      width,
      height,
      timestamp: Date.now(),
    })
  }

  toggle(): PanelConfig {
    return new PanelConfig({
      ...this,
      is_open: !this.is_open,
      timestamp: Date.now(),
    })
  }
}

// =============================================================================
// Generic App State
// =============================================================================

/**
 * AppState - Generic key-value state for heterogeneous applications
 *
 * Enables testbeds and other apps to persist arbitrary JSON state.
 * The app_key should be unique per application (e.g., "testbed/slider", "docs/viewer").
 */
export class AppState extends Schema.Class<AppState>("AppState")({
  id: SessionId,
  app_key: Schema.String,
  state_json: Schema.String,
  timestamp: Schema.Number,
}) {
  static create<T>(appKey: string, state: T): AppState {
    return new AppState({
      id: `app-${appKey.replace(/\//g, "-")}` as SessionId,
      app_key: appKey,
      state_json: JSON.stringify(state),
      timestamp: Date.now(),
    })
  }

  parse<T>(): T | null {
    try {
      return JSON.parse(this.state_json) as T
    } catch {
      return null
    }
  }

  update<T>(updater: (current: T | null) => T): AppState {
    const current = this.parse<T>()
    const next = updater(current)
    return new AppState({
      ...this,
      state_json: JSON.stringify(next),
      timestamp: Date.now(),
    })
  }
}

// =============================================================================
// Database Row Types (for SQL queries)
// =============================================================================

/**
 * RouteStateRow - Database row representation
 */
export const RouteStateRow = Schema.Struct({
  id: Schema.String,
  route_path: Schema.String,
  scroll_x: Schema.Number,
  scroll_y: Schema.Number,
  timestamp: Schema.Number,
})
export type RouteStateRow = typeof RouteStateRow.Type

/**
 * PanelConfigRow - Database row representation (flattened position)
 */
export const PanelConfigRow = Schema.Struct({
  id: Schema.String,
  panel_id: Schema.String,
  is_open: Schema.Number, // SQLite stores booleans as integers
  width: Schema.Number,
  height: Schema.Number,
  position_x: Schema.Number,
  position_y: Schema.Number,
  z_index: Schema.Number,
  timestamp: Schema.Number,
})
export type PanelConfigRow = typeof PanelConfigRow.Type

/**
 * AppStateRow - Database row representation
 */
export const AppStateRow = Schema.Struct({
  id: Schema.String,
  app_key: Schema.String,
  state_json: Schema.String,
  timestamp: Schema.Number,
})
export type AppStateRow = typeof AppStateRow.Type
