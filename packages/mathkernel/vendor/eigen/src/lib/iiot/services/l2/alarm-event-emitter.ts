/**
 * Alarm Event Emitter — Conditional EventLog Emission for Alarms
 *
 * Helper functions to emit alarm events to EventLog when the feature flag
 * `ES_ALARM_ENABLED` is true. These functions check the feature flag and
 * emit events via the EventLog client.
 *
 * Pattern:
 * 1. Check `isAlarmEventSourcingEnabled` feature flag
 * 2. If enabled, create EventLog client and emit event
 * 3. If disabled, no-op (legacy CRUD path)
 *
 * @module @gbg/tmnl/iiot/services/l2/alarm-event-emitter
 * @see WBS EL-2.14-17 for alarm event emission requirements
 * @see ISA-18.2 for alarm management standard
 * @see ADR-0012 for ES boundaries (alarms ARE event sourced)
 */

import { Effect, DateTime, Option } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { isAlarmEventSourcingEnabled, IIoTFeatureFlags } from '../../infrastructure/feature-flags'
import { IIoTEventLogSchema } from '../../infrastructure/eventlog-layer'
import type { AlarmId, DeviceId, AssetId, EventId } from '../../schemas/identifiers'
import type { AlarmSeverity, AlarmType } from '../../schemas/alarms'

// =============================================================================
// Event ID Generation
// =============================================================================

/**
 * Generate a unique event ID (ULID-like format).
 */
const makeEventId = (): EventId =>
  `EVT-${Date.now()}-${Math.random().toString(36).slice(2, 11)}` as EventId

// =============================================================================
// Input Types for Emitters
// =============================================================================

/**
 * Input for emitting AlarmTriggered event.
 */
export interface EmitAlarmTriggeredInput {
  readonly alarmId: AlarmId
  readonly deviceId: DeviceId
  readonly alarmType: AlarmType
  readonly severity: AlarmSeverity
  readonly triggeredAt: DateTime.Utc
  readonly message?: string
  readonly triggerValue?: number
  readonly thresholdValue?: number
  readonly unit?: string
  readonly metadata?: Record<string, unknown>
  readonly causedBy?: string
}

/**
 * Input for emitting AlarmAcknowledged event.
 */
export interface EmitAlarmAcknowledgedInput {
  readonly alarmId: AlarmId
  readonly deviceId: DeviceId
  readonly acknowledgedBy: string
  readonly acknowledgedAt: DateTime.Utc
  readonly comments?: string
  readonly causedBy?: string
}

/**
 * Input for emitting AlarmCleared event.
 */
export interface EmitAlarmClearedInput {
  readonly alarmId: AlarmId
  readonly deviceId: DeviceId
  readonly clearedAt: DateTime.Utc
  readonly clearValue?: number
  readonly autoClear?: boolean
  readonly notes?: string
  readonly causedBy?: string
}

// =============================================================================
// Emitter Functions
// =============================================================================

/**
 * Emit AlarmTriggered event to EventLog if feature flag is enabled.
 *
 * @example
 * ```typescript
 * yield* emitAlarmTriggered({
 *   alarmId: alarm.id,
 *   deviceId: alarm.deviceId,
 *   alarmType: alarm.alarmType,
 *   severity: alarm.severity,
 *   triggeredAt: alarm.triggeredAt,
 *   message: alarm.message,
 * })
 * ```
 */
export const emitAlarmTriggered = (
  input: EmitAlarmTriggeredInput
): Effect.Effect<void, never, IIoTFeatureFlags | EventLog.EventLog> =>
  Effect.gen(function* () {
    const esEnabled = yield* isAlarmEventSourcingEnabled

    if (!esEnabled) {
      // Feature flag disabled - no-op
      return
    }

    const client = yield* EventLog.makeClient(IIoTEventLogSchema)

    yield* client('AlarmTriggered', {
      // Base event fields
      eventId: makeEventId(),
      occurredAt: input.triggeredAt,
      causedBy: input.causedBy ?? 'system',
      entityId: input.deviceId as unknown as AssetId,
      entityType: 'device' as const,
      correlationId: Option.none(),
      schemaVersion: 1,

      // Alarm-specific fields
      alarmId: input.alarmId,
      deviceId: input.deviceId,
      severity: input.severity,
      alarmType: input.alarmType,
      triggerValue: input.triggerValue ?? 0,
      thresholdValue: input.thresholdValue !== undefined
        ? Option.some(input.thresholdValue)
        : Option.none(),
      unit: input.unit !== undefined
        ? Option.some(input.unit)
        : Option.none(),
      message: input.message !== undefined
        ? Option.some(input.message)
        : Option.none(),
      metadata: input.metadata !== undefined
        ? Option.some(input.metadata)
        : Option.none(),
    })

    yield* Effect.logDebug(`Emitted AlarmTriggered event for alarm ${input.alarmId}`)
  })

/**
 * Emit AlarmAcknowledged event to EventLog if feature flag is enabled.
 *
 * @example
 * ```typescript
 * yield* emitAlarmAcknowledged({
 *   alarmId: alarm.id,
 *   deviceId: alarm.deviceId,
 *   acknowledgedBy: 'operator-1',
 *   acknowledgedAt: DateTime.unsafeNow(),
 * })
 * ```
 */
export const emitAlarmAcknowledged = (
  input: EmitAlarmAcknowledgedInput
): Effect.Effect<void, never, IIoTFeatureFlags | EventLog.EventLog> =>
  Effect.gen(function* () {
    const esEnabled = yield* isAlarmEventSourcingEnabled

    if (!esEnabled) {
      // Feature flag disabled - no-op
      return
    }

    const client = yield* EventLog.makeClient(IIoTEventLogSchema)

    yield* client('AlarmAcknowledged', {
      // Base event fields
      eventId: makeEventId(),
      occurredAt: input.acknowledgedAt,
      causedBy: input.causedBy ?? input.acknowledgedBy,
      entityId: input.deviceId as unknown as AssetId,
      entityType: 'device' as const,
      correlationId: Option.none(),
      schemaVersion: 1,

      // Alarm-specific fields
      alarmId: input.alarmId,
      deviceId: input.deviceId,
      acknowledgedBy: input.acknowledgedBy,
      comments: input.comments !== undefined
        ? Option.some(input.comments)
        : Option.none(),
    })

    yield* Effect.logDebug(`Emitted AlarmAcknowledged event for alarm ${input.alarmId}`)
  })

/**
 * Emit AlarmCleared event to EventLog if feature flag is enabled.
 *
 * @example
 * ```typescript
 * yield* emitAlarmCleared({
 *   alarmId: alarm.id,
 *   deviceId: alarm.deviceId,
 *   clearedAt: DateTime.unsafeNow(),
 *   autoClear: false,
 * })
 * ```
 */
export const emitAlarmCleared = (
  input: EmitAlarmClearedInput
): Effect.Effect<void, never, IIoTFeatureFlags | EventLog.EventLog> =>
  Effect.gen(function* () {
    const esEnabled = yield* isAlarmEventSourcingEnabled

    if (!esEnabled) {
      // Feature flag disabled - no-op
      return
    }

    const client = yield* EventLog.makeClient(IIoTEventLogSchema)

    yield* client('AlarmCleared', {
      // Base event fields
      eventId: makeEventId(),
      occurredAt: input.clearedAt,
      causedBy: input.causedBy ?? 'system',
      entityId: input.deviceId as unknown as AssetId,
      entityType: 'device' as const,
      correlationId: Option.none(),
      schemaVersion: 1,

      // Alarm-specific fields
      alarmId: input.alarmId,
      deviceId: input.deviceId,
      clearValue: input.clearValue !== undefined
        ? Option.some(input.clearValue)
        : Option.none(),
      autoClear: input.autoClear ?? false,
      notes: input.notes !== undefined
        ? Option.some(input.notes)
        : Option.none(),
    })

    yield* Effect.logDebug(`Emitted AlarmCleared event for alarm ${input.alarmId}`)
  })
