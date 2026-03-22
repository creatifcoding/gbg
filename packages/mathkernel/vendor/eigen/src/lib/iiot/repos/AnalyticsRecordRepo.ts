/**
 * AnalyticsRecordRepo - Repository for Historical Analytics
 *
 * Composite primary key (hour, deviceId). Manual repository required.
 * Maps to pg_mooncake columnstore: iiot.sensor_analytics
 *
 * Uses decode utilities to ensure FieldOption transforms are applied
 * (null → Option.none()) on raw SQL results.
 *
 * AnalyticsRecordModel has FieldOption field:
 * - stddev
 *
 * @module
 */

import { Context, Layer, Effect, Option, Stream, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { DeviceId } from '../schemas/identifiers'
import { AnalyticsRecordModel } from '../models/readings/AnalyticsRecordModel'
import { decodeOptional, decodeRows } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type AnalyticsRecordRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface AnalyticsRecordRepository {
  readonly insert: (record: typeof AnalyticsRecordModel.insert.Type) => Effect.Effect<void, SqlError.SqlError>
  readonly insertBatch: (records: readonly (typeof AnalyticsRecordModel.insert.Type)[]) => Effect.Effect<void, SqlError.SqlError>
  readonly findByKey: (hour: Date, deviceId: DeviceId) => Effect.Effect<Option.Option<AnalyticsRecordModel>, AnalyticsRecordRepoError>
  readonly queryByDevice: (params: {
    deviceId: DeviceId
    since?: Date
    until?: Date
    limit?: number
  }) => Effect.Effect<readonly AnalyticsRecordModel[], AnalyticsRecordRepoError>
  readonly streamByDevice: (params: {
    deviceId: DeviceId
    since?: Date
    until?: Date
  }) => Stream.Stream<AnalyticsRecordModel, AnalyticsRecordRepoError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class AnalyticsRecordRepo extends Context.Tag('iiot/AnalyticsRecordRepo')<
  AnalyticsRecordRepo,
  AnalyticsRecordRepository
>() {}

// =============================================================================
// Repository Implementation (Manual - Composite PK)
// =============================================================================

export const AnalyticsRecordRepoLive = Layer.effect(
  AnalyticsRecordRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const insert = (record: typeof AnalyticsRecordModel.insert.Type) =>
      sql`
        INSERT INTO iiot.sensor_analytics (hour, device_id, avg_value, min_value, max_value, stddev, sample_count)
        VALUES (
          ${record.hour},
          ${record.deviceId},
          ${record.avgValue},
          ${record.minValue},
          ${record.maxValue},
          ${record.stddev ?? null},
          ${record.sampleCount}
        )
        ON CONFLICT (hour, device_id) DO UPDATE SET
          avg_value = EXCLUDED.avg_value,
          min_value = EXCLUDED.min_value,
          max_value = EXCLUDED.max_value,
          stddev = EXCLUDED.stddev,
          sample_count = EXCLUDED.sample_count
      `.pipe(Effect.asVoid)

    const insertBatch = (records: readonly (typeof AnalyticsRecordModel.insert.Type)[]) =>
      Effect.gen(function* () {
        if (records.length === 0) return
        const hours = records.map(r => r.hour)
        const deviceIds = records.map(r => r.deviceId)
        const avgValues = records.map(r => r.avgValue)
        const minValues = records.map(r => r.minValue)
        const maxValues = records.map(r => r.maxValue)
        const stddevs = records.map(r => r.stddev ?? null)
        const sampleCounts = records.map(r => r.sampleCount)

        yield* sql`
          INSERT INTO iiot.sensor_analytics (hour, device_id, avg_value, min_value, max_value, stddev, sample_count)
          SELECT * FROM UNNEST(
            ${hours}::timestamp[],
            ${deviceIds}::text[],
            ${avgValues}::double precision[],
            ${minValues}::double precision[],
            ${maxValues}::double precision[],
            ${stddevs}::double precision[],
            ${sampleCounts}::integer[]
          )
          ON CONFLICT (hour, device_id) DO UPDATE SET
            avg_value = EXCLUDED.avg_value,
            min_value = EXCLUDED.min_value,
            max_value = EXCLUDED.max_value,
            stddev = EXCLUDED.stddev,
            sample_count = EXCLUDED.sample_count
        `
      }).pipe(Effect.asVoid)

    const findByKey = (hour: Date, deviceId: DeviceId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            hour,
            device_id AS "deviceId",
            avg_value AS "avgValue",
            min_value AS "minValue",
            max_value AS "maxValue",
            stddev,
            sample_count AS "sampleCount"
          FROM iiot.sensor_analytics
          WHERE hour = ${hour} AND device_id = ${deviceId}
          LIMIT 1
        `
        return yield* decodeOptional(AnalyticsRecordModel)(rows)
      })

    const queryByDevice = (params: {
      deviceId: DeviceId
      since?: Date
      until?: Date
      limit?: number
    }) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            hour,
            device_id AS "deviceId",
            avg_value AS "avgValue",
            min_value AS "minValue",
            max_value AS "maxValue",
            stddev,
            sample_count AS "sampleCount"
          FROM iiot.sensor_analytics
          WHERE device_id = ${params.deviceId}
            AND (${params.since ?? null}::timestamp IS NULL OR hour >= ${params.since ?? null})
            AND (${params.until ?? null}::timestamp IS NULL OR hour <= ${params.until ?? null})
          ORDER BY hour DESC
          LIMIT ${params.limit ?? 1000}
        `
        return yield* decodeRows(AnalyticsRecordModel)(rows)
      })

    const streamByDevice = (params: {
      deviceId: DeviceId
      since?: Date
      until?: Date
    }) =>
      Stream.fromEffect(
        Effect.gen(function* () {
          const rows = yield* sql`
            SELECT
              hour,
              device_id AS "deviceId",
              avg_value AS "avgValue",
              min_value AS "minValue",
              max_value AS "maxValue",
              stddev,
              sample_count AS "sampleCount"
            FROM iiot.sensor_analytics
            WHERE device_id = ${params.deviceId}
              AND (${params.since ?? null}::timestamp IS NULL OR hour >= ${params.since ?? null})
              AND (${params.until ?? null}::timestamp IS NULL OR hour <= ${params.until ?? null})
            ORDER BY hour DESC
          `
          return yield* decodeRows(AnalyticsRecordModel)(rows)
        })
      ).pipe(Stream.flatMap(Stream.fromIterable))

    return {
      insert,
      insertBatch,
      findByKey,
      queryByDevice,
      streamByDevice,
    } satisfies AnalyticsRecordRepository
  })
)
