/**
 * IIoT Migration Runner
 *
 * Provides the PgMigrator layer for executing IIoT migrations.
 * Tracks migration state in `effect_sql_migrations` table.
 *
 * IMPORTANT: PgMigrator.layer is a side-effect layer - migrations run
 * automatically when the layer is provided/built. You don't call a
 * "run migrations" method; the layer initialization IS the migration.
 *
 * Usage:
 * ```ts
 * import { Effect, Layer } from 'effect'
 * import { PgClient } from '@effect/sql-pg'
 * import { IIoTMigratorLive } from './migrations/runner'
 *
 * // Define your application
 * const program = Effect.gen(function* () {
 *   const sql = yield* SqlClient.SqlClient
 *   // Migrations have already run at this point
 *   yield* sql`SELECT 1`
 * })
 *
 * // Compose layers - migrations run when MigratorLive builds
 * const AppLive = Layer.mergeAll(
 *   PgClientLive,
 *   IIoTMigratorLive
 * )
 *
 * Effect.runPromise(program.pipe(Effect.provide(AppLive)))
 * ```
 *
 * @module
 */

import { Layer } from 'effect'
import { PgMigrator } from '@effect/sql-pg'
import { PgClient } from '@effect/sql-pg'
import { iiotMigrationLoader } from '../models/_migrations'

// =============================================================================
// Migrator Layer
// =============================================================================

/**
 * IIoT Migrator layer configured with the co-located DDL migrations.
 *
 * This is a SIDE-EFFECT layer - migrations execute when the layer is built.
 * The migrator:
 * - Uses iiotMigrationLoader (Migrator.fromRecord)
 * - Tracks migrations in `effect_sql_migrations` table
 * - Runs all pending migrations on layer construction
 *
 * Requires: PgClient.SqlClient (provide via Layer.provide)
 */
export const IIoTMigratorLive = PgMigrator.layer({
  loader: iiotMigrationLoader,
})

// =============================================================================
// Composed Layers for Convenience
// =============================================================================

/**
 * Creates a complete application layer with database connection and migrations.
 *
 * Usage:
 * ```ts
 * const AppLayer = createAppLayer({
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'iiot_db',
 *   username: 'iiot',
 *   password: Redacted.make('secret'),
 * })
 *
 * const program = Effect.gen(function* () {
 *   const sql = yield* SqlClient.SqlClient
 *   // Database is ready, migrations applied
 * })
 *
 * Effect.runPromise(program.pipe(Effect.provide(AppLayer)))
 * ```
 */
export const createAppLayer = (config: PgClient.PgClientConfig) => {
  const PgClientLive = PgClient.layer(config)

  // Migrations run when MigratorLive builds (requires PgClient)
  const MigratorLive = IIoTMigratorLive.pipe(
    Layer.provide(PgClientLive)
  )

  // Merge both layers - PgClient for app usage, Migrator for side-effect
  return Layer.merge(PgClientLive, MigratorLive)
}

// =============================================================================
// Test Layer Helper
// =============================================================================

/**
 * Test configuration for integration tests.
 *
 * Uses the iiot-mock-db container (port 5433).
 */
export const TestDatabaseConfig: PgClient.PgClientConfig = {
  host: 'localhost',
  port: 5433,
  database: 'iiot_mock',
  username: 'iiot',
  password: 'iiot_dev' as any, // Redacted.make in actual usage
  maxConnections: 5,
}

/**
 * Test layer with migrations for integration testing.
 *
 * Note: Ensure iiot-mock-db container is running before tests.
 */
export const TestAppLayer = createAppLayer(TestDatabaseConfig)
