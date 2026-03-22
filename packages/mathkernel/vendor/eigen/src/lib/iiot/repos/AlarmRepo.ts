/**
 * AlarmRepo - Repository for Alarm Entity
 *
 * Separated from AlarmModel for clean architecture.
 * Model defines schema, Repo handles persistence.
 *
 * Uses decode utilities to ensure FieldOption transforms are applied
 * (null → Option.none()) on raw SQL results.
 *
 * AlarmModel has many FieldOption fields:
 * - message, acknowledgedAt, clearedAt, acknowledgedBy, metadata
 *
 * @module
 */

import { Schema, Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { AlarmId, DeviceId } from '../schemas/identifiers'
import { AlarmSeverity } from '../schemas/alarms'
import { AlarmModel } from '../models/alarms/AlarmModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// =============================================================================
// Error Types
// =============================================================================

export type AlarmRepoError = SqlError.SqlError | ParseResult.ParseError

// =============================================================================
// Repository Interface
// =============================================================================

export interface AlarmRepository {
  readonly findById: (id: AlarmId) => Effect.Effect<Option.Option<AlarmModel>, AlarmRepoError>
  readonly findByDevice: (deviceId: DeviceId) => Effect.Effect<readonly AlarmModel[], AlarmRepoError>
  readonly findOpen: () => Effect.Effect<readonly AlarmModel[], AlarmRepoError>
  readonly findAll: () => Effect.Effect<readonly AlarmModel[], AlarmRepoError>
  readonly query: (params: {
    deviceId?: DeviceId
    severity?: Schema.Schema.Type<typeof AlarmSeverity>
    onlyOpen?: boolean
    since?: Date
    limit?: number
  }) => Effect.Effect<readonly AlarmModel[], AlarmRepoError>
  readonly insert: (alarm: typeof AlarmModel.insert.Type) => Effect.Effect<AlarmModel, AlarmRepoError>
  readonly update: (alarm: Partial<typeof AlarmModel.update.Type> & { id: typeof AlarmModel.update.Type['id'] }) => Effect.Effect<AlarmModel, AlarmRepoError>
  readonly acknowledge: (id: AlarmId, acknowledgedBy: string) => Effect.Effect<AlarmModel, AlarmRepoError>
  readonly clear: (id: AlarmId) => Effect.Effect<AlarmModel, AlarmRepoError>
  readonly delete: (id: AlarmId) => Effect.Effect<void, SqlError.SqlError>
}

// =============================================================================
// Repository Tag
// =============================================================================

export class AlarmRepo extends Context.Tag('iiot/AlarmRepo')<
  AlarmRepo,
  AlarmRepository
>() {}

// =============================================================================
// Repository Implementation
// =============================================================================

export const AlarmRepoLive = Layer.effect(
  AlarmRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findById = (id: AlarmId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            device_id AS "deviceId",
            alarm_type AS "alarmType",
            severity,
            message,
            triggered_at AS "triggeredAt",
            acknowledged_at AS "acknowledgedAt",
            cleared_at AS "clearedAt",
            acknowledged_by AS "acknowledgedBy",
            metadata
          FROM iiot.alarms
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(AlarmModel)(rows)
      })

    const findByDevice = (deviceId: DeviceId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            device_id AS "deviceId",
            alarm_type AS "alarmType",
            severity,
            message,
            triggered_at AS "triggeredAt",
            acknowledged_at AS "acknowledgedAt",
            cleared_at AS "clearedAt",
            acknowledged_by AS "acknowledgedBy",
            metadata
          FROM iiot.alarms
          WHERE device_id = ${deviceId}
          ORDER BY triggered_at DESC
        `
        return yield* decodeRows(AlarmModel)(rows)
      })

    const findOpen = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            device_id AS "deviceId",
            alarm_type AS "alarmType",
            severity,
            message,
            triggered_at AS "triggeredAt",
            acknowledged_at AS "acknowledgedAt",
            cleared_at AS "clearedAt",
            acknowledged_by AS "acknowledgedBy",
            metadata
          FROM iiot.alarms
          WHERE cleared_at IS NULL
          ORDER BY triggered_at DESC
        `
        return yield* decodeRows(AlarmModel)(rows)
      })

    const findAll = () =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            device_id AS "deviceId",
            alarm_type AS "alarmType",
            severity,
            message,
            triggered_at AS "triggeredAt",
            acknowledged_at AS "acknowledgedAt",
            cleared_at AS "clearedAt",
            acknowledged_by AS "acknowledgedBy",
            metadata
          FROM iiot.alarms
          ORDER BY triggered_at DESC
        `
        return yield* decodeRows(AlarmModel)(rows)
      })

    const query = (params: {
      deviceId?: DeviceId
      severity?: Schema.Schema.Type<typeof AlarmSeverity>
      onlyOpen?: boolean
      since?: Date
      limit?: number
    }) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            device_id AS "deviceId",
            alarm_type AS "alarmType",
            severity,
            message,
            triggered_at AS "triggeredAt",
            acknowledged_at AS "acknowledgedAt",
            cleared_at AS "clearedAt",
            acknowledged_by AS "acknowledgedBy",
            metadata
          FROM iiot.alarms
          WHERE 1=1
            AND (${params.deviceId ?? null}::text IS NULL OR device_id = ${params.deviceId ?? null})
            AND (${params.severity ?? null}::text IS NULL OR severity = ${params.severity ?? null})
            AND (${params.onlyOpen ?? false} = false OR cleared_at IS NULL)
            AND (${params.since ?? null}::timestamp IS NULL OR triggered_at >= ${params.since ?? null})
          ORDER BY triggered_at DESC
          LIMIT ${params.limit ?? 1000}
        `
        return yield* decodeRows(AlarmModel)(rows)
      })

    const insert = (alarm: typeof AlarmModel.insert.Type) =>
      Effect.gen(function* () {
        // FieldOption fields: use Option.getOrNull to convert Option to null/value
        // NOTE: pg driver handles JSONB objects directly - no JSON.stringify needed
        const messageValue = Option.getOrNull(alarm.message)
        const metadataValue = Option.getOrNull(alarm.metadata)

        const rows = yield* sql`
          INSERT INTO iiot.alarms (device_id, alarm_type, severity, message, metadata)
          VALUES (
            ${alarm.deviceId},
            ${alarm.alarmType},
            ${alarm.severity},
            ${messageValue},
            ${metadataValue}
          )
          RETURNING
            id,
            device_id AS "deviceId",
            alarm_type AS "alarmType",
            severity,
            message,
            triggered_at AS "triggeredAt",
            acknowledged_at AS "acknowledgedAt",
            cleared_at AS "clearedAt",
            acknowledged_by AS "acknowledgedBy",
            metadata
        `
        return yield* decodeFirst(AlarmModel)(rows)
      })

    const update = (alarm: Partial<typeof AlarmModel.update.Type> & { id: typeof AlarmModel.update.Type['id'] }) =>
      Effect.gen(function* () {
        // sql.update() handles partial updates:
        // - undefined fields → skipped (not in SET)
        // - Option.none() → NULL, Option.some(v) → v
        const changes = prepareUpdate(alarm)

        const rows = yield* sql`
          UPDATE iiot.alarms
          SET ${sql.update(changes, ['id'])}
          WHERE id = ${alarm.id}
          RETURNING
            id,
            device_id AS "deviceId",
            alarm_type AS "alarmType",
            severity,
            message,
            triggered_at AS "triggeredAt",
            acknowledged_at AS "acknowledgedAt",
            cleared_at AS "clearedAt",
            acknowledged_by AS "acknowledgedBy",
            metadata
        `
        return yield* decodeFirst(AlarmModel)(rows)
      })

    const acknowledge = (id: AlarmId, acknowledgedBy: string) =>
      Effect.gen(function* () {
        // Try to update - only affects rows not yet acknowledged
        const rows = yield* sql`
          UPDATE iiot.alarms
          SET
            acknowledged_at = NOW(),
            acknowledged_by = ${acknowledgedBy}
          WHERE id = ${id} AND acknowledged_at IS NULL
          RETURNING
            id,
            device_id AS "deviceId",
            alarm_type AS "alarmType",
            severity,
            message,
            triggered_at AS "triggeredAt",
            acknowledged_at AS "acknowledgedAt",
            cleared_at AS "clearedAt",
            acknowledged_by AS "acknowledgedBy",
            metadata
        `
        // If rows returned, decode and return the updated alarm
        if (rows.length > 0) {
          return yield* decodeFirst(AlarmModel)(rows)
        }
        // Idempotent: already acknowledged - return existing alarm
        const existing = yield* findById(id)
        return yield* Option.match(existing, {
          onNone: () => Effect.fail(new SqlError.SqlError({ message: `Alarm not found: ${id}` })),
          onSome: Effect.succeed,
        })
      })

    const clear = (id: AlarmId) =>
      Effect.gen(function* () {
        // Try to update - only affects rows not yet cleared
        const rows = yield* sql`
          UPDATE iiot.alarms
          SET cleared_at = NOW()
          WHERE id = ${id} AND cleared_at IS NULL
          RETURNING
            id,
            device_id AS "deviceId",
            alarm_type AS "alarmType",
            severity,
            message,
            triggered_at AS "triggeredAt",
            acknowledged_at AS "acknowledgedAt",
            cleared_at AS "clearedAt",
            acknowledged_by AS "acknowledgedBy",
            metadata
        `
        // If rows returned, decode and return the updated alarm
        if (rows.length > 0) {
          return yield* decodeFirst(AlarmModel)(rows)
        }
        // Idempotent: already cleared - return existing alarm
        const existing = yield* findById(id)
        return yield* Option.match(existing, {
          onNone: () => Effect.fail(new SqlError.SqlError({ message: `Alarm not found: ${id}` })),
          onSome: Effect.succeed,
        })
      })

    const del = (id: AlarmId) =>
      sql`DELETE FROM iiot.alarms WHERE id = ${id}`.pipe(Effect.asVoid)

    return {
      findById,
      findByDevice,
      findOpen,
      findAll,
      query,
      insert,
      update,
      acknowledge,
      clear,
      delete: del,
    } satisfies AlarmRepository
  })
)
