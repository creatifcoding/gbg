/**
 * AlarmEntity - Effect Cluster Entity for Alarm Lifecycle
 *
 * Replaces the module-level Map<AlarmId, Alarm> antipattern with
 * proper entity state management using Effect.Ref.
 *
 * Entity Lifecycle:
 * - Create: Initialize alarm with entity-scoped Ref
 * - Get: Read current alarm state
 * - Acknowledge: Operator acknowledges alarm (with timestamp)
 * - Clear: Alarm condition resolved (with timestamp)
 *
 * Per DeepWiki research, entity state is managed via Effect.Ref
 * inside handlers, with MessageStorage providing durability.
 *
 * @module
 */

import { Schema, Effect, Ref, DateTime, Option } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import {
  AlarmId,
  Alarm,
  CreateAlarmParams,
  AcknowledgeAlarmParams,
} from '../schemas'
import {
  RpcAlarmNotFoundError,
  RpcAlarmAlreadyAcknowledgedError,
  RpcAlarmAlreadyClearedError,
  RpcQueryError,
} from '../rpc/errors'
import {
  AlarmEntityType,
  AlarmCreateTag,
  AlarmGetTag,
  AlarmAcknowledgeTag,
  AlarmClearTag,
} from '../tags'

// =============================================================================
// RPC Definitions
// =============================================================================

/**
 * Create a new alarm
 *
 * primaryKey routes to a specific entity instance keyed by deviceId + timestamp.
 * This ensures each alarm gets its own entity.
 */
export class CreateAlarmRpc extends Rpc.make(AlarmCreateTag, {
  payload: CreateAlarmParams,
  success: Alarm,
  error: RpcQueryError,
}) {}

/**
 * Get alarm by ID
 */
export class GetAlarmRpc extends Rpc.make(AlarmGetTag, {
  payload: Schema.Struct({
    alarmId: AlarmId,
  }),
  success: Alarm,
  error: RpcAlarmNotFoundError,
}) {}

/**
 * Acknowledge an alarm
 */
export class AcknowledgeAlarmRpc extends Rpc.make(AlarmAcknowledgeTag, {
  payload: AcknowledgeAlarmParams,
  success: Alarm,
  error: Schema.Union(RpcAlarmNotFoundError, RpcAlarmAlreadyAcknowledgedError),
}) {}

/**
 * Clear an alarm
 */
export class ClearAlarmRpc extends Rpc.make(AlarmClearTag, {
  payload: Schema.Struct({
    alarmId: AlarmId,
  }),
  success: Alarm,
  error: Schema.Union(RpcAlarmNotFoundError, RpcAlarmAlreadyClearedError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * Alarm Entity
 *
 * Distributed actor managing alarm lifecycle state.
 * Each alarm instance is keyed by alarmId and maintains
 * entity-scoped state via Effect.Ref.
 *
 * Sharding: Alarms are distributed across cluster nodes
 * by consistent hashing of alarmId.
 */
export const AlarmEntity = Entity.make(AlarmEntityType, [
  CreateAlarmRpc,
  GetAlarmRpc,
  AcknowledgeAlarmRpc,
  ClearAlarmRpc,
])

/**
 * Type helper for Alarm Entity
 */
export type AlarmEntity = typeof AlarmEntity

// =============================================================================
// Handler Implementation
// =============================================================================

let alarmCounter = 0

/**
 * AlarmEntity handler layer
 *
 * Each handler:
 * - Has explicit return type matching RPC error definition
 * - Uses inline error handling (colocated, readable)
 * - Applies tapErrorTag for selective observability per error type
 */
export const AlarmEntityHandlers = AlarmEntity.toLayer(
  Effect.gen(function* () {
    const alarmState = yield* Ref.make<Option.Option<Alarm>>(Option.none())

    // ─────────────────────────────────────────────────────────────────────────
    // Create
    // ─────────────────────────────────────────────────────────────────────────
    const handleCreate = (envelope: {
      payload: {
        deviceId: string
        alarmType: string
        severity: string
        message?: string
        metadata?: Record<string, unknown>
      }
    }): Effect.Effect<Alarm, RpcQueryError> => {
      const { deviceId, alarmType, severity, message, metadata } = envelope.payload
      const id = `ALM-${++alarmCounter}` as AlarmId

      return DateTime.now.pipe(
        Effect.flatMap((now) => {
          const alarm: Alarm = {
            _tag: 'Alarm',
            id,
            deviceId: deviceId as Alarm['deviceId'],
            alarmType: alarmType as Alarm['alarmType'],
            severity: severity as Alarm['severity'],
            message,
            triggeredAt: now,
            metadata,
          }
          return Ref.set(alarmState, Option.some(alarm)).pipe(
            Effect.flatMap(() => Effect.logInfo(`Created alarm ${id} for device ${deviceId}`)),
            Effect.as(alarm)
          )
        })
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Get
    // ─────────────────────────────────────────────────────────────────────────
    const handleGet = (envelope: {
      payload: { alarmId: string }
    }): Effect.Effect<Alarm, RpcAlarmNotFoundError> => {
      const { alarmId } = envelope.payload

      return Ref.get(alarmState).pipe(
        Effect.flatMap((maybeAlarm) => {
          if (Option.isNone(maybeAlarm) || maybeAlarm.value.id !== alarmId) {
            return Effect.fail(new RpcAlarmNotFoundError({ alarmId: alarmId as AlarmId }))
          }
          return Effect.succeed(maybeAlarm.value)
        }),
        // Inline observability: log not found
        Effect.tapErrorTag('RpcAlarmNotFoundError', (e) =>
          Effect.logWarning(`Get: Alarm ${e.alarmId} not found`)
        )
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Acknowledge
    // ─────────────────────────────────────────────────────────────────────────
    const handleAcknowledge = (envelope: {
      payload: { alarmId: string; acknowledgedBy: string }
    }): Effect.Effect<Alarm, RpcAlarmNotFoundError | RpcAlarmAlreadyAcknowledgedError> => {
      const { alarmId, acknowledgedBy } = envelope.payload

      return Ref.get(alarmState).pipe(
        Effect.flatMap((maybeAlarm) => {
          if (Option.isNone(maybeAlarm) || maybeAlarm.value.id !== alarmId) {
            return Effect.fail(new RpcAlarmNotFoundError({ alarmId: alarmId as AlarmId }))
          }
          const alarm = maybeAlarm.value
          if (alarm.acknowledgedAt !== undefined) {
            return Effect.fail(new RpcAlarmAlreadyAcknowledgedError({ alarmId: alarmId as AlarmId }))
          }
          return DateTime.now.pipe(
            Effect.flatMap((now) => {
              const updated: Alarm = { ...alarm, acknowledgedAt: now, acknowledgedBy }
              return Ref.set(alarmState, Option.some(updated)).pipe(
                Effect.flatMap(() => Effect.logInfo(`Alarm ${alarmId} acknowledged by ${acknowledgedBy}`)),
                Effect.as(updated)
              )
            })
          )
        }),
        // Inline observability: log each error type with specific context
        Effect.tapErrorTag('RpcAlarmNotFoundError', (e) =>
          Effect.logWarning(`Acknowledge: Alarm ${e.alarmId} not found`)
        ),
        Effect.tapErrorTag('RpcAlarmAlreadyAcknowledgedError', (e) =>
          Effect.logWarning(`Acknowledge: Alarm ${e.alarmId} already acknowledged`)
        )
      )
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Clear
    // ─────────────────────────────────────────────────────────────────────────
    const handleClear = (envelope: {
      payload: { alarmId: string }
    }): Effect.Effect<Alarm, RpcAlarmNotFoundError | RpcAlarmAlreadyClearedError> => {
      const { alarmId } = envelope.payload

      return Ref.get(alarmState).pipe(
        Effect.flatMap((maybeAlarm) => {
          if (Option.isNone(maybeAlarm) || maybeAlarm.value.id !== alarmId) {
            return Effect.fail(new RpcAlarmNotFoundError({ alarmId: alarmId as AlarmId }))
          }
          const alarm = maybeAlarm.value
          if (alarm.clearedAt !== undefined) {
            return Effect.fail(new RpcAlarmAlreadyClearedError({ alarmId: alarmId as AlarmId }))
          }
          return DateTime.now.pipe(
            Effect.flatMap((now) => {
              const updated: Alarm = { ...alarm, clearedAt: now }
              return Ref.set(alarmState, Option.some(updated)).pipe(
                Effect.flatMap(() => Effect.logInfo(`Alarm ${alarmId} cleared`)),
                Effect.as(updated)
              )
            })
          )
        }),
        // Inline observability: log each error type with specific context
        Effect.tapErrorTag('RpcAlarmNotFoundError', (e) =>
          Effect.logWarning(`Clear: Alarm ${e.alarmId} not found`)
        ),
        Effect.tapErrorTag('RpcAlarmAlreadyClearedError', (e) =>
          Effect.logWarning(`Clear: Alarm ${e.alarmId} already cleared`)
        )
      )
    }

    return AlarmEntity.of({
      [AlarmCreateTag]: handleCreate,
      [AlarmGetTag]: handleGet,
      [AlarmAcknowledgeTag]: handleAcknowledge,
      [AlarmClearTag]: handleClear,
    })
  })
)
