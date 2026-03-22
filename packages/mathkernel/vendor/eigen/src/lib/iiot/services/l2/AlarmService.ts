/**
 * AlarmService - L2 Domain Service for Alarm Management
 *
 * Business logic for alarms:
 * - Alarm creation and lifecycle (persisted to iiot.alarms table)
 * - Acknowledgement and clearing
 * - Root cause analysis context
 * - Event emission to EventLog (when ES_ALARM_ENABLED=true)
 *
 * Database: iiot.alarms table (TimescaleDB)
 * Graph sync: Automatic via alarm_graph_sync trigger
 * Event sourcing: Optional via ES_ALARM_ENABLED feature flag (EL-2.14-17)
 *
 * @module
 * @see WBS EL-2.14-17 for alarm event emission requirements
 * @see ADR-0012 for ES boundaries (alarms ARE event sourced)
 */

import { Effect, Stream, Chunk, DateTime, Schema, ParseResult } from 'effect'
import { PgClient } from '@effect/sql-pg'
import * as EventLog from '@effect/experimental/EventLog'
import { AlarmId, DeviceId } from '../../schemas/identifiers'
import {
  Alarm,
  AlarmSeverity,
  AlarmState,
  AlarmType,
  CreateAlarmParams,
  AlarmContext,
} from '../../schemas/alarms'
import {
  AlarmNotFoundError,
  AlarmAlreadyAcknowledgedError,
  AlarmAlreadyClearedError,
  IIoTQueryError,
} from '../../schemas/errors'
import { TimeSeriesClient } from '../l1/TimeSeriesClient'
import { IIoTPgClientLive } from '../l1/IIoTPgClient'
import {
  emitAlarmTriggered,
  emitAlarmAcknowledged,
  emitAlarmCleared,
} from './alarm-event-emitter'
import { IIoTFeatureFlags, IIoTFeatureFlagsDisabledLayer } from '../../infrastructure/feature-flags'

// =============================================================================
// Error Union
// =============================================================================

export type AlarmServiceError =
  | AlarmNotFoundError
  | AlarmAlreadyAcknowledgedError
  | AlarmAlreadyClearedError
  | IIoTQueryError

// =============================================================================
// Database Row Schema (Schema-backed decode/encode)
// =============================================================================

/**
 * Schema for raw database row from iiot.alarms table.
 * Uses Schema.DateFromSelf for Date objects returned by pg driver.
 */
const AlarmRowSchema = Schema.Struct({
  id: Schema.String,
  deviceId: Schema.String,
  alarmType: Schema.String,
  severity: Schema.String,
  message: Schema.NullOr(Schema.String),
  triggeredAt: Schema.DateFromSelf,
  acknowledgedAt: Schema.NullOr(Schema.DateFromSelf),
  clearedAt: Schema.NullOr(Schema.DateFromSelf),
  acknowledgedBy: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
type AlarmRow = Schema.Schema.Type<typeof AlarmRowSchema>

/**
 * Transform from DB row to domain Alarm.
 *
 * Uses Schema.transformOrFail for validated conversion:
 * - Date → DateTime.Utc via DateTime.unsafeFromDate
 * - null → undefined for optional fields
 * - Branded identifiers via schema decode
 */
/**
 * Derive ISA-18.2 alarm state from database row timestamps.
 *
 * State derivation logic:
 * - clearedAt set → 'cleared'
 * - acknowledgedAt set but not clearedAt → 'acknowledged'
 * - neither set → 'unacknowledged'
 */
const deriveAlarmState = (row: AlarmRow): Schema.Schema.Type<typeof AlarmState> => {
  if (row.clearedAt) return 'cleared' as Schema.Schema.Type<typeof AlarmState>
  if (row.acknowledgedAt) return 'acknowledged' as Schema.Schema.Type<typeof AlarmState>
  return 'unacknowledged' as Schema.Schema.Type<typeof AlarmState>
}

const AlarmFromRow = Schema.transformOrFail(
  AlarmRowSchema,
  Schema.typeSchema(Alarm),
  {
    strict: true,
    decode: (row, _, ast) =>
      ParseResult.try({
        try: () =>
          new Alarm({
            id: row.id as Schema.Schema.Type<typeof AlarmId>,
            deviceId: row.deviceId as Schema.Schema.Type<typeof DeviceId>,
            alarmType: row.alarmType as Schema.Schema.Type<typeof AlarmType>,
            severity: row.severity as Schema.Schema.Type<typeof AlarmSeverity>,
            state: deriveAlarmState(row),
            triggeredAt: DateTime.unsafeFromDate(row.triggeredAt),
            // Type side is T | undefined (not null), so convert null → undefined
            message: row.message ?? undefined,
            acknowledgedAt: row.acknowledgedAt
              ? DateTime.unsafeFromDate(row.acknowledgedAt)
              : undefined,
            clearedAt: row.clearedAt
              ? DateTime.unsafeFromDate(row.clearedAt)
              : undefined,
            acknowledgedBy: row.acknowledgedBy ?? undefined,
            metadata: row.metadata ?? undefined,
          }),
        catch: (e) =>
          new ParseResult.Type(ast, row, `Failed to decode alarm row: ${String(e)}`),
      }),
    encode: (alarm, _, ast) =>
      ParseResult.try({
        try: () => ({
          id: alarm.id,
          deviceId: alarm.deviceId,
          alarmType: alarm.alarmType,
          severity: alarm.severity,
          message: alarm.message ?? null,
          triggeredAt: DateTime.toDate(alarm.triggeredAt),
          acknowledgedAt: alarm.acknowledgedAt
            ? DateTime.toDate(alarm.acknowledgedAt)
            : null,
          clearedAt: alarm.clearedAt ? DateTime.toDate(alarm.clearedAt) : null,
          acknowledgedBy: alarm.acknowledgedBy ?? null,
          metadata: alarm.metadata ?? null,
        }),
        catch: (e) =>
          new ParseResult.Type(ast, alarm, `Failed to encode alarm: ${String(e)}`),
      }),
  }
)

/** Decode a single row - Effect-native */
const decodeRowEffect = Schema.decode(AlarmFromRow)

/**
 * Decode row with error mapping to IIoTQueryError.
 * Used in service operations where ParseError should be IIoTQueryError.
 */
const decodeRow = (row: AlarmRow, operation: string) =>
  decodeRowEffect(row).pipe(
    Effect.mapError(
      (parseError) =>
        new IIoTQueryError({
          operation,
          message: `Failed to decode alarm: ${String(parseError)}`,
        })
    )
  )

/** SQL column list for SELECT - single source of truth */
const ALARM_COLUMNS = `
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
` as const

// =============================================================================
// Service Definition
// =============================================================================

export class AlarmService extends Effect.Service<AlarmService>()('iiot/AlarmService', {
  dependencies: [TimeSeriesClient.Default, IIoTPgClientLive, IIoTFeatureFlagsDisabledLayer],

  effect: Effect.gen(function* () {
    const tsClient = yield* TimeSeriesClient
    const sql = yield* PgClient.PgClient

    // -------------------------------------------------------------------------
    // Alarm CRUD (Database-backed)
    // -------------------------------------------------------------------------

    /**
     * Create a new alarm
     *
     * Inserts into iiot.alarms table. The alarm_graph_sync trigger
     * automatically creates the graph node and relationship.
     */
    const createAlarm = (
      params: CreateAlarmParams
    ): Effect.Effect<Alarm, IIoTQueryError> =>
      Effect.gen(function* () {
        const metadataJson = params.metadata ? JSON.stringify(params.metadata) : null

        const rows = yield* sql<AlarmRow>`
          INSERT INTO iiot.alarms (device_id, alarm_type, severity, message, metadata)
          VALUES (
            ${params.deviceId},
            ${params.alarmType},
            ${params.severity},
            ${params.message ?? null},
            ${metadataJson}::jsonb
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
        `.pipe(
          Effect.catchAll((cause) =>
            Effect.fail(new IIoTQueryError({
              operation: 'createAlarm',
              message: `Failed to create alarm: ${String(cause)}`,
            }))
          )
        )

        if (rows.length === 0) {
          return yield* Effect.fail(new IIoTQueryError({
            operation: 'createAlarm',
            message: 'INSERT returned no rows',
          }))
        }

        const alarm = yield* decodeRow(rows[0], 'createAlarm')
        yield* Effect.logInfo(`Created alarm ${alarm.id} for device ${params.deviceId}`)

        // Emit AlarmTriggered event (conditional on feature flag)
        yield* emitAlarmTriggered({
          alarmId: alarm.id,
          deviceId: alarm.deviceId,
          alarmType: alarm.alarmType,
          severity: alarm.severity,
          triggeredAt: alarm.triggeredAt,
          message: alarm.message,
          metadata: alarm.metadata,
        }).pipe(
          Effect.provide(IIoTFeatureFlagsDisabledLayer),
          Effect.catchAll((err) =>
            Effect.logWarning(`Failed to emit AlarmTriggered event: ${String(err)}`)
          )
        )

        return alarm
      })

    /**
     * Get alarm by ID
     */
    const getAlarm = (alarmId: AlarmId): Effect.Effect<Alarm, AlarmNotFoundError | IIoTQueryError> =>
      Effect.gen(function* () {
        const rows = yield* sql<AlarmRow>`
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
          WHERE id = ${alarmId}
        `.pipe(
          Effect.catchAll((cause) =>
            Effect.fail(new IIoTQueryError({
              operation: 'getAlarm',
              message: `Failed to get alarm: ${String(cause)}`,
            }))
          )
        )

        if (rows.length === 0) {
          return yield* Effect.fail(new AlarmNotFoundError({ alarmId }))
        }

        return yield* decodeRow(rows[0], 'getAlarm')
      })

    /**
     * Get all alarms, optionally filtered
     *
     * Uses parameterized queries with optional filter pattern:
     * (param IS NULL OR column = param) - condition becomes no-op when param is null
     */
    const getAlarms = (params?: {
      deviceId?: DeviceId
      severity?: AlarmSeverity
      onlyOpen?: boolean
    }): Stream.Stream<Alarm, IIoTQueryError> => {
      // Use parameterized optional filters - SQL injection safe
      const deviceIdParam = params?.deviceId ?? null
      const severityParam = params?.severity ?? null
      const onlyOpenParam = params?.onlyOpen ?? false

      return Stream.fromEffect(
        sql<AlarmRow>`
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
          WHERE (${deviceIdParam}::text IS NULL OR device_id = ${deviceIdParam})
            AND (${severityParam}::text IS NULL OR severity = ${severityParam})
            AND (NOT ${onlyOpenParam}::boolean OR cleared_at IS NULL)
          ORDER BY triggered_at DESC
        `.pipe(
          Effect.catchAll((cause) =>
            Effect.fail(new IIoTQueryError({
              operation: 'getAlarms',
              message: `Failed to query alarms: ${String(cause)}`,
            }))
          )
        )
      ).pipe(
        Stream.flatMap(Stream.fromIterable),
        Stream.mapEffect((row) => decodeRow(row, 'getAlarms'))
      )
    }

    /**
     * Acknowledge an alarm
     */
    const acknowledgeAlarm = (
      alarmId: AlarmId,
      acknowledgedBy: string
    ): Effect.Effect<Alarm, AlarmNotFoundError | AlarmAlreadyAcknowledgedError | IIoTQueryError> =>
      Effect.gen(function* () {
        // First check if alarm exists and its current state
        const alarm = yield* getAlarm(alarmId)

        if (alarm.acknowledgedAt) {
          return yield* Effect.fail(new AlarmAlreadyAcknowledgedError({ alarmId }))
        }

        // Update the alarm
        const rows = yield* sql<AlarmRow>`
          UPDATE iiot.alarms
          SET acknowledged_at = NOW(), acknowledged_by = ${acknowledgedBy}
          WHERE id = ${alarmId}
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
        `.pipe(
          Effect.catchAll((cause) =>
            Effect.fail(new IIoTQueryError({
              operation: 'acknowledgeAlarm',
              message: `Failed to acknowledge alarm: ${String(cause)}`,
            }))
          )
        )

        if (rows.length === 0) {
          return yield* Effect.fail(new AlarmNotFoundError({ alarmId }))
        }

        const updated = yield* decodeRow(rows[0], 'acknowledgeAlarm')
        yield* Effect.logInfo(`Alarm ${alarmId} acknowledged by ${acknowledgedBy}`)

        // Emit AlarmAcknowledged event (conditional on feature flag)
        yield* emitAlarmAcknowledged({
          alarmId: updated.id,
          deviceId: updated.deviceId,
          acknowledgedBy,
          acknowledgedAt: updated.acknowledgedAt ?? DateTime.unsafeNow(),
        }).pipe(
          Effect.provide(IIoTFeatureFlagsDisabledLayer),
          Effect.catchAll((err) =>
            Effect.logWarning(`Failed to emit AlarmAcknowledged event: ${String(err)}`)
          )
        )

        return updated
      })

    /**
     * Clear an alarm
     */
    const clearAlarm = (
      alarmId: AlarmId
    ): Effect.Effect<Alarm, AlarmNotFoundError | AlarmAlreadyClearedError | IIoTQueryError> =>
      Effect.gen(function* () {
        // First check if alarm exists and its current state
        const alarm = yield* getAlarm(alarmId)

        if (alarm.clearedAt) {
          return yield* Effect.fail(new AlarmAlreadyClearedError({ alarmId }))
        }

        // Update the alarm
        const rows = yield* sql<AlarmRow>`
          UPDATE iiot.alarms
          SET cleared_at = NOW()
          WHERE id = ${alarmId}
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
        `.pipe(
          Effect.catchAll((cause) =>
            Effect.fail(new IIoTQueryError({
              operation: 'clearAlarm',
              message: `Failed to clear alarm: ${String(cause)}`,
            }))
          )
        )

        if (rows.length === 0) {
          return yield* Effect.fail(new AlarmNotFoundError({ alarmId }))
        }

        const updated = yield* decodeRow(rows[0], 'clearAlarm')
        yield* Effect.logInfo(`Alarm ${alarmId} cleared`)

        // Emit AlarmCleared event (conditional on feature flag)
        yield* emitAlarmCleared({
          alarmId: updated.id,
          deviceId: updated.deviceId,
          clearedAt: updated.clearedAt ?? DateTime.unsafeNow(),
          autoClear: false,
        }).pipe(
          Effect.provide(IIoTFeatureFlagsDisabledLayer),
          Effect.catchAll((err) =>
            Effect.logWarning(`Failed to emit AlarmCleared event: ${String(err)}`)
          )
        )

        return updated
      })

    // -------------------------------------------------------------------------
    // Root Cause Analysis
    // -------------------------------------------------------------------------

    /**
     * Get sensor readings around alarm time for root cause analysis
     */
    const getAlarmContext = (
      alarmId: AlarmId,
      windowMs: number = 5 * 60 * 1000 // 5 minutes
    ): Effect.Effect<AlarmContext[], AlarmNotFoundError | IIoTQueryError> =>
      Effect.gen(function* () {
        const alarm = yield* getAlarm(alarmId)

        // Get readings around alarm time
        const alarmTime = DateTime.toDate(alarm.triggeredAt)
        const since = new Date(alarmTime.getTime() - windowMs)
        const until = new Date(alarmTime.getTime() + windowMs)

        const readings = yield* tsClient
          .queryReadings({
            deviceId: alarm.deviceId,
            since,
            until,
          })
          .pipe(Stream.runCollect)

        return Chunk.toArray(readings).map((reading): AlarmContext => ({
          _tag: 'AlarmContext',
          alarmId,
          deviceId: alarm.deviceId,
          readingTime: reading.time,
          value: reading.value,
          quality: reading.quality,
          offsetSeconds: (DateTime.toDate(reading.time).getTime() - alarmTime.getTime()) / 1000,
        }))
      })

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    /**
     * Get alarm statistics (from database)
     */
    const getStats = (): Effect.Effect<
      {
        total: number
        open: number
        acknowledged: number
        cleared: number
        bySeverity: Record<AlarmSeverity, number>
      },
      IIoTQueryError
    > =>
      Effect.gen(function* () {
        const statsRows = yield* sql<{
          total: string
          open: string
          acknowledged: string
          cleared: string
          info: string
          warning: string
          critical: string
          emergency: string
        }>`
          SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE cleared_at IS NULL)::text AS open,
            COUNT(*) FILTER (WHERE acknowledged_at IS NOT NULL AND cleared_at IS NULL)::text AS acknowledged,
            COUNT(*) FILTER (WHERE cleared_at IS NOT NULL)::text AS cleared,
            COUNT(*) FILTER (WHERE severity = 'info')::text AS info,
            COUNT(*) FILTER (WHERE severity = 'warning')::text AS warning,
            COUNT(*) FILTER (WHERE severity = 'critical')::text AS critical,
            COUNT(*) FILTER (WHERE severity = 'emergency')::text AS emergency
          FROM iiot.alarms
        `.pipe(
          Effect.catchAll((cause) =>
            Effect.fail(new IIoTQueryError({
              operation: 'getStats',
              message: `Failed to get alarm stats: ${String(cause)}`,
            }))
          )
        )

        const row = statsRows[0]
        return {
          total: parseInt(row?.total ?? '0', 10),
          open: parseInt(row?.open ?? '0', 10),
          acknowledged: parseInt(row?.acknowledged ?? '0', 10),
          cleared: parseInt(row?.cleared ?? '0', 10),
          bySeverity: {
            info: parseInt(row?.info ?? '0', 10),
            warning: parseInt(row?.warning ?? '0', 10),
            critical: parseInt(row?.critical ?? '0', 10),
            emergency: parseInt(row?.emergency ?? '0', 10),
          },
        }
      })

    // -------------------------------------------------------------------------
    // Service API
    // -------------------------------------------------------------------------

    return {
      // CRUD
      createAlarm,
      getAlarm,
      getAlarms,
      acknowledgeAlarm,
      clearAlarm,

      // Root cause analysis
      getAlarmContext,

      // Statistics
      getStats,
    } as const
  }),
}) {}

// =============================================================================
// Exports
// =============================================================================

export const AlarmServiceLive = AlarmService.Default
