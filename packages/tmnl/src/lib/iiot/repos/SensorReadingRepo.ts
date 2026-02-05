/**
 * SensorReadingRepo - Repository for Sensor Readings
 *
 * Composite primary key (time, deviceId). Manual repository required.
 * Maps to TimescaleDB hypertable: iiot.sensor_readings
 *
 * Uses decode utilities to ensure Schema transforms are applied
 * on raw SQL results.
 *
 * @module
 */

import { Context, Layer, Effect, Option, Stream, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { DeviceId } from '../schemas/identifiers'
import { SensorReadingModel } from '../models/readings/SensorReadingModel'
import { decodeOptional, decodeRows } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type SensorReadingRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface SensorReadingRepository {
  readonly insert: (reading: typeof SensorReadingModel.insert.Type) => Effect.Effect<void, SqlError.SqlError>
  readonly insertBatch: (readings: readonly (typeof SensorReadingModel.insert.Type)[]) => Effect.Effect<void, SqlError.SqlError>
  readonly findByKey: (time: Date, deviceId: DeviceId) => Effect.Effect<Option.Option<SensorReadingModel>, SensorReadingRepoError>
  readonly getLatest: (deviceId: DeviceId) => Effect.Effect<Option.Option<SensorReadingModel>, SensorReadingRepoError>
  readonly queryByDevice: (params: {
    deviceId: DeviceId
    since?: Date
    until?: Date
    limit?: number
  }) => Effect.Effect<readonly SensorReadingModel[], SensorReadingRepoError>
  readonly streamByDevice: (params: {
    deviceId: DeviceId
    since?: Date
    until?: Date
  }) => Stream.Stream<SensorReadingModel, SensorReadingRepoError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class SensorReadingRepo extends Context.Tag('iiot/SensorReadingRepo')<
  SensorReadingRepo,
  SensorReadingRepository
>() {}

// =============================================================================
// Repository Implementation (Manual - Composite PK)
// =============================================================================

export const SensorReadingRepoLive = Layer.effect(
  SensorReadingRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const insert = (reading: typeof SensorReadingModel.insert.Type) =>
      sql`
        INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
        VALUES (${reading.time}, ${reading.deviceId}, ${reading.value}, ${reading.quality})
        ON CONFLICT (time, device_id) DO UPDATE SET
          value = EXCLUDED.value,
          quality = EXCLUDED.quality
      `.pipe(Effect.asVoid)

    const insertBatch = (readings: readonly (typeof SensorReadingModel.insert.Type)[]) =>
      Effect.gen(function* () {
        if (readings.length === 0) return
        // Use unnest for efficient batch insert
        const times = readings.map(r => r.time)
        const deviceIds = readings.map(r => r.deviceId)
        const values = readings.map(r => r.value)
        const qualities = readings.map(r => r.quality)

        yield* sql`
          INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
          SELECT * FROM UNNEST(
            ${times}::timestamptz[],
            ${deviceIds}::text[],
            ${values}::double precision[],
            ${qualities}::integer[]
          )
          ON CONFLICT (time, device_id) DO UPDATE SET
            value = EXCLUDED.value,
            quality = EXCLUDED.quality
        `
      }).pipe(Effect.asVoid)

    const findByKey = (time: Date, deviceId: DeviceId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            time,
            device_id AS "deviceId",
            value,
            quality
          FROM iiot.sensor_readings
          WHERE time = ${time} AND device_id = ${deviceId}
          LIMIT 1
        `
        return yield* decodeOptional(SensorReadingModel)(rows)
      })

    const getLatest = (deviceId: DeviceId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            time,
            device_id AS "deviceId",
            value,
            quality
          FROM iiot.sensor_readings
          WHERE device_id = ${deviceId}
          ORDER BY time DESC
          LIMIT 1
        `
        return yield* decodeOptional(SensorReadingModel)(rows)
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
            time,
            device_id AS "deviceId",
            value,
            quality
          FROM iiot.sensor_readings
          WHERE device_id = ${params.deviceId}
            AND (${params.since ?? null}::timestamptz IS NULL OR time >= ${params.since ?? null}::timestamptz)
            AND (${params.until ?? null}::timestamptz IS NULL OR time <= ${params.until ?? null}::timestamptz)
          ORDER BY time DESC
          LIMIT ${params.limit ?? 1000}
        `
        return yield* decodeRows(SensorReadingModel)(rows)
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
              time,
              device_id AS "deviceId",
              value,
              quality
            FROM iiot.sensor_readings
            WHERE device_id = ${params.deviceId}
              AND (${params.since ?? null}::timestamp IS NULL OR time >= ${params.since ?? null})
              AND (${params.until ?? null}::timestamp IS NULL OR time <= ${params.until ?? null})
            ORDER BY time DESC
          `
          return yield* decodeRows(SensorReadingModel)(rows)
        })
      ).pipe(Stream.flatMap(Stream.fromIterable))

    return {
      insert,
      insertBatch,
      findByKey,
      getLatest,
      queryByDevice,
      streamByDevice,
    } satisfies SensorReadingRepository
  })
)
