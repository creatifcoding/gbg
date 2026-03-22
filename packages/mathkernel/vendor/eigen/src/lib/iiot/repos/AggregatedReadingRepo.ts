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

// Map bucket type to view name
const bucketToView = (bucket: TimeBucket): string => {
  switch (bucket) {
    case '1min': return 'iiot.readings_1min'
    case '1hour': return 'iiot.readings_1hour'
    case '1day': return 'iiot.readings_1day'
  }
}

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
        // Query the appropriate continuous aggregate view based on bucket
        const viewName = bucketToView(params.bucket)
        const rows = yield* sql.unsafe(`
          SELECT
            bucket,
            device_id AS "deviceId",
            avg_value AS "avgValue",
            min_value AS "minValue",
            max_value AS "maxValue",
            stddev_value AS "stddevValue",
            sample_count AS "sampleCount"
          FROM ${viewName}
          WHERE device_id = $1
            AND ($2::timestamptz IS NULL OR bucket >= $2::timestamptz)
            AND ($3::timestamptz IS NULL OR bucket <= $3::timestamptz)
          ORDER BY bucket DESC
          LIMIT $4
        `, [params.deviceId, params.since ?? null, params.until ?? null, params.limit ?? 1000])
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
          const viewName = bucketToView(params.bucket)
          const rows = yield* sql.unsafe(`
            SELECT
              bucket,
              device_id AS "deviceId",
              avg_value AS "avgValue",
              min_value AS "minValue",
              max_value AS "maxValue",
              stddev_value AS "stddevValue",
              sample_count AS "sampleCount"
            FROM ${viewName}
            WHERE device_id = $1
              AND ($2::timestamptz IS NULL OR bucket >= $2::timestamptz)
              AND ($3::timestamptz IS NULL OR bucket <= $3::timestamptz)
            ORDER BY bucket DESC
          `, [params.deviceId, params.since ?? null, params.until ?? null])
          return yield* decodeRows(AggregatedReadingModel)(rows)
        })
      ).pipe(Stream.flatMap(Stream.fromIterable))

    const getLatestBucket = (deviceId: DeviceId, bucket: TimeBucket) =>
      Effect.gen(function* () {
        const viewName = bucketToView(bucket)
        const rows = yield* sql.unsafe(`
          SELECT
            bucket,
            device_id AS "deviceId",
            avg_value AS "avgValue",
            min_value AS "minValue",
            max_value AS "maxValue",
            stddev_value AS "stddevValue",
            sample_count AS "sampleCount"
          FROM ${viewName}
          WHERE device_id = $1
          ORDER BY bucket DESC
          LIMIT 1
        `, [deviceId])
        return yield* decodeOptional(AggregatedReadingModel)(rows)
      })

    return {
      queryByDevice,
      streamByDevice,
      getLatestBucket,
    } satisfies AggregatedReadingRepository
  })
)
