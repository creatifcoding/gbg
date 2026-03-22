/**
 * AlarmContextRepo - Repository for Alarm Context (Root Cause Analysis)
 *
 * Read-only repository backed by materialized view iiot.alarm_context.
 * Use refresh() to update the view after new alarms are created.
 *
 * Uses decode utilities to ensure Schema transforms are applied
 * on raw SQL results.
 *
 * @module
 */

import { Context, Layer, Effect, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { AlarmId } from '../schemas/identifiers'
import { AlarmContextModel } from '../models/alarms/AlarmContextModel'
import { decodeRows } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type AlarmContextRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface AlarmContextRepository {
  /** Find all context readings for an alarm */
  readonly findByAlarm: (alarmId: AlarmId) => Effect.Effect<readonly AlarmContextModel[], AlarmContextRepoError>

  /** Find context readings within a time window (in seconds) */
  readonly findByAlarmWithWindow: (alarmId: AlarmId, windowSeconds: number) => Effect.Effect<readonly AlarmContextModel[], AlarmContextRepoError>

  /** Refresh the materialized view (call after new alarms created) */
  readonly refresh: () => Effect.Effect<void, SqlError.SqlError>

  /** Refresh concurrently (allows reads during refresh) */
  readonly refreshConcurrently: () => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class AlarmContextRepo extends Context.Tag('iiot/AlarmContextRepo')<
  AlarmContextRepo,
  AlarmContextRepository
>() {}

// =============================================================================
// Repository Implementation (Read-only - Materialized View)
// =============================================================================

export const AlarmContextRepoLive = Layer.effect(
  AlarmContextRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findByAlarm = (alarmId: AlarmId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            alarm_id AS "alarmId",
            device_id AS "deviceId",
            reading_time AS "readingTime",
            value,
            quality,
            offset_seconds AS "offsetSeconds"
          FROM iiot.alarm_context
          WHERE alarm_id = ${alarmId}
          ORDER BY reading_time ASC
        `
        return yield* decodeRows(AlarmContextModel)(rows)
      })

    const findByAlarmWithWindow = (alarmId: AlarmId, windowSeconds: number) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            alarm_id AS "alarmId",
            device_id AS "deviceId",
            reading_time AS "readingTime",
            value,
            quality,
            offset_seconds AS "offsetSeconds"
          FROM iiot.alarm_context
          WHERE alarm_id = ${alarmId}
            AND ABS(offset_seconds) <= ${windowSeconds}
          ORDER BY reading_time ASC
        `
        return yield* decodeRows(AlarmContextModel)(rows)
      })

    const refresh = () =>
      sql.unsafe(`REFRESH MATERIALIZED VIEW iiot.alarm_context`).pipe(Effect.asVoid)

    const refreshConcurrently = () =>
      sql.unsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY iiot.alarm_context`).pipe(Effect.asVoid)

    return {
      findByAlarm,
      findByAlarmWithWindow,
      refresh,
      refreshConcurrently,
    } satisfies AlarmContextRepository
  })
)
