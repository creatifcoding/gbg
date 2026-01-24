/**
 * TimeSeriesClient - L1 TimescaleDB Access Layer
 *
 * Real implementation using @effect/sql-pg for TimescaleDB operations:
 * - Hypertable CRUD operations
 * - Continuous aggregate queries
 * - Compression/retention policy interaction
 *
 * Requires: IIoTPgClientLive layer to be provided
 *
 * ## API Reference
 *
 * ### Write Operations
 *
 * | Method | Description |
 * |--------|-------------|
 * | `insertReadings()` | Insert readings one-by-one (safe, slower) |
 * | `insertReadingsBulk()` | Batch insert (fast, for high-volume ingestion) |
 *
 * ### Read Operations
 *
 * | Method | Return Type | Latency | Use Case |
 * |--------|-------------|---------|----------|
 * | `getLatestReading()` | `Effect<Reading \| null>` | Real-time | Current sensor value |
 * | `getLatestReadingsForDevices()` | `Effect<Reading[]>` | Real-time | Dashboard multi-sensor view |
 * | `queryReadings()` | `Stream<Reading>` | Real-time | Historical range query, charts |
 * | `queryAggregated()` | `Stream<AggregatedReading>` | **1-60s lag** | Trends, reports, analytics |
 *
 * ### Diagnostics
 *
 * | Method | Description |
 * |--------|-------------|
 * | `healthCheck()` | Verify TimescaleDB extension is loaded |
 * | `getHypertableStats()` | Chunk count, compression status, total size |
 *
 * ## Latency Notes
 *
 * - **Real-time methods** query the raw `iiot.sensor_readings` hypertable directly
 * - **`queryAggregated()`** queries continuous aggregates (`readings_1min`, `readings_1hour`)
 *   which are refreshed by a background worker every ~1 minute. Data may be stale.
 *   Use for historical analysis, NOT for real-time alerting.
 *
 * @see docker/docker-compose.iiot.yml for database setup
 * @see docker/iiot-db/init.sql for schema definition
 * @module
 */

import { Effect, Stream, Context, Duration, Layer, DateTime, pipe } from 'effect'
import { PgClient } from '@effect/sql-pg'
import type { DeviceId } from '../../schemas/identifiers'
import type { SensorReading, AggregatedReading, TimeBucket, QualityScore } from '../../schemas/readings'
import { IIoTQueryError } from '../../schemas/errors'
import { IIoTPgClientLive } from './IIoTPgClient'

// =============================================================================
// Configuration
// =============================================================================

export interface TimeSeriesConfig {
  readonly connectionString: string
  readonly poolSize?: number
  readonly statementTimeout?: Duration.Duration
}

export const TimeSeriesConfig = Context.GenericTag<TimeSeriesConfig>('iiot/TimeSeriesConfig')

// =============================================================================
// Internal Row Types (database result shapes)
// Note: Uses camelCase because PgClient.transformResultNames converts snake_case → camelCase
// =============================================================================

interface SensorReadingRow {
  time: Date
  deviceId: string
  value: number
  quality: number
}

interface AggregatedReadingRow {
  bucket: Date
  deviceId: string
  avgValue: number
  minValue: number
  maxValue: number
  stddevValue: number | null
  sampleCount: number | string // May come as bigint string
}

interface HypertableStatsRow {
  hypertableName: string
  numChunks: number
  compressionEnabled: boolean
  totalBytes: string | null
}

// =============================================================================
// Mapping Functions
// =============================================================================

const mapRowToSensorReading = (row: SensorReadingRow): SensorReading => ({
  _tag: 'SensorReading',
  time: DateTime.unsafeMake(row.time),
  deviceId: row.deviceId as DeviceId,
  value: row.value,
  quality: row.quality as QualityScore,
})

const mapRowToAggregatedReading = (row: AggregatedReadingRow): AggregatedReading => ({
  _tag: 'AggregatedReading',
  bucket: DateTime.unsafeMake(row.bucket),
  deviceId: row.deviceId as DeviceId,
  avgValue: row.avgValue,
  minValue: row.minValue,
  maxValue: row.maxValue,
  stddevValue: row.stddevValue ?? undefined,
  sampleCount:
    typeof row.sampleCount === 'string' ? parseInt(row.sampleCount, 10) : row.sampleCount,
})

// =============================================================================
// Service Definition
// =============================================================================

export class TimeSeriesClient extends Effect.Service<TimeSeriesClient>()('iiot/TimeSeriesClient', {
  effect: Effect.gen(function* () {
    const sql = yield* PgClient.PgClient

    /**
     * Insert sensor readings in batch
     *
     * Uses parameterized INSERT for safety and efficiency.
     * Handles ON CONFLICT for idempotent upserts.
     */
    const insertReadings = (
      readings: ReadonlyArray<{
        time: Date
        deviceId: DeviceId
        value: number
        quality?: number
      }>
    ): Effect.Effect<number, IIoTQueryError> =>
      Effect.gen(function* () {
        if (readings.length === 0) {
          return 0
        }

        // Build values for batch insert
        // TimescaleDB handles bulk inserts efficiently
        const result = yield* pipe(
          Effect.forEach(readings, (reading) =>
            sql`
              INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
              VALUES (
                ${reading.time},
                ${reading.deviceId},
                ${reading.value},
                ${reading.quality ?? 100}
              )
              ON CONFLICT (time, device_id) DO UPDATE SET
                value = EXCLUDED.value,
                quality = EXCLUDED.quality
              RETURNING device_id
            `
          ),
          Effect.map((results) => results.reduce((acc, r) => acc + r.length, 0))
        )

        yield* Effect.logDebug(`Inserted ${result} readings`)
        return result
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new IIoTQueryError({
              operation: 'insertReadings',
              message: `Failed to insert readings: ${String(cause)}`,
              cause,
            })
          )
        )
      )

    /**
     * Insert readings in bulk using a single statement (more efficient for large batches)
     */
    const insertReadingsBulk = (
      readings: ReadonlyArray<{
        time: Date
        deviceId: DeviceId
        value: number
        quality?: number
      }>
    ): Effect.Effect<number, IIoTQueryError> =>
      Effect.gen(function* () {
        if (readings.length === 0) {
          return 0
        }

        // Build VALUES clause for bulk insert
        const values = readings
          .map(
            (_, i) =>
              `($${i * 4 + 1}::timestamptz, $${i * 4 + 2}::text, $${i * 4 + 3}::double precision, $${i * 4 + 4}::integer)`
          )
          .join(', ')

        const params = readings.flatMap((r) => [
          r.time.toISOString(),
          r.deviceId,
          r.value,
          r.quality ?? 100,
        ])

        const result = yield* sql.unsafe<{ device_id: string }>(
          `
          INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
          VALUES ${values}
          ON CONFLICT (time, device_id) DO UPDATE SET
            value = EXCLUDED.value,
            quality = EXCLUDED.quality
          RETURNING device_id
        `,
          params
        )

        yield* Effect.logDebug(`Bulk inserted ${result.length} readings`)
        return result.length
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new IIoTQueryError({
              operation: 'insertReadingsBulk',
              message: `Failed to bulk insert readings: ${String(cause)}`,
              cause,
            })
          )
        )
      )

    /**
     * Query raw sensor readings
     *
     * Uses index: idx_readings_device (device_id, time DESC)
     */
    const queryReadings = (params: {
      deviceId: DeviceId
      since?: Date
      until?: Date
      limit?: number
    }): Stream.Stream<SensorReading, IIoTQueryError> =>
      Stream.fromEffect(
        Effect.gen(function* () {
          yield* Effect.logDebug(`Querying readings for device ${params.deviceId}`)

          // Build dynamic query based on provided params
          const since = params.since ?? new Date(Date.now() - 24 * 60 * 60 * 1000) // Default: last 24h
          const until = params.until ?? new Date()
          const limit = params.limit ?? 1000

          const rows = yield* sql<SensorReadingRow>`
            SELECT time, device_id, value, quality
            FROM iiot.sensor_readings
            WHERE device_id = ${params.deviceId}
              AND time >= ${since}
              AND time <= ${until}
            ORDER BY time DESC
            LIMIT ${limit}
          `

          return rows.map(mapRowToSensorReading)
        }).pipe(
          Effect.catchAll((cause) =>
            Effect.fail(
              new IIoTQueryError({
                operation: 'queryReadings',
                message: `Failed to query readings for device ${params.deviceId}: ${String(cause)}`,
                cause,
              })
            )
          )
        )
      ).pipe(Stream.flatMap((readings) => Stream.fromIterable(readings)))

    /**
     * Query aggregated readings from continuous aggregates
     *
     * Uses materialized views: iiot.readings_1min, iiot.readings_1hour
     */
    const queryAggregated = (params: {
      deviceId: DeviceId
      bucket: TimeBucket
      since?: Date
      until?: Date
    }): Stream.Stream<AggregatedReading, IIoTQueryError> =>
      Stream.fromEffect(
        Effect.gen(function* () {
          // Map bucket to continuous aggregate view
          const viewName =
            params.bucket === '1min' || params.bucket === '5min' || params.bucket === '15min'
              ? 'iiot.readings_1min'
              : 'iiot.readings_1hour'

          yield* Effect.logDebug(`Querying ${viewName} for device ${params.deviceId}`)

          const since = params.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Default: last 7 days
          const until = params.until ?? new Date()

          // Use unsafe query because view name is dynamic
          // Note: viewName is controlled by our code, not user input
          const rows = yield* sql.unsafe<AggregatedReadingRow>(
            `
            SELECT bucket, device_id, avg_value, min_value, max_value, stddev_value, sample_count
            FROM ${viewName}
            WHERE device_id = $1
              AND bucket >= $2
              AND bucket <= $3
            ORDER BY bucket DESC
          `,
            [params.deviceId, since.toISOString(), until.toISOString()]
          )

          return rows.map(mapRowToAggregatedReading)
        }).pipe(
          Effect.catchAll((cause) =>
            Effect.fail(
              new IIoTQueryError({
                operation: 'queryAggregated',
                message: `Failed to query aggregated readings: ${String(cause)}`,
                cause,
              })
            )
          )
        )
      ).pipe(Stream.flatMap((readings) => Stream.fromIterable(readings)))

    /**
     * Get latest reading for a device
     *
     * Optimized query using index: idx_readings_device (device_id, time DESC)
     */
    const getLatestReading = (
      deviceId: DeviceId
    ): Effect.Effect<SensorReading | null, IIoTQueryError> =>
      Effect.gen(function* () {
        yield* Effect.logDebug(`Getting latest reading for device ${deviceId}`)

        const rows = yield* sql<SensorReadingRow>`
          SELECT time, device_id, value, quality
          FROM iiot.sensor_readings
          WHERE device_id = ${deviceId}
          ORDER BY time DESC
          LIMIT 1
        `

        if (rows.length === 0) {
          return null
        }

        return mapRowToSensorReading(rows[0])
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new IIoTQueryError({
              operation: 'getLatestReading',
              message: `Failed to get latest reading for device ${deviceId}: ${String(cause)}`,
              cause,
            })
          )
        )
      )

    /**
     * Get hypertable statistics
     *
     * Uses TimescaleDB information views
     */
    const getHypertableStats = (): Effect.Effect<
      {
        tableName: string
        numChunks: number
        compressionEnabled: boolean
        totalSize: string
      },
      IIoTQueryError
    > =>
      Effect.gen(function* () {
        yield* Effect.logDebug('Getting hypertable stats')

        const rows = yield* sql<HypertableStatsRow>`
          SELECT
            h.hypertable_name,
            h.num_chunks,
            h.compression_enabled,
            pg_size_pretty(
              COALESCE(hypertable_size(format('%I.%I', h.hypertable_schema, h.hypertable_name)::regclass), 0)
            ) AS total_bytes
          FROM timescaledb_information.hypertables h
          WHERE h.hypertable_schema = 'iiot' AND h.hypertable_name = 'sensor_readings'
        `

        if (rows.length === 0) {
          return {
            tableName: 'sensor_readings',
            numChunks: 0,
            compressionEnabled: false,
            totalSize: '0 bytes',
          }
        }

        const row = rows[0]
        return {
          tableName: row.hypertableName,
          numChunks: row.numChunks,
          compressionEnabled: row.compressionEnabled,
          totalSize: row.totalBytes ?? '0 bytes',
        }
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new IIoTQueryError({
              operation: 'getHypertableStats',
              message: `Failed to get hypertable stats: ${String(cause)}`,
              cause,
            })
          )
        )
      )

    /**
     * Get readings for multiple devices (useful for dashboard views)
     */
    const getLatestReadingsForDevices = (
      deviceIds: ReadonlyArray<DeviceId>
    ): Effect.Effect<ReadonlyArray<SensorReading>, IIoTQueryError> =>
      Effect.gen(function* () {
        if (deviceIds.length === 0) {
          return []
        }

        yield* Effect.logDebug(`Getting latest readings for ${deviceIds.length} devices`)

        // Use DISTINCT ON for efficient "latest per device" query
        const rows = yield* sql<SensorReadingRow>`
          SELECT DISTINCT ON (device_id)
            time, device_id, value, quality
          FROM iiot.sensor_readings
          WHERE device_id = ANY(${[...deviceIds] as unknown as string[]})
          ORDER BY device_id, time DESC
        `

        return rows.map(mapRowToSensorReading)
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new IIoTQueryError({
              operation: 'getLatestReadingsForDevices',
              message: `Failed to get latest readings: ${String(cause)}`,
              cause,
            })
          )
        )
      )

    /**
     * Check if TimescaleDB extension is loaded and working
     */
    const healthCheck = (): Effect.Effect<boolean, IIoTQueryError> =>
      Effect.gen(function* () {
        const result = yield* sql<{ extversion: string }>`
          SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'
        `
        return result.length > 0
      }).pipe(
        Effect.catchAll((cause) =>
          Effect.fail(
            new IIoTQueryError({
              operation: 'healthCheck',
              message: `TimescaleDB health check failed: ${String(cause)}`,
              cause,
            })
          )
        )
      )

    return {
      insertReadings,
      insertReadingsBulk,
      queryReadings,
      queryAggregated,
      getLatestReading,
      getHypertableStats,
      getLatestReadingsForDevices,
      healthCheck,
    } as const
  }),
  dependencies: [IIoTPgClientLive],
}) {}

// =============================================================================
// Exports
// =============================================================================

export const TimeSeriesClientLive = TimeSeriesClient.Default

/**
 * Layer for testing - allows providing custom PgClient
 * Usage: TimeSeriesClientTest.pipe(Layer.provide(YourTestPgClient))
 */
export const TimeSeriesClientTest = Layer.effect(
  TimeSeriesClient,
  Effect.gen(function* () {
    // Validates PgClient is available, then returns TimeSeriesClient instance
    yield* PgClient.PgClient
    return yield* TimeSeriesClient
  })
)
