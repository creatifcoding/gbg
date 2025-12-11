/**
 * AMS v2 Runtime Configuration
 *
 * Config-driven layer selection based on AMS_MODE environment variable.
 *
 * @module @gbg/tmnl/ams/v2/base/layers/runtime
 */

import { Config, Effect, Layer, pipe } from 'effect'
import { TestLayer, SqlTestLayer } from './deployments'

// ─────────────────────────────────────────────────────────────────────────────
// Runtime Mode Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * AMS runtime mode
 *
 * - test: In-memory state, no persistence (fastest)
 * - sql-test: In-memory SQLite, full CQRS (integration tests)
 * - tauri: SQLite file persistence (desktop)
 * - cluster: PostgreSQL (K8s production)
 */
export type AmsMode = 'test' | 'sql-test' | 'tauri' | 'cluster'

/**
 * AMS runtime configuration
 */
export interface AmsRuntimeConfig {
  readonly mode: AmsMode
  readonly sqlitePath?: string // For tauri mode
  readonly postgresUrl?: string // For cluster mode
}

// ─────────────────────────────────────────────────────────────────────────────
// Config Parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse AMS_MODE from environment
 *
 * Defaults to 'test' if not set.
 */
export const AmsMode = Config.string('AMS_MODE').pipe(
  Config.withDefault('test'),
  Config.map((mode): AmsMode => {
    const valid: AmsMode[] = ['test', 'sql-test', 'tauri', 'cluster']
    if (valid.includes(mode as AmsMode)) {
      return mode as AmsMode
    }
    console.warn(`[AMS] Invalid AMS_MODE "${mode}", defaulting to "test"`)
    return 'test'
  })
)

/**
 * Full AMS runtime config from environment
 */
export const AmsRuntimeConfig = Config.all({
  mode: AmsMode,
  sqlitePath: Config.string('AMS_SQLITE_PATH').pipe(Config.withDefault('')),
  postgresUrl: Config.string('AMS_POSTGRES_URL').pipe(Config.withDefault('')),
})

// ─────────────────────────────────────────────────────────────────────────────
// Layer Selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Select layer based on mode
 *
 * Note: For 'tauri' and 'cluster' modes, you must provide
 * the SQL layer yourself using makeTauriLayer() or makeClusterLayer().
 * This function only handles self-contained layers.
 */
export const selectLayerByMode = (mode: AmsMode) => {
  switch (mode) {
    case 'test':
      return TestLayer
    case 'sql-test':
      return SqlTestLayer
    case 'tauri':
      // Tauri requires external SqlClient layer configuration
      console.warn('[AMS] Tauri mode requires makeTauriLayer(SqliteFileLayer)')
      return SqlTestLayer // Fallback
    case 'cluster':
      // Cluster requires external SqlClient layer configuration
      console.warn('[AMS] Cluster mode requires makeClusterLayer(PostgresLayer)')
      return SqlTestLayer // Fallback
    default:
      return TestLayer
  }
}

/**
 * AMS Runtime Layer (Config-Driven)
 *
 * Reads AMS_MODE from environment and selects appropriate layer.
 * Only supports 'test' and 'sql-test' modes automatically.
 * For 'tauri' and 'cluster', use makeTauriLayer/makeClusterLayer directly.
 *
 * @example
 * ```bash
 * AMS_MODE=sql-test bun run test
 * ```
 *
 * @example
 * ```ts
 * const result = yield* handler.pipe(
 *   Effect.provide(AmsRuntimeLayer)
 * )
 * ```
 */
export const AmsRuntimeLayer = Layer.unwrapEffect(
  pipe(
    Effect.config(AmsMode),
    Effect.map(selectLayerByMode),
    Effect.tap((layer) =>
      Effect.logInfo(`[AMS] Runtime layer selected`)
    )
  )
)
