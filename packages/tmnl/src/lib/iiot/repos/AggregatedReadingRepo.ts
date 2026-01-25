/**
 * AggregatedReadingRepo - Repository for Aggregated Readings
 *
 * Composite primary key (bucket, deviceId). Manual repository required.
 * Maps to TimescaleDB continuous aggregate views.
 *
 * Uses decode utilities to ensure Schema transforms are applied
 * on raw SQL results.
 *
 * @module
 */

import { Context, Layer, Effect, Option, Stream, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { DeviceId } from '../schemas/identifiers'
import { TimeBucket } from '../schemas/readings'
import { AggregatedReadingModel } from '../models/readings/AggregatedReadingModel'
import { decodeOptional, decodeRows } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type AggregatedReadingRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface AggregatedReadingRepository {
  readonly queryByDevice: (params: {
    deviceId: DeviceId
    bucket: TimeBucket
    since?: Date
    until?: Date
    limit?: number
  }) => Effect.Effect<readonly AggregatedReadingModel[], AggregatedReadingRepoError>
  readonly streamByDevice: (params: {
    deviceId: DeviceId
    bucket: TimeBucket
    since?: Date
    until?: Date
  }) => Stream.Stream<AggregatedReadingModel, AggregatedReadingRepoError>
  readonly getLatestBucket: (deviceId: DeviceId, bucket: TimeBucket) => Effect.Effect<Option.Option<AggregatedReadingModel>, AggregatedReadingRepoError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class AggregatedReadingRepo extends Context.Tag('iiot/AggregatedReadingRepo')<
  AggregatedReadingRepo,
  AggregatedReadingRepository
>() {}

// =============================================================================
// Repository Implementation (Manual - Composite PK, Read-Only from CAggs)
// =============================================================================

export const AggregatedReadingRepoLive = Layer.effect(
  AggregatedReadingRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const queryByDevice = (params: {
      deviceId: DeviceId
      bucket: TimeBucket
      since?: Date
      until?: Date
      limit?: number
    }) =>
      Effect.gen(function* () {
        // Note: View name is determined by bucket, but we use parameterized query
        // In production, use separate methods or dynamic SQL safely
        const rows = yield* sql`
          SELECT
            bucket,
            device_id AS "deviceId",
            avg_value AS "avgValue",
            min_value AS "minValue",
            max_value AS "maxValue",
            stddev_value AS "stddevValue",
            sample_count AS "sampleCount"
          FROM iiot.sensor_readings_agg
          WHERE device_id = ${params.deviceId}
            AND bucket_interval = ${params.bucket}
            AND (${params.since ?? null}::timestamp IS NULL OR bucket >= ${params.since ?? null})
            AND (${params.until ?? null}::timestamp IS NULL OR bucket <= ${params.until ?? null})
          ORDER BY bucket DESC
          LIMIT ${params.limit ?? 1000}
        `
        return yield* decodeRows(AggregatedReadingModel)(rows)
      })

    const streamByDevice = (params: {
      deviceId: DeviceId
      bucket: TimeBucket
      since?: Date
      until?: Date
    }) =>
      Stream.fromEffect(
        Effect.gen(function* () {
          const rows = yield* sql`
            SELECT
              bucket,
              device_id AS "deviceId",
              avg_value AS "avgValue",
              min_value AS "minValue",
              max_value AS "maxValue",
              stddev_value AS "stddevValue",
              sample_count AS "sampleCount"
            FROM iiot.sensor_readings_agg
            WHERE device_id = ${params.deviceId}
              AND bucket_interval = ${params.bucket}
              AND (${params.since ?? null}::timestamp IS NULL OR bucket >= ${params.since ?? null})
              AND (${params.until ?? null}::timestamp IS NULL OR bucket <= ${params.until ?? null})
            ORDER BY bucket DESC
          `
          return yield* decodeRows(AggregatedReadingModel)(rows)
        })
      ).pipe(Stream.flatMap(Stream.fromIterable))

    const getLatestBucket = (deviceId: DeviceId, bucket: TimeBucket) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            bucket,
            device_id AS "deviceId",
            avg_value AS "avgValue",
            min_value AS "minValue",
            max_value AS "maxValue",
            stddev_value AS "stddevValue",
            sample_count AS "sampleCount"
          FROM iiot.sensor_readings_agg
          WHERE device_id = ${deviceId}
            AND bucket_interval = ${bucket}
          ORDER BY bucket DESC
          LIMIT 1
        `
        return yield* decodeOptional(AggregatedReadingModel)(rows)
      })

    return {
      queryByDevice,
      streamByDevice,
      getLatestBucket,
    } satisfies AggregatedReadingRepository
  })
)
