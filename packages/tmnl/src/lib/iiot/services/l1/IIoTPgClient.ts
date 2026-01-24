/**
 * IIoTPgClient - Shared PostgreSQL Connection Layer for IIoT Database
 *
 * Provides:
 * - PgClient configuration for TimescaleDB + Apache AGE database
 * - Environment-based configuration with sensible defaults
 * - Health check utilities
 *
 * Connection: postgresql://iiot:iiot_dev@localhost:5433/iiot_mock
 *
 * @see docker/docker-compose.iiot.yml for database setup
 * @module
 */

import { Effect, Config, Redacted } from 'effect'
import { PgClient } from '@effect/sql-pg'

// =============================================================================
// Column Name Transformation
// =============================================================================

/**
 * Transform snake_case/lowercase column names to camelCase
 *
 * PostgreSQL lowercases all unquoted identifiers. When using Apache AGE Cypher:
 *   RETURN s.device_id AS deviceId  →  returns 'deviceid' (lowercase)
 *
 * This transform normalizes all result columns to camelCase.
 *
 * @see https://deepwiki.com/Effect-TS/effect/6.2-database-adapters-and-drivers
 */
const transformResultNames = (columnName: string): string =>
  columnName.replace(/_([a-z])/g, (_, char) => char.toUpperCase())

// =============================================================================
// Configuration
// =============================================================================

/**
 * IIoT database configuration from environment variables
 *
 * Environment variables (with defaults matching docker-compose.iiot.yml):
 * - IIOT_POSTGRES_HOST (default: localhost)
 * - IIOT_POSTGRES_PORT (default: 5433 - different from main postgres)
 * - IIOT_POSTGRES_DB (default: iiot_mock)
 * - IIOT_POSTGRES_USER (default: iiot)
 * - IIOT_POSTGRES_PASSWORD (default: iiot_dev)
 * - IIOT_POSTGRES_POOL_SIZE (default: 10)
 *
 * Column naming: Uses transformResultNames to convert snake_case → camelCase
 */
export const IIoTPgClientLive = PgClient.layerConfig({
  host: Config.string('IIOT_POSTGRES_HOST').pipe(Config.withDefault('localhost')),
  port: Config.number('IIOT_POSTGRES_PORT').pipe(Config.withDefault(5433)),
  database: Config.string('IIOT_POSTGRES_DB').pipe(Config.withDefault('iiot_mock')),
  username: Config.string('IIOT_POSTGRES_USER').pipe(Config.withDefault('iiot')),
  password: Config.redacted('IIOT_POSTGRES_PASSWORD').pipe(
    Config.withDefault(Redacted.make('iiot_dev'))
  ),
  maxConnections: Config.number('IIOT_POSTGRES_POOL_SIZE').pipe(Config.withDefault(10)),
  transformResultNames: Config.succeed(transformResultNames),
})

/**
 * IIoT PgClient layer with explicit configuration (for testing)
 */
export const makeIIoTPgClient = (config: {
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
  maxConnections?: number
}) =>
  PgClient.layer({
    host: config.host ?? 'localhost',
    port: config.port ?? 5433,
    database: config.database ?? 'iiot_mock',
    username: config.username ?? 'iiot',
    password: Redacted.make(config.password ?? 'iiot_dev'),
    maxConnections: config.maxConnections ?? 10,
    transformResultNames,
  })

// =============================================================================
// Health Check
// =============================================================================

/**
 * IIoT database health status
 */
export interface IIoTDatabaseHealthStatus {
  readonly healthy: boolean
  readonly connection: boolean
  readonly timescaledb: string | null
  readonly age: string | null
  readonly hypertable: {
    readonly sensorReadings: boolean
    readonly numChunks: number
    readonly compressionEnabled: boolean
  }
  readonly graph: {
    readonly iiotGraph: boolean
    readonly sensorCount: number
  }
  readonly continuousAggregates: {
    readonly readings1min: boolean
    readonly readings1hour: boolean
  }
}

/**
 * Check IIoT database health - verifies connection, extensions, tables, and graph
 *
 * @example
 * ```typescript
 * const program = checkIIoTDatabaseHealth.pipe(
 *   Effect.provide(IIoTPgClientLive),
 *   Effect.map((status) => {
 *     if (!status.healthy) {
 *       console.error('IIoT Database not ready:', status)
 *     }
 *   })
 * )
 * ```
 */
export const checkIIoTDatabaseHealth = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient

  // Check connection
  const connection = yield* sql<{ test: number }>`SELECT 1 as test`.pipe(
    Effect.map(() => true),
    Effect.catchAll(() => Effect.succeed(false))
  )

  // Check TimescaleDB version
  const timescaledb = yield* sql<{ extversion: string }>`
    SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'
  `.pipe(
    Effect.map((rows) => rows[0]?.extversion ?? null),
    Effect.catchAll(() => Effect.succeed(null))
  )

  // Check Apache AGE version
  const age = yield* sql<{ extversion: string }>`
    SELECT extversion FROM pg_extension WHERE extname = 'age'
  `.pipe(
    Effect.map((rows) => rows[0]?.extversion ?? null),
    Effect.catchAll(() => Effect.succeed(null))
  )

  // Check sensor_readings hypertable
  const hypertableInfo = yield* sql<{
    hypertable_name: string
    num_chunks: number
    compression_enabled: boolean
  }>`
    SELECT
      hypertable_name,
      num_chunks,
      compression_enabled
    FROM timescaledb_information.hypertables
    WHERE hypertable_schema = 'iiot' AND hypertable_name = 'sensor_readings'
  `.pipe(
    Effect.map((rows) =>
      rows[0]
        ? {
            sensorReadings: true,
            numChunks: rows[0].num_chunks,
            compressionEnabled: rows[0].compression_enabled,
          }
        : { sensorReadings: false, numChunks: 0, compressionEnabled: false }
    ),
    Effect.catchAll(() =>
      Effect.succeed({ sensorReadings: false, numChunks: 0, compressionEnabled: false })
    )
  )

  // Check Apache AGE graph exists and count sensors
  // Note: AGE is preloaded, no LOAD needed
  const graphInfo = yield* sql
    .unsafe<{ cnt: string }>(
      `
      SELECT cnt::text FROM cypher('iiot_graph', $$
        MATCH (s:sensor) RETURN COUNT(s) AS cnt
      $$) AS (cnt agtype)
    `
    )
    .pipe(
      Effect.map((rows) => ({
        iiotGraph: true,
        sensorCount: parseInt(rows[0]?.cnt ?? '0', 10),
      })),
      Effect.catchAll(() => Effect.succeed({ iiotGraph: false, sensorCount: 0 }))
    )

  // Check continuous aggregates
  const checkAggregate = (viewName: string) =>
    sql<{ exists: boolean }>`
      SELECT EXISTS (
        SELECT 1 FROM timescaledb_information.continuous_aggregates
        WHERE materialization_hypertable_schema = 'iiot' AND view_name = ${viewName}
      ) as exists
    `.pipe(
      Effect.map((rows) => rows[0]?.exists ?? false),
      Effect.catchAll(() => Effect.succeed(false))
    )

  const readings1min = yield* checkAggregate('readings_1min')
  const readings1hour = yield* checkAggregate('readings_1hour')

  const healthy =
    connection &&
    timescaledb !== null &&
    age !== null &&
    hypertableInfo.sensorReadings &&
    graphInfo.iiotGraph

  return {
    healthy,
    connection,
    timescaledb,
    age,
    hypertable: hypertableInfo,
    graph: graphInfo,
    continuousAggregates: {
      readings1min,
      readings1hour,
    },
  } satisfies IIoTDatabaseHealthStatus
})
