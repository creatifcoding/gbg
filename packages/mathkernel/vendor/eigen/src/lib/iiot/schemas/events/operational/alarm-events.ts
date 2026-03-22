/**
 * Alarm Events — ISA-18.2 Compliant Alarm State Transitions
 *
 * Defines 10 operational events for alarm lifecycle management:
 * - AlarmTriggered: Initial alarm condition detected
 * - AlarmAcknowledged: Operator acknowledged the alarm
 * - AlarmCleared: Alarm condition resolved
 * - AlarmEscalated: Alarm escalated due to no response
 * - AlarmShelved: Temporarily suppressed (time-limited per ISA-18.2)
 * - AlarmUnshelved: Shelve period ended
 * - AlarmSuppressed: Suppressed by design (maintenance)
 * - AlarmOutOfService: Alarm disabled for maintenance
 * - AlarmReturnedToService: Alarm re-enabled after maintenance
 * - AlarmConfigChanged: Alarm thresholds/config updated
 *
 * These events are stored in EventLog (not TimescaleDB) for full audit trail.
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/alarm-events
 * @see ISA-18.2 for alarm management standard
 * @see ADR-0012 for ES boundaries (alarms ARE event sourced)
 */

import { Schema } from 'effect'
import { AlarmId, DeviceId } from '../../identifiers'
import { AlarmSeverity, AlarmType } from '../../alarms'
import { BaseOperationalEvent } from '../base'

// =============================================================================
// AlarmTriggered — Initial Alarm Condition
// =============================================================================

/**
 * AlarmTriggered event.
 *
 * Emitted when an alarm condition is first detected. The alarm starts
 * in 'unacknowledged' state per ISA-18.2.
 *
 * @example
 * ```typescript
 * const event = new AlarmTriggered({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'sensor-monitor',
 *   entityId: deviceId as AssetId,
 *   entityType: 'Device',
 *   alarmId,
 *   deviceId,
 *   severity: 'critical',
 *   alarmType: 'high_temperature',
 *   triggerValue: 85.5,
 *   thresholdValue: 80.0,
 *   message: Option.some('Temperature exceeded threshold'),
 * })
 * ```
 */
export class AlarmTriggered extends BaseOperationalEvent.extend<AlarmTriggered>(
  'AlarmTriggered'
)({
  /** Unique alarm identifier */
  alarmId: AlarmId,

  /** Device that triggered the alarm */
  deviceId: DeviceId,

  /** ISA-18.2 severity/priority level */
  severity: AlarmSeverity,

  /** Type of alarm condition */
  alarmType: AlarmType,

  /** Value that triggered the alarm */
  triggerValue: Schema.Number,

  /** Threshold that was exceeded */
  thresholdValue: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Unit of measurement for values */
  unit: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Human-readable alarm message */
  message: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Custom metadata */
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
}) {}

export type AlarmTriggeredType = typeof AlarmTriggered.Type

// =============================================================================
// AlarmAcknowledged — Operator Acknowledged
// =============================================================================

/**
 * AlarmAcknowledged event.
 *
 * Emitted when an operator acknowledges an unacknowledged alarm.
 * State transition: unacknowledged → acknowledged
 */
export class AlarmAcknowledged extends BaseOperationalEvent.extend<AlarmAcknowledged>(
  'AlarmAcknowledged'
)({
  /** Alarm being acknowledged */
  alarmId: AlarmId,

  /** Device associated with the alarm */
  deviceId: DeviceId,

  /** Operator who acknowledged */
  acknowledgedBy: Schema.NonEmptyString,

  /** Optional acknowledgment comments */
  comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type AlarmAcknowledgedType = typeof AlarmAcknowledged.Type

// =============================================================================
// AlarmCleared — Condition Resolved
// =============================================================================

/**
 * AlarmCleared event.
 *
 * Emitted when the alarm condition is no longer present.
 * State transition: acknowledged → cleared
 */
export class AlarmCleared extends BaseOperationalEvent.extend<AlarmCleared>(
  'AlarmCleared'
)({
  /** Alarm being cleared */
  alarmId: AlarmId,

  /** Device associated with the alarm */
  deviceId: DeviceId,

  /** Current value (should be within normal range) */
  clearValue: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Whether auto-cleared by system vs manual clear */
  autoClear: Schema.optionalWith(Schema.Boolean, { default: () => false }),

  /** Optional clear reason/notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type AlarmClearedType = typeof AlarmCleared.Type

// =============================================================================
// AlarmEscalated — No Response Escalation
// =============================================================================

/**
 * AlarmEscalated event.
 *
 * Emitted when an alarm is escalated due to lack of response.
 * Typically triggered by time-based escalation rules.
 */
export class AlarmEscalated extends BaseOperationalEvent.extend<AlarmEscalated>(
  'AlarmEscalated'
)({
  /** Alarm being escalated */
  alarmId: AlarmId,

  /** Device associated with the alarm */
  deviceId: DeviceId,

  /** Escalation level (1, 2, 3, etc.) */
  escalationLevel: Schema.Number.pipe(Schema.int(), Schema.positive()),

  /** Who the alarm is escalated to (role, user, or group) */
  escalatedTo: Schema.NonEmptyString,

  /** Seconds since alarm triggered without acknowledgment */
  elapsedSeconds: Schema.Number.pipe(Schema.positive()),

  /** Optional escalation notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type AlarmEscalatedType = typeof AlarmEscalated.Type

// =============================================================================
// AlarmShelved — Temporary Suppression
// =============================================================================

/**
 * AlarmShelved event.
 *
 * Emitted when an alarm is temporarily suppressed (shelved).
 * ISA-18.2 recommends max 24-hour shelve duration.
 * State transition: unacknowledged|acknowledged → shelved
 */
export class AlarmShelved extends BaseOperationalEvent.extend<AlarmShelved>(
  'AlarmShelved'
)({
  /** Alarm being shelved */
  alarmId: AlarmId,

  /** Device associated with the alarm */
  deviceId: DeviceId,

  /** Operator who shelved the alarm */
  shelvedBy: Schema.NonEmptyString,

  /** When the shelve period ends (UTC) */
  shelvedUntil: Schema.DateTimeUtc,

  /** Reason for shelving */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type AlarmShelvedType = typeof AlarmShelved.Type

// =============================================================================
// AlarmUnshelved — Shelve Period Ended
// =============================================================================

/**
 * AlarmUnshelved event.
 *
 * Emitted when a shelved alarm's suppression period ends.
 * State transition: shelved → unacknowledged|acknowledged (previous state)
 */
export class AlarmUnshelved extends BaseOperationalEvent.extend<AlarmUnshelved>(
  'AlarmUnshelved'
)({
  /** Alarm being unshelved */
  alarmId: AlarmId,

  /** Device associated with the alarm */
  deviceId: DeviceId,

  /** Whether auto-unshelved by timer vs manual unshelve */
  autoUnshelve: Schema.optionalWith(Schema.Boolean, { default: () => true }),

  /** Operator who manually unshelved (if not auto) */
  unshelvedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type AlarmUnshelvedType = typeof AlarmUnshelved.Type

// =============================================================================
// AlarmSuppressed — Design Suppression
// =============================================================================

/**
 * AlarmSuppressed event.
 *
 * Emitted when an alarm is suppressed by design (e.g., during maintenance).
 * Unlike shelving, suppression has no automatic expiry.
 * State transition: unacknowledged|acknowledged → suppressed
 */
export class AlarmSuppressed extends BaseOperationalEvent.extend<AlarmSuppressed>(
  'AlarmSuppressed'
)({
  /** Alarm being suppressed */
  alarmId: AlarmId,

  /** Device associated with the alarm */
  deviceId: DeviceId,

  /** Operator who suppressed the alarm */
  suppressedBy: Schema.NonEmptyString,

  /** Reason for suppression (required for audit) */
  reason: Schema.NonEmptyString,

  /** Optional linked work order for maintenance suppression */
  workOrderId: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type AlarmSuppressedType = typeof AlarmSuppressed.Type

// =============================================================================
// AlarmOutOfService — Maintenance Mode
// =============================================================================

/**
 * AlarmOutOfService event.
 *
 * Emitted when an alarm is taken out of service for maintenance.
 * State transition: any → out_of_service
 */
export class AlarmOutOfService extends BaseOperationalEvent.extend<AlarmOutOfService>(
  'AlarmOutOfService'
)({
  /** Alarm being disabled */
  alarmId: AlarmId,

  /** Device associated with the alarm */
  deviceId: DeviceId,

  /** Operator who disabled the alarm */
  disabledBy: Schema.NonEmptyString,

  /** Reason for taking out of service */
  reason: Schema.NonEmptyString,

  /** Optional linked work order */
  workOrderId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Expected return to service date (optional) */
  expectedReturnDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
}) {}

export type AlarmOutOfServiceType = typeof AlarmOutOfService.Type

// =============================================================================
// AlarmReturnedToService — Back Online
// =============================================================================

/**
 * AlarmReturnedToService event.
 *
 * Emitted when an out-of-service alarm is re-enabled.
 * State transition: out_of_service → unacknowledged|cleared
 */
export class AlarmReturnedToService extends BaseOperationalEvent.extend<AlarmReturnedToService>(
  'AlarmReturnedToService'
)({
  /** Alarm being returned to service */
  alarmId: AlarmId,

  /** Device associated with the alarm */
  deviceId: DeviceId,

  /** Operator who returned the alarm to service */
  returnedBy: Schema.NonEmptyString,

  /** Initial state after return (unacknowledged if condition present, cleared if not) */
  initialState: Schema.Literal('unacknowledged', 'cleared'),

  /** Notes about the return to service */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type AlarmReturnedToServiceType = typeof AlarmReturnedToService.Type

// =============================================================================
// AlarmConfigChanged — Threshold/Config Update
// =============================================================================

/**
 * AlarmConfigChanged event.
 *
 * Emitted when alarm configuration (thresholds, severity, etc.) is modified.
 * This is a structural change but stored with operational events for audit.
 */
export class AlarmConfigChanged extends BaseOperationalEvent.extend<AlarmConfigChanged>(
  'AlarmConfigChanged'
)({
  /** Alarm being configured */
  alarmId: AlarmId,

  /** Device associated with the alarm */
  deviceId: DeviceId,

  /** Operator who made the change */
  changedBy: Schema.NonEmptyString,

  /** Configuration changes as key-value pairs */
  changes: Schema.Record({
    key: Schema.String,
    value: Schema.Struct({
      previous: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
      new: Schema.Unknown,
    }),
  }),

  /** Reason for the change */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Optional approval reference */
  approvedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type AlarmConfigChangedType = typeof AlarmConfigChanged.Type

// =============================================================================
// Union Type for All Alarm Events
// =============================================================================

/**
 * Union of all alarm events for type guards and handlers.
 */
export type AlarmEvent =
  | AlarmTriggered
  | AlarmAcknowledged
  | AlarmCleared
  | AlarmEscalated
  | AlarmShelved
  | AlarmUnshelved
  | AlarmSuppressed
  | AlarmOutOfService
  | AlarmReturnedToService
  | AlarmConfigChanged

/**
 * Alarm event tags for type narrowing.
 */
export const ALARM_EVENT_TAGS = [
  'AlarmTriggered',
  'AlarmAcknowledged',
  'AlarmCleared',
  'AlarmEscalated',
  'AlarmShelved',
  'AlarmUnshelved',
  'AlarmSuppressed',
  'AlarmOutOfService',
  'AlarmReturnedToService',
  'AlarmConfigChanged',
] as const

export type AlarmEventTag = (typeof ALARM_EVENT_TAGS)[number]
