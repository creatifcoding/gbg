/**
 * Genifer Migration Runner
 *
 * Provides the PgMigrator layer for executing Genifer migrations.
 * Tracks migration state in `genifer_migrations` table (separate from iiot).
 *
 * IMPORTANT: PgMigrator.layer is a side-effect layer — migrations run
 * automatically when the layer is provided/built.
 *
 * Usage:
 * ```ts
 * import { Effect, Layer } from 'effect'
 * import { PgClient } from '@effect/sql-pg'
 * import { GeniferMigratorLive } from './migrations/runner'
 *
 * const program = Effect.gen(function* () {
 *   const sql = yield* SqlClient.SqlClient
 *   // Genifer tables exist at this point
 *   yield* sql`SELECT count(*) FROM genifer.trees`
 * })
 *
 * const AppLive = Layer.mergeAll(PgClientLive, GeniferMigratorLive)
 * Effect.runPromise(program.pipe(Effect.provide(AppLive)))
 * ```
 *
 * @module
 */

import { Layer, Redacted } from 'effect'
import { PgMigrator, PgClient } from '@effect/sql-pg'
import { geniferMigrationLoader } from '../models/_migrations'

// =============================================================================
// Migrator Layer
// =============================================================================

/**
 * Genifer Migrator layer configured with co-located DDL migrations.
 *
 * Uses `genifer_migrations` table to avoid collisions with iiot's
 * `effect_sql_migrations` in the same database.
 *
 * Requires: PgClient.SqlClient
 */
export const GeniferMigratorLive = PgMigrator.layer({
  loader: geniferMigrationLoader,
  table: 'genifer_migrations',
})

// =============================================================================
// Composed Layers
// =============================================================================

/**
 * Creates a complete layer with database connection + genifer migrations.
 */
export const createGeniferDbLayer = (config: PgClient.PgClientConfig) => {
  const PgClientLive = PgClient.layer(config)

  const MigratorLive = GeniferMigratorLive.pipe(
    Layer.provide(PgClientLive)
  )

  return Layer.merge(PgClientLive, MigratorLive)
}

// =============================================================================
// Dev/Test Configuration
// =============================================================================

/**
 * Development database config — same tmnl_postgres container as iiot.
 *
 * Connection: postgres://tmnl:tmnl_dev_password@localhost:5432/tmnl
 */
export const DevDatabaseConfig: PgClient.PgClientConfig = {
  host: 'localhost',
  port: 5432,
  database: 'tmnl',
  username: 'tmnl',
  password: Redacted.make('tmnl_dev_password'),
  maxConnections: 5,
}

/**
 * Dev layer — connects to local tmnl_postgres and runs genifer migrations.
 */
export const GeniferDevDbLayer = createGeniferDbLayer(DevDatabaseConfig)
