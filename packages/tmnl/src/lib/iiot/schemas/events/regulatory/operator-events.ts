/**
 * Operator Events - Regulatory Compliance Audit Trail
 *
 * Defines 5 operator audit trail events for regulatory compliance:
 * - OperatorLogin: Operator logged into system
 * - OperatorLogout: Operator logged out
 * - ParameterOverride: Operator manually overrode a parameter
 * - ManualAcknowledgment: Operator acknowledged a condition/alarm
 * - ShiftHandoff: Shift handoff between operators
 *
 * These events are stored in EventLog for full audit trail per FDA 21 CFR Part 11.
 *
 * @module @gbg/tmnl/iiot/schemas/events/regulatory/operator-events
 * @see EL-5.10-13 for operator event requirements
 * @see FDA 21 CFR Part 11 for electronic records compliance
 * @see ISA-95/IEC 62264 for operations management
 */

import { Schema } from 'effect'
import { BaseOperationalEvent } from '../base'

// =============================================================================
// Branded Identifiers
// =============================================================================

/** Session identifier for operator login sessions */
export const SessionId = Schema.String.pipe(Schema.brand('SessionId'))
export type SessionId = Schema.Schema.Type<typeof SessionId>

/** Override identifier for parameter override events */
export const OverrideId = Schema.String.pipe(Schema.brand('OverrideId'))
export type OverrideId = Schema.Schema.Type<typeof OverrideId>

/** Acknowledgment identifier for manual acknowledgment events */
export const AcknowledgmentId = Schema.String.pipe(Schema.brand('AcknowledgmentId'))
export type AcknowledgmentId = Schema.Schema.Type<typeof AcknowledgmentId>

/** Handoff identifier for shift handoff events */
export const HandoffId = Schema.String.pipe(Schema.brand('HandoffId'))
export type HandoffId = Schema.Schema.Type<typeof HandoffId>

// =============================================================================
// Supporting Enums
// =============================================================================

/**
 * Authentication methods for operator login.
 */
export const AuthMethod = Schema.Literal('badge', 'password', 'biometric').pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/AuthMethod',
    description: 'Authentication method used for operator login',
  })
)
export type AuthMethod = Schema.Schema.Type<typeof AuthMethod>

/**
 * Reasons for operator logout.
 */
export const LogoutReason = Schema.Literal('manual', 'timeout', 'forced').pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/LogoutReason',
    description: 'Reason for operator logout',
  })
)
export type LogoutReason = Schema.Schema.Type<typeof LogoutReason>

/**
 * Target types for manual acknowledgment.
 */
export const AcknowledgmentTargetType = Schema.Literal('alarm', 'deviation', 'message').pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/AcknowledgmentTargetType',
    description: 'Type of item being acknowledged by operator',
  })
)
export type AcknowledgmentTargetType = Schema.Schema.Type<typeof AcknowledgmentTargetType>

// =============================================================================
// OperatorLogin - Operator Logged into System
// =============================================================================

/**
 * OperatorLogin event.
 *
 * Emitted when an operator authenticates and logs into the system.
 * Critical for FDA 21 CFR Part 11 electronic signature compliance.
 *
 * @example
 * ```typescript
 * const event = new OperatorLogin({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'system',
 *   entityId: workstationId as AssetId,
 *   entityType: 'workcell',
 *   sessionId,
 *   operatorId: 'operator-123',
 *   workstation: 'WS-LINE1-01',
 *   loginAt: DateTime.unsafeNow(),
 *   authMethod: 'badge',
 * })
 * ```
 */
export class OperatorLogin extends BaseOperationalEvent.extend<OperatorLogin>(
  'OperatorLogin'
)({
  /** Unique session identifier for this login session */
  sessionId: SessionId,

  /** Unique identifier for the operator */
  operatorId: Schema.NonEmptyString,

  /** Workstation/terminal identifier where operator logged in */
  workstation: Schema.NonEmptyString,

  /** Timestamp when login occurred */
  loginAt: Schema.DateTimeUtc,

  /** Authentication method used */
  authMethod: AuthMethod,
}) {}

export type OperatorLoginType = typeof OperatorLogin.Type

// =============================================================================
// OperatorLogout - Operator Logged out of System
// =============================================================================

/**
 * OperatorLogout event.
 *
 * Emitted when an operator logs out of the system.
 * Captures logout reason for audit purposes.
 *
 * @example
 * ```typescript
 * const event = new OperatorLogout({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-123',
 *   entityId: workstationId as AssetId,
 *   entityType: 'workcell',
 *   sessionId,
 *   operatorId: 'operator-123',
 *   logoutAt: DateTime.unsafeNow(),
 *   reason: 'manual',
 * })
 * ```
 */
export class OperatorLogout extends BaseOperationalEvent.extend<OperatorLogout>(
  'OperatorLogout'
)({
  /** Session identifier being terminated */
  sessionId: SessionId,

  /** Unique identifier for the operator */
  operatorId: Schema.NonEmptyString,

  /** Timestamp when logout occurred */
  logoutAt: Schema.DateTimeUtc,

  /** Reason for logout */
  reason: LogoutReason,
}) {}

export type OperatorLogoutType = typeof OperatorLogout.Type

// =============================================================================
// ParameterOverride - Operator Manually Overrode a Parameter
// =============================================================================

/**
 * ParameterOverride event.
 *
 * Emitted when an operator manually overrides a system parameter.
 * Critical for audit trail in regulated industries (pharma, food, etc.).
 *
 * @example
 * ```typescript
 * const event = new ParameterOverride({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-123',
 *   entityId: machineId as AssetId,
 *   entityType: 'machine',
 *   overrideId,
 *   operatorId: 'operator-123',
 *   parameterId: 'PARAM-temp-setpoint',
 *   previousValue: '150',
 *   newValue: '155',
 *   reason: 'Process optimization per SOP-2026-001',
 *   approvedBy: Option.some('supervisor-456'),
 * })
 * ```
 */
export class ParameterOverride extends BaseOperationalEvent.extend<ParameterOverride>(
  'ParameterOverride'
)({
  /** Unique identifier for this override action */
  overrideId: OverrideId,

  /** Operator who performed the override */
  operatorId: Schema.NonEmptyString,

  /** Identifier of the parameter being overridden */
  parameterId: Schema.NonEmptyString,

  /** Value before override (stored as string for flexibility) */
  previousValue: Schema.String,

  /** New value after override (stored as string for flexibility) */
  newValue: Schema.String,

  /** Required reason/justification for the override */
  reason: Schema.NonEmptyString,

  /** Optional approver for dual-signature compliance */
  approvedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type ParameterOverrideType = typeof ParameterOverride.Type

// =============================================================================
// ManualAcknowledgment - Operator Acknowledged a Condition/Alarm
// =============================================================================

/**
 * ManualAcknowledgment event.
 *
 * Emitted when an operator manually acknowledges an alarm, deviation,
 * or system message. Provides audit trail of human interaction with alerts.
 *
 * @example
 * ```typescript
 * const event = new ManualAcknowledgment({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-123',
 *   entityId: machineId as AssetId,
 *   entityType: 'machine',
 *   acknowledgmentId,
 *   operatorId: 'operator-123',
 *   targetType: 'alarm',
 *   targetId: 'ALM-temp-high-001',
 *   comment: Option.some('Acknowledged - within tolerance'),
 * })
 * ```
 */
export class ManualAcknowledgment extends BaseOperationalEvent.extend<ManualAcknowledgment>(
  'ManualAcknowledgment'
)({
  /** Unique identifier for this acknowledgment */
  acknowledgmentId: AcknowledgmentId,

  /** Operator who acknowledged */
  operatorId: Schema.NonEmptyString,

  /** Type of item being acknowledged */
  targetType: AcknowledgmentTargetType,

  /** Identifier of the acknowledged item (alarm ID, deviation ID, etc.) */
  targetId: Schema.NonEmptyString,

  /** Optional comment from operator */
  comment: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type ManualAcknowledgmentType = typeof ManualAcknowledgment.Type

// =============================================================================
// ShiftHandoff - Shift Handoff Between Operators
// =============================================================================

/**
 * ShiftHandoff event.
 *
 * Emitted when operators perform a shift handoff. Captures critical
 * information transfer between shifts for operational continuity.
 *
 * @example
 * ```typescript
 * const event = new ShiftHandoff({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-outgoing',
 *   entityId: workcellId as AssetId,
 *   entityType: 'workcell',
 *   handoffId,
 *   outgoingOperatorId: 'operator-outgoing',
 *   incomingOperatorId: 'operator-incoming',
 *   handoffAt: DateTime.unsafeNow(),
 *   notes: Option.some('Line running stable'),
 *   openItems: ['WO-2026-00005: 75% complete'],
 * })
 * ```
 */
export class ShiftHandoff extends BaseOperationalEvent.extend<ShiftHandoff>(
  'ShiftHandoff'
)({
  /** Unique identifier for this handoff */
  handoffId: HandoffId,

  /** Operator ending their shift */
  outgoingOperatorId: Schema.NonEmptyString,

  /** Operator starting their shift */
  incomingOperatorId: Schema.NonEmptyString,

  /** Timestamp of the handoff */
  handoffAt: Schema.DateTimeUtc,

  /** Optional notes about shift status */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** List of open items/tasks to communicate */
  openItems: Schema.Array(Schema.String),
}) {}

export type ShiftHandoffType = typeof ShiftHandoff.Type

// =============================================================================
// Union Type for All Operator Events
// =============================================================================

/**
 * Union of all operator events for type guards and handlers.
 */
export type OperatorEvent =
  | OperatorLogin
  | OperatorLogout
  | ParameterOverride
  | ManualAcknowledgment
  | ShiftHandoff

/**
 * Operator event tags for type narrowing.
 */
export const OPERATOR_EVENT_TAGS = [
  'OperatorLogin',
  'OperatorLogout',
  'ParameterOverride',
  'ManualAcknowledgment',
  'ShiftHandoff',
] as const

export type OperatorEventTag = (typeof OPERATOR_EVENT_TAGS)[number]
