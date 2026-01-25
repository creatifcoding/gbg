/**
 * IIoT Integration Test Layer
 *
 * Provides database connection and services for integration tests.
 * Migrations run automatically when the layer is built.
 *
 * Requires: docker compose -f docker/docker-compose.iiot.yml up -d
 * Connection: postgresql://iiot:iiot_dev@localhost:5433/iiot_mock
 *
 * @module
 */

import { Effect, Layer, Redacted } from 'effect'
import { PgClient } from '@effect/sql-pg'
import { TimeSeriesClient } from '../../services/l1/TimeSeriesClient'
import { GraphClient } from '../../services/l1/GraphClient'
import {
  IIoTRepositoriesLive,
  AssetRepositoriesLive,
  AlarmRepositoriesLive,
  ReadingRepositoriesLive,
} from '../../repos'
import { IIoTMigratorLive } from '../../migrations/runner'

// =============================================================================
// Column Name Transformation
// =============================================================================

/**
 * Transform snake_case/lowercase column names to camelCase
 *
 * Must match the transform in IIoTPgClient.ts for consistent behavior.
 * PostgreSQL lowercases unquoted identifiers in RETURN AS clauses.
 */
const transformResultNames = (columnName: string): string =>
  columnName.replace(/_([a-z])/g, (_, char) => char.toUpperCase())

// =============================================================================
// Test Database Configuration
// =============================================================================

/**
 * PostgreSQL client layer for integration tests
 *
 * Uses hardcoded values matching docker-compose.iiot.yml
 * so tests don't depend on environment variables.
 *
 * Includes transformResultNames for consistent column name handling.
 */
export const TestPgClient = PgClient.layer({
  host: 'localhost',
  port: 5433,
  database: 'iiot_mock',
  username: 'iiot',
  password: Redacted.make('iiot_dev'),
  maxConnections: 5,
  transformResultNames,
})

/**
 * Migration layer for tests
 *
 * Runs all migrations when built. This is a side-effect layer -
 * migrations execute during layer construction.
 */
const TestMigratorLive = IIoTMigratorLive.pipe(Layer.provide(TestPgClient))

/**
 * Base layer with PgClient + migrations applied
 *
 * Use this as the foundation for all test layers.
 * Migrations run once when the layer is built.
 */
export const TestPgClientWithMigrations = Layer.merge(TestPgClient, TestMigratorLive)

// =============================================================================
// Service Layers (built on TestPgClient)
// =============================================================================

/**
 * TimeSeriesClient layer using test database
 *
 * The TimeSeriesClient.Default depends on IIoTPgClientLive, but we provide
 * TestPgClient instead to override the connection configuration.
 */
const TimeSeriesClientLayer = TimeSeriesClient.Default.pipe(
  Layer.provide(TestPgClient)
)

/**
 * GraphClient layer using test database
 */
const GraphClientLayer = GraphClient.Default.pipe(Layer.provide(TestPgClient))

// =============================================================================
// Repository Layers (built on TestPgClient)
// =============================================================================

/**
 * All repositories using test database (with migrations)
 *
 * Provides:
 * - PlantRepo, LineRepo, MachineRepo, SensorRepo (assets)
 * - AlarmRepo, AlarmContextRepo (alarms)
 * - SensorReadingRepo, AggregatedReadingRepo, AnalyticsRecordRepo (readings)
 * - Migrations run automatically on layer build
 */
export const RepositoriesIntegrationLayer = IIoTRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

/**
 * Asset repositories only (with migrations)
 */
export const AssetRepositoriesIntegrationLayer = AssetRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

/**
 * Alarm repositories only (with migrations)
 */
export const AlarmRepositoriesIntegrationLayer = AlarmRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

/**
 * Reading repositories only (with migrations)
 */
export const ReadingRepositoriesIntegrationLayer = ReadingRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

// =============================================================================
// Combined Test Layers
// =============================================================================

/**
 * Full IIoT integration test layer
 *
 * Provides:
 * - PgClient for raw SQL access
 * - TimeSeriesClient for TimescaleDB operations
 * - GraphClient for Apache AGE operations
 * - Migrations run automatically on layer build
 *
 * Usage with @effect/vitest:
 * ```typescript
 * import { it } from '@effect/vitest'
 * import { IIoTIntegrationLayer } from './layer'
 *
 * it.layer(IIoTIntegrationLayer)('test name', () =>
 *   Effect.gen(function* () {
 *     const tsClient = yield* TimeSeriesClient
 *     // ... test code
 *   })
 * )
 * ```
 */
export const IIoTIntegrationLayer = Layer.mergeAll(
  TestPgClientWithMigrations,
  TimeSeriesClientLayer,
  GraphClientLayer
)

/**
 * Full IIoT layer with all repositories
 *
 * Provides all services + all repositories for comprehensive tests.
 * Migrations run automatically on layer build.
 */
export const FullIIoTIntegrationLayer = Layer.mergeAll(
  TestPgClientWithMigrations,
  TimeSeriesClientLayer,
  GraphClientLayer,
  RepositoriesIntegrationLayer
)

/**
 * Layer with only TimeSeriesClient (includes migrations)
 */
export const TimeSeriesIntegrationLayer = Layer.merge(
  TestPgClientWithMigrations,
  TimeSeriesClientLayer
)

/**
 * Layer with only GraphClient (includes migrations)
 */
export const GraphIntegrationLayer = Layer.merge(TestPgClientWithMigrations, GraphClientLayer)

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Clean up test data before/after tests
 *
 * Removes data with TEST- prefix in device_id to avoid affecting mock data.
 */
export const cleanTestData = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Clean TimescaleDB test data
  yield* sql`
    DELETE FROM iiot.sensor_readings
    WHERE device_id LIKE 'TEST-%'
  `.pipe(Effect.orElseSucceed(() => undefined))

  // Clean Apache AGE test nodes and edges
  // Note: This is a no-op if TEST- nodes don't exist
  yield* sql
    .unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MATCH (n)
      WHERE n.device_id STARTS WITH 'TEST-' OR n.id STARTS WITH 'TEST-'
      DETACH DELETE n
    $$) AS (result agtype)
  `)
    .pipe(Effect.orElseSucceed(() => undefined))

  yield* Effect.log('Cleaned test data')
})

/**
 * Clean up test assets (Plant, Line, Machine, Sensor)
 *
 * Order matters due to foreign key constraints:
 * Sensors -> Machines -> Lines -> Plants
 */
export const cleanTestAssets = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  yield* sql`DELETE FROM iiot.sensors WHERE device_id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  yield* sql`DELETE FROM iiot.machines WHERE id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  yield* sql`DELETE FROM iiot.lines WHERE id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  yield* sql`DELETE FROM iiot.plants WHERE id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )

  yield* Effect.log('Cleaned test assets')
})

/**
 * Clean up test alarms (Alarm table only)
 *
 * Note: iiot.alarm_context is now a materialized view (not a table).
 * It's refreshed from iiot.alarms and iiot.sensor_readings joins.
 * No DELETE needed - the view reflects current source data.
 */
export const cleanTestAlarms = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  yield* sql`DELETE FROM iiot.alarms WHERE id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  // Also clean alarms created via insert (which generate IDs)
  // These can be identified by device_id
  yield* sql`DELETE FROM iiot.alarms WHERE device_id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )

  yield* Effect.log('Cleaned test alarms')
})

/**
 * Clean up test readings (SensorReading, AnalyticsRecord)
 */
export const cleanTestReadings = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  yield* sql`DELETE FROM iiot.sensor_readings WHERE device_id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )
  yield* sql`DELETE FROM iiot.analytics_records WHERE device_id LIKE 'TEST-%'`.pipe(
    Effect.orElseSucceed(() => undefined)
  )

  yield* Effect.log('Cleaned test readings')
})

/**
 * Clean all test data (assets, alarms, readings)
 *
 * Use this for full cleanup between test suites.
 */
export const cleanAllTestData = Effect.gen(function* () {
  // Order: readings first (no FKs to assets), then alarms, then assets
  yield* cleanTestReadings
  yield* cleanTestAlarms
  yield* cleanTestAssets
  yield* cleanTestData // Also clean graph data
  yield* Effect.log('Cleaned all test data')
})

/**
 * Wrapper to run test with clean database state
 *
 * Usage:
 * ```typescript
 * it.layer(IIoTIntegrationLayer)('test', () =>
 *   withCleanDatabase(
 *     Effect.gen(function* () {
 *       // Test code here
 *     })
 *   )
 * )
 * ```
 */
export const withCleanDatabase = <A, E, R>(test: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    yield* cleanTestData
    return yield* test
  })

/**
 * Wrapper to run test with fully clean state (all tables)
 */
export const withFullyCleanDatabase = <A, E, R>(test: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    yield* cleanAllTestData
    return yield* test
  })

/**
 * Check if database is available before running tests
 *
 * Returns true if database connection succeeds, false otherwise.
 */
export const isDatabaseAvailable = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  const result = yield* sql<{ ok: number }>`SELECT 1 as ok`.pipe(
    Effect.map(() => true),
    Effect.orElseSucceed(() => false)
  )
  return result
})

/**
 * Skip test if database is not available
 *
 * Usage:
 * ```typescript
 * it.layer(IIoTIntegrationLayer)('test', () =>
 *   skipIfDatabaseUnavailable(
 *     Effect.gen(function* () {
 *       // Test code
 *     })
 *   )
 * )
 * ```
 */
export const skipIfDatabaseUnavailable = <A, E, R>(
  test: Effect.Effect<A, E, R>
): Effect.Effect<A | undefined, E, R | PgClient.PgClient> =>
  Effect.gen(function* () {
    const available = yield* isDatabaseAvailable
    if (!available) {
      yield* Effect.log(
        'SKIPPING: IIoT database not available. Run: docker compose -f docker/docker-compose.iiot.yml up -d'
      )
      return undefined
    }
    return yield* test
  })
