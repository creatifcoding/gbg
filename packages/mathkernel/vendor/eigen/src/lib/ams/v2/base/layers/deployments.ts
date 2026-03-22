/**
 * AMS v2 Deployment Layers
 *
 * Pre-composed layers for different deployment targets:
 * - TestLayer: In-memory state, no EventLog (fast tests)
 * - TauriLayer: SQL-backed state, SQLite file, EventLog (desktop)
 * - ClusterLayer: SQL-backed state, PostgreSQL, EventLog (K8s)
 *
 * @module @gbg/tmnl/ams/v2/base/layers/deployments
 */

import { Layer } from 'effect'
import { AssetEntityHandlers } from '../handlers/asset'
import { AssetState } from '../services/asset-state'
import { AssetStateSQLLayer } from '../services/asset-state-sql'
import { AllRepositoriesLive } from '../services/repositories'
import { SqliteTestLayer } from '../repositories/sqlite-layer'
import { EventLogStackLayer, SqlEventJournalLayer } from '../handlers/sql-event-journal'
import { AssetEventHandlers } from '../handlers/event-handlers'

// ─────────────────────────────────────────────────────────────────────────────
// Test Layer (Fast, In-Memory)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test Layer
 *
 * Uses in-memory AssetState (Ref<HashMap>) without EventLog.
 * Fastest option for unit tests that don't need persistence.
 *
 * Provides:
 * - AssetEntity handlers (RPC endpoints)
 * - AssetState (in-memory)
 *
 * Does NOT provide:
 * - EventLog
 * - SQL persistence
 *
 * @example
 * ```ts
 * const result = yield* Effect.runPromise(
 *   handler.pipe(Effect.provide(TestLayer))
 * )
 * ```
 */
export const TestLayer = AssetEntityHandlers.pipe(
  Layer.provide(AssetState.Default)
)

// ─────────────────────────────────────────────────────────────────────────────
// SQL Test Layer (Persistent, In-Memory SQLite)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SQL Test Layer
 *
 * Uses SQL-backed AssetState with in-memory SQLite.
 * Good for integration tests that need SQL but not file persistence.
 *
 * Provides:
 * - AssetEntity handlers
 * - AssetState (SQL-backed)
 * - All repositories
 * - EventLog + EventJournal
 * - Event handlers
 *
 * @example
 * ```ts
 * await Effect.runPromise(
 *   Effect.gen(function* () {
 *     const client = yield* makeClient('test')
 *     yield* client.CreateAsset({ ... })
 *   }).pipe(Effect.provide(SqlTestLayer))
 * )
 * ```
 */
const RepositoriesWithSqlite = AllRepositoriesLive.pipe(
  Layer.provide(SqliteTestLayer)
)

const AssetStateWithRepos = AssetStateSQLLayer.pipe(
  Layer.provide(RepositoriesWithSqlite),
  Layer.provide(SqliteTestLayer)
)

const EventLogWithSqlite = Layer.mergeAll(
  EventLogStackLayer,
  SqlEventJournalLayer
).pipe(Layer.provide(SqliteTestLayer))

const EventHandlersWithDeps = AssetEventHandlers.pipe(
  Layer.provide(AssetStateWithRepos),
  Layer.provide(EventLogWithSqlite)
)

export const SqlTestLayer = Layer.mergeAll(
  AssetEntityHandlers.pipe(
    Layer.provide(AssetStateWithRepos),
    Layer.provide(EventLogWithSqlite)
  ),
  EventHandlersWithDeps,
  RepositoriesWithSqlite,
  EventLogWithSqlite
)

// ─────────────────────────────────────────────────────────────────────────────
// Tauri Layer (SQLite File Persistence)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create Tauri Layer for desktop deployment
 *
 * Uses SQL-backed AssetState with SQLite file persistence.
 * Requires a SqlClient layer configured for file-based SQLite.
 *
 * @param sqliteFileLayer - Layer providing SqlClient with file-based SQLite
 *
 * @example
 * ```ts
 * const SqliteFileLayer = makeSqliteFileLayer('./data/ams.db')
 * const TauriLayer = makeTauriLayer(SqliteFileLayer)
 *
 * await Effect.runPromise(
 *   handler.pipe(Effect.provide(TauriLayer))
 * )
 * ```
 */
export const makeTauriLayer = <E, R>(
  sqliteFileLayer: Layer.Layer<import('@effect/sql').SqlClient.SqlClient, E, R>
) => {
  const repos = AllRepositoriesLive.pipe(Layer.provide(sqliteFileLayer))
  const assetState = AssetStateSQLLayer.pipe(
    Layer.provide(repos),
    Layer.provide(sqliteFileLayer)
  )
  const eventLog = Layer.mergeAll(
    EventLogStackLayer,
    SqlEventJournalLayer
  ).pipe(Layer.provide(sqliteFileLayer))
  const eventHandlers = AssetEventHandlers.pipe(
    Layer.provide(assetState),
    Layer.provide(eventLog)
  )

  return Layer.mergeAll(
    AssetEntityHandlers.pipe(
      Layer.provide(assetState),
      Layer.provide(eventLog)
    ),
    eventHandlers,
    repos,
    eventLog
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cluster Layer (PostgreSQL)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create Cluster Layer for K8s deployment
 *
 * Uses SQL-backed AssetState with PostgreSQL.
 * Requires a SqlClient layer configured for PostgreSQL.
 *
 * @param postgresLayer - Layer providing SqlClient with PostgreSQL
 *
 * @example
 * ```ts
 * const PostgresLayer = makePostgresLayer({
 *   host: process.env.PG_HOST,
 *   port: Number(process.env.PG_PORT),
 *   database: process.env.PG_DATABASE,
 * })
 * const ClusterLayer = makeClusterLayer(PostgresLayer)
 *
 * await Effect.runPromise(
 *   handler.pipe(Effect.provide(ClusterLayer))
 * )
 * ```
 */
export const makeClusterLayer = <E, R>(
  postgresLayer: Layer.Layer<import('@effect/sql').SqlClient.SqlClient, E, R>
) => {
  const repos = AllRepositoriesLive.pipe(Layer.provide(postgresLayer))
  const assetState = AssetStateSQLLayer.pipe(
    Layer.provide(repos),
    Layer.provide(postgresLayer)
  )
  const eventLog = Layer.mergeAll(
    EventLogStackLayer,
    SqlEventJournalLayer
  ).pipe(Layer.provide(postgresLayer))
  const eventHandlers = AssetEventHandlers.pipe(
    Layer.provide(assetState),
    Layer.provide(eventLog)
  )

  return Layer.mergeAll(
    AssetEntityHandlers.pipe(
      Layer.provide(assetState),
      Layer.provide(eventLog)
    ),
    eventHandlers,
    repos,
    eventLog
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Minimal Layers (Components Only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal repositories layer (needs SqlClient)
 *
 * Use when you need just the repositories without handlers.
 */
export const RepositoriesOnlyLayer = AllRepositoriesLive

/**
 * Minimal EventLog layer (needs SqlClient)
 *
 * Use when you need just EventLog without handlers.
 */
export const EventLogOnlyLayer = Layer.mergeAll(
  EventLogStackLayer,
  SqlEventJournalLayer
)
