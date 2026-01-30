/**
 * IIoT Alarm & Event Schemas
 *
 * Effect Schema definitions for alarms following ISA-18.2 alarm management standard.
 * These integrate with Apache AGE graph for causality tracking.
 *
 * @module @gbg/tmnl/iiot/schemas/alarms
 * @see ISA-18.2 for alarm management standard
 * @see ADR-0012 for ES boundaries (alarms ARE event sourced)
 */

import { Schema } from 'effect'
import { AlarmId, DeviceId, AssetId } from './identifiers'

// =============================================================================
// ISA-18.2 Alarm State Model
// =============================================================================

/**
 * ISA-18.2 Alarm States
 *
 * The standard defines a state model for alarm lifecycle:
 * - unacknowledged: Alarm triggered, operator not yet aware
 * - acknowledged: Operator has acknowledged the alarm
 * - shelved: Temporarily suppressed (time-limited)
 * - suppressed: Suppressed by design (e.g., during maintenance)
 * - cleared: Alarm condition no longer exists
 * - out_of_service: Alarm disabled for maintenance
 *
 * @see ISA-18.2 Section 6.2 - Alarm State Model
 */
export const AlarmState = Schema.Literal(
  'unacknowledged',
  'acknowledged',
  'shelved',
  'suppressed',
  'cleared',
  'out_of_service'
).pipe(
  Schema.brand('@gbg/tmnl/iiot/Alarm/fields/AlarmState'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/AlarmState',
    description: 'ISA-18.2 alarm lifecycle state',
  })
)
export type AlarmState = typeof AlarmState.Type

/**
 * ISA-18.2 Alarm Severity/Priority
 *
 * Maps to ISA-18.2 priority levels:
 * - info: Diagnostic only, no operator action required
 * - warning: Low priority, action may be required
 * - critical: High priority, immediate action required
 * - emergency: Safety-critical, immediate action mandatory
 *
 * @see ISA-18.2 Section 5.3 - Alarm Priority
 */
export const AlarmSeverity = Schema.Literal(
  'info',
  'warning',
  'critical',
  'emergency'
).pipe(
  Schema.brand('@gbg/tmnl/iiot/Alarm/fields/AlarmSeverity'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/AlarmSeverity',
    description: 'ISA-18.2 alarm severity/priority level',
  })
)
export type AlarmSeverity = typeof AlarmSeverity.Type

// =============================================================================
// Alarm Type Categories
// =============================================================================

/** Alarm type categories (process condition that triggered alarm) */
export const AlarmType = Schema.Literal(
  'high_temperature',
  'low_temperature',
  'high_vibration',
  'overcurrent',
  'undercurrent',
  'high_pressure',
  'low_pressure',
  'high_humidity',
  'low_humidity',
  'speed_deviation',
  'communication_loss',
  'sensor_fault',
  'maintenance_due',
  'custom'
)
export type AlarmType = Schema.Schema.Type<typeof AlarmType>

// =============================================================================
// ISA-18.2 State Transition Validation
// =============================================================================

/** Raw alarm state string (unbranded for internal use) */
type AlarmStateRaw = 'unacknowledged' | 'acknowledged' | 'shelved' | 'suppressed' | 'cleared' | 'out_of_service'

/**
 * Valid state transitions per ISA-18.2.
 * Key: current state, Value: array of valid next states
 */
const VALID_TRANSITIONS: Record<AlarmStateRaw, readonly AlarmStateRaw[]> = {
  unacknowledged: ['acknowledged', 'shelved', 'suppressed', 'out_of_service'],
  acknowledged: ['cleared', 'shelved', 'suppressed', 'out_of_service'],
  shelved: ['unacknowledged', 'acknowledged', 'out_of_service'],
  suppressed: ['unacknowledged', 'acknowledged', 'out_of_service'],
  cleared: ['unacknowledged'], // Can re-trigger
  out_of_service: ['unacknowledged', 'cleared'],
}

/**
 * Check if a state transition is valid per ISA-18.2.
 *
 * @param from - Current alarm state
 * @param to - Desired next state
 * @returns true if transition is allowed
 */
export const isValidTransition = (from: AlarmState, to: AlarmState): boolean => {
  // Cast to raw type for lookup (branded types have the same runtime value)
  const fromRaw = from as unknown as AlarmStateRaw
  const toRaw = to as unknown as AlarmStateRaw
  return VALID_TRANSITIONS[fromRaw]?.includes(toRaw) ?? false
}

/**
 * Check if an alarm can be acknowledged from its current state.
 */
export const canAcknowledge = (state: AlarmState): boolean => {
  return state === 'unacknowledged'
}

/**
 * Check if an alarm can be cleared from its current state.
 */
export const canClear = (state: AlarmState): boolean => {
  return state === 'acknowledged'
}

/**
 * Check if an alarm can be shelved from its current state.
 */
export const canShelve = (state: AlarmState): boolean => {
  return state === 'unacknowledged' || state === 'acknowledged'
}

/**
 * Check if an alarm can be suppressed from its current state.
 */
export const canSuppress = (state: AlarmState): boolean => {
  return state === 'unacknowledged' || state === 'acknowledged'
}

/**
 * Check if an alarm can be taken out of service from its current state.
 */
export const canTakeOutOfService = (state: AlarmState): boolean => {
  return state !== 'out_of_service'
}

/**
 * Check if an alarm can be returned to service from its current state.
 */
export const canReturnToService = (state: AlarmState): boolean => {
  return state === 'out_of_service'
}

// =============================================================================
// Alarm Entity
// =============================================================================

/**
 * Alarm record.
 *
 * Represents an alarm instance with ISA-18.2 compliant state tracking.
 * Alarms are EVENT SOURCED per ADR-0012 for full audit trail.
 *
 * @example
 * ```ts
 * const alarm = new Alarm({
 *   id: AlarmId.make('ALM-abc123'),
 *   deviceId: DeviceId.make('TMP-001'),
 *   alarmType: 'high_temperature',
 *   severity: 'critical',
 *   state: 'unacknowledged',
 *   triggeredAt: DateTime.unsafeNow(),
 * })
 * ```
 */
export class Alarm extends Schema.TaggedClass<Alarm>()('Alarm', {
  /** Unique alarm identifier */
  id: AlarmId,

  /** Device that triggered the alarm */
  deviceId: DeviceId,

  /** Asset ID (parent of device, for hierarchy queries) */
  assetId: Schema.optional(AssetId),

  /** Type of alarm condition */
  alarmType: AlarmType,

  /** Severity/priority level */
  severity: AlarmSeverity,

  /** ISA-18.2 lifecycle state */
  state: AlarmState,

  /** Human-readable message */
  message: Schema.optionalWith(Schema.String, { nullable: true }),

  /** When the alarm was triggered */
  triggeredAt: Schema.DateTimeUtc,

  /** When the alarm was acknowledged (if applicable) */
  acknowledgedAt: Schema.optionalWith(Schema.DateTimeUtc, { nullable: true }),

  /** Who acknowledged the alarm (operator ID) */
  acknowledgedBy: Schema.optionalWith(Schema.String, { nullable: true }),

  /** When the alarm was cleared (if applicable) */
  clearedAt: Schema.optionalWith(Schema.DateTimeUtc, { nullable: true }),

  /** When shelving expires (if shelved) */
  shelvedUntil: Schema.optionalWith(Schema.DateTimeUtc, { nullable: true }),

  /** Reason for shelving/suppression */
  suppressionReason: Schema.optionalWith(Schema.String, { nullable: true }),

  /** Custom metadata */
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { nullable: true }
  ),
}) {
  /**
   * Check if alarm is currently active (not cleared or out of service)
   */
  isActive(): boolean {
    return this.state !== 'cleared' && this.state !== 'out_of_service'
  }

  /**
   * Check if alarm requires operator attention
   */
  requiresAttention(): boolean {
    return this.state === 'unacknowledged'
  }

  /**
   * Check if alarm is temporarily hidden (shelved or suppressed)
   */
  isHidden(): boolean {
    return this.state === 'shelved' || this.state === 'suppressed'
  }

  /**
   * Check if this transition is valid from current state
   */
  canTransitionTo(nextState: AlarmState): boolean {
    return isValidTransition(this.state, nextState)
  }
}

// =============================================================================
// Alarm Summary (Lightweight Projection)
// =============================================================================

/**
 * Lightweight alarm projection for lists and dashboards.
 */
export class AlarmSummary extends Schema.TaggedClass<AlarmSummary>()('AlarmSummary', {
  id: AlarmId,
  deviceId: DeviceId,
  alarmType: AlarmType,
  severity: AlarmSeverity,
  state: AlarmState,
  triggeredAt: Schema.DateTimeUtc,
}) {}

// =============================================================================
// Command Parameters
// =============================================================================

/** Create alarm parameters */
export const CreateAlarmParams = Schema.Struct({
  deviceId: DeviceId,
  assetId: Schema.optional(AssetId),
  alarmType: AlarmType,
  severity: AlarmSeverity,
  message: Schema.optional(Schema.String),
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type CreateAlarmParams = Schema.Schema.Type<typeof CreateAlarmParams>

/** Acknowledge alarm parameters */
export const AcknowledgeAlarmParams = Schema.Struct({
  alarmId: AlarmId,
  acknowledgedBy: Schema.NonEmptyString,
})
export type AcknowledgeAlarmParams = Schema.Schema.Type<typeof AcknowledgeAlarmParams>

/** Clear alarm parameters */
export const ClearAlarmParams = Schema.Struct({
  alarmId: AlarmId,
})
export type ClearAlarmParams = Schema.Schema.Type<typeof ClearAlarmParams>

/** Shelve alarm parameters */
export const ShelveAlarmParams = Schema.Struct({
  alarmId: AlarmId,
  shelvedBy: Schema.NonEmptyString,
  /** Duration in minutes (max 24 hours per ISA-18.2 recommendation) */
  durationMinutes: Schema.Number.pipe(Schema.int(), Schema.positive(), Schema.lessThanOrEqualTo(1440)),
  reason: Schema.optional(Schema.String),
})
export type ShelveAlarmParams = Schema.Schema.Type<typeof ShelveAlarmParams>

/** Suppress alarm parameters */
export const SuppressAlarmParams = Schema.Struct({
  alarmId: AlarmId,
  suppressedBy: Schema.NonEmptyString,
  reason: Schema.NonEmptyString,
})
export type SuppressAlarmParams = Schema.Schema.Type<typeof SuppressAlarmParams>

/** Take alarm out of service parameters */
export const OutOfServiceAlarmParams = Schema.Struct({
  alarmId: AlarmId,
  disabledBy: Schema.NonEmptyString,
  reason: Schema.NonEmptyString,
})
export type OutOfServiceAlarmParams = Schema.Schema.Type<typeof OutOfServiceAlarmParams>

/** Return alarm to service parameters */
export const ReturnToServiceAlarmParams = Schema.Struct({
  alarmId: AlarmId,
  enabledBy: Schema.NonEmptyString,
})
export type ReturnToServiceAlarmParams = Schema.Schema.Type<typeof ReturnToServiceAlarmParams>

// =============================================================================
// Query Parameters
// =============================================================================

/** Alarm query parameters */
export const AlarmQueryParams = Schema.Struct({
  deviceId: Schema.optional(DeviceId),
  assetId: Schema.optional(AssetId),
  severity: Schema.optional(AlarmSeverity),
  state: Schema.optional(AlarmState),
  onlyActive: Schema.optional(Schema.Boolean),
  onlyRequiresAttention: Schema.optional(Schema.Boolean),
  since: Schema.optional(Schema.DateTimeUtc),
  until: Schema.optional(Schema.DateTimeUtc),
  limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  offset: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
})
export type AlarmQueryParams = Schema.Schema.Type<typeof AlarmQueryParams>

// =============================================================================
// Alarm Context (for Root Cause Analysis)
// =============================================================================

/** Reading context around an alarm (from materialized view) */
export class AlarmContext extends Schema.TaggedClass<AlarmContext>()('AlarmContext', {
  alarmId: AlarmId,
  deviceId: DeviceId,
  readingTime: Schema.DateTimeUtc,
  value: Schema.Number,
  quality: Schema.Number,
  /** Seconds from alarm trigger (negative = before, positive = after) */
  offsetSeconds: Schema.Number,
}) {}

// =============================================================================
// Alarm History (for Temporal Queries)
// =============================================================================

/**
 * Alarm state at a specific point in time.
 * Used for temporal queries: "What was the alarm state at time T?"
 */
export class AlarmAtTime extends Schema.TaggedClass<AlarmAtTime>()('AlarmAtTime', {
  alarm: Alarm,
  /** The point in time this represents */
  asOf: Schema.DateTimeUtc,
  /** Was this reconstructed from events? */
  fromReplay: Schema.Boolean,
}) {}

/**
 * Alarm state transition record.
 * Used for audit trails and compliance reporting.
 */
export class AlarmTransition extends Schema.TaggedClass<AlarmTransition>()('AlarmTransition', {
  alarmId: AlarmId,
  fromState: AlarmState,
  toState: AlarmState,
  transitionedAt: Schema.DateTimeUtc,
  transitionedBy: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
}) {}
