/**
 * AlarmService - L2 Domain Service for Alarm Management
 *
 * Business logic for alarms:
 * - Alarm creation and lifecycle
 * - Acknowledgement and clearing
 * - Root cause analysis context
 *
 * @module
 */

import { Effect, Stream, Chunk } from 'effect'
import type { AlarmId, DeviceId } from '../../schemas/identifiers'
import type {
  Alarm,
  AlarmSeverity,
  CreateAlarmParams,
  AlarmContext,
} from '../../schemas/alarms'
import {
  AlarmNotFoundError,
  AlarmAlreadyAcknowledgedError,
  AlarmAlreadyClearedError,
  IIoTQueryError,
  GraphQueryError,
} from '../../schemas/errors'
import { TimeSeriesClient } from '../l1/TimeSeriesClient'
import { GraphClient } from '../l1/GraphClient'

// =============================================================================
// Error Union
// =============================================================================

export type AlarmServiceError =
  | AlarmNotFoundError
  | AlarmAlreadyAcknowledgedError
  | AlarmAlreadyClearedError
  | IIoTQueryError
  | GraphQueryError

// =============================================================================
// In-Memory Storage (would be PostgreSQL in production)
// =============================================================================

const alarmStore = new Map<AlarmId, Alarm>()
let alarmCounter = 0

// =============================================================================
// Service Definition
// =============================================================================

export class AlarmService extends Effect.Service<AlarmService>()('iiot/AlarmService', {
  dependencies: [TimeSeriesClient.Default, GraphClient.Default],

  effect: Effect.gen(function* () {
    const tsClient = yield* TimeSeriesClient
    const graphClient = yield* GraphClient

    // -------------------------------------------------------------------------
    // Alarm CRUD
    // -------------------------------------------------------------------------

    /**
     * Create a new alarm
     */
    const createAlarm = (
      params: CreateAlarmParams
    ): Effect.Effect<Alarm, IIoTQueryError | GraphQueryError> =>
      Effect.gen(function* () {
        const id = `ALM-${++alarmCounter}` as AlarmId

        const alarm: Alarm = {
          _tag: 'Alarm',
          id,
          deviceId: params.deviceId,
          alarmType: params.alarmType,
          severity: params.severity,
          message: params.message,
          triggeredAt: new Date().toISOString() as any,
          metadata: params.metadata,
        }

        // Store alarm
        alarmStore.set(id, alarm)

        // Link to sensor in graph
        yield* graphClient.linkAlarmToSensor(id, params.deviceId)

        yield* Effect.logInfo(`Created alarm ${id} for device ${params.deviceId}`)

        return alarm
      })

    /**
     * Get alarm by ID
     */
    const getAlarm = (alarmId: AlarmId): Effect.Effect<Alarm, AlarmNotFoundError> =>
      Effect.gen(function* () {
        const alarm = alarmStore.get(alarmId)
        if (!alarm) {
          return yield* Effect.fail(new AlarmNotFoundError({ alarmId }))
        }
        return alarm
      })

    /**
     * Get all alarms, optionally filtered
     */
    const getAlarms = (params?: {
      deviceId?: DeviceId
      severity?: AlarmSeverity
      onlyOpen?: boolean
    }): Stream.Stream<Alarm, never> =>
      Stream.fromIterable(Array.from(alarmStore.values())).pipe(
        Stream.filter((alarm) => {
          if (params?.deviceId && alarm.deviceId !== params.deviceId) return false
          if (params?.severity && alarm.severity !== params.severity) return false
          if (params?.onlyOpen && alarm.clearedAt) return false
          return true
        })
      )

    /**
     * Acknowledge an alarm
     */
    const acknowledgeAlarm = (
      alarmId: AlarmId,
      acknowledgedBy: string
    ): Effect.Effect<Alarm, AlarmNotFoundError | AlarmAlreadyAcknowledgedError> =>
      Effect.gen(function* () {
        const alarm = yield* getAlarm(alarmId)

        if (alarm.acknowledgedAt) {
          return yield* Effect.fail(new AlarmAlreadyAcknowledgedError({ alarmId }))
        }

        const updated: Alarm = {
          ...alarm,
          acknowledgedAt: new Date().toISOString() as any,
          acknowledgedBy,
        }

        alarmStore.set(alarmId, updated)
        yield* Effect.logInfo(`Alarm ${alarmId} acknowledged by ${acknowledgedBy}`)

        return updated
      })

    /**
     * Clear an alarm
     */
    const clearAlarm = (
      alarmId: AlarmId
    ): Effect.Effect<Alarm, AlarmNotFoundError | AlarmAlreadyClearedError> =>
      Effect.gen(function* () {
        const alarm = yield* getAlarm(alarmId)

        if (alarm.clearedAt) {
          return yield* Effect.fail(new AlarmAlreadyClearedError({ alarmId }))
        }

        const updated: Alarm = {
          ...alarm,
          clearedAt: new Date().toISOString() as any,
        }

        alarmStore.set(alarmId, updated)
        yield* Effect.logInfo(`Alarm ${alarmId} cleared`)

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
        const alarmTime = new Date(alarm.triggeredAt as unknown as string)
        const since = new Date(alarmTime.getTime() - windowMs)
        const until = new Date(alarmTime.getTime() + windowMs)

        const readings = yield* tsClient
          .queryReadings({
            deviceId: alarm.deviceId,
            since,
            until,
          })
          .pipe(Stream.runCollect)

        return Chunk.toArray(readings).map((reading) => ({
          alarmId,
          deviceId: alarm.deviceId,
          readingTime: reading.time,
          value: reading.value,
          offsetFromAlarm: `${((new Date(reading.time as unknown as string).getTime() - alarmTime.getTime()) / 1000).toFixed(0)}s`,
        }))
      })

    // -------------------------------------------------------------------------
    // Statistics
    // -------------------------------------------------------------------------

    /**
     * Get alarm statistics
     */
    const getStats = (): Effect.Effect<
      {
        total: number
        open: number
        acknowledged: number
        cleared: number
        bySeverity: Record<AlarmSeverity, number>
      },
      never
    > =>
      Effect.sync(() => {
        const alarms = Array.from(alarmStore.values())
        return {
          total: alarms.length,
          open: alarms.filter((a) => !a.clearedAt).length,
          acknowledged: alarms.filter((a) => a.acknowledgedAt && !a.clearedAt).length,
          cleared: alarms.filter((a) => a.clearedAt).length,
          bySeverity: {
            info: alarms.filter((a) => a.severity === 'info').length,
            warning: alarms.filter((a) => a.severity === 'warning').length,
            critical: alarms.filter((a) => a.severity === 'critical').length,
            emergency: alarms.filter((a) => a.severity === 'emergency').length,
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
