/**
 * Alarm Error Schemas
 *
 * Domain-specific errors for alarm lifecycle operations.
 * Covers alarm state transitions, acknowledgments, and clearing.
 *
 * @module
 */

import { Data } from 'effect'

// =============================================================================
// Alarm Not Found
// =============================================================================

/**
 * Alarm not found in the system.
 *
 * @example
 * ```ts
 * new AlarmNotFoundError({ alarmId: 'ALM-001' })
 * ```
 */
export class AlarmNotFoundError extends Data.TaggedError('AlarmNotFoundError')<{
  /** Identifier of the missing alarm */
  readonly alarmId: string
}> {}

// =============================================================================
// Alarm State Transition
// =============================================================================

/**
 * Invalid alarm state transition error.
 *
 * Thrown when an alarm lifecycle operation violates state machine rules.
 *
 * @example
 * ```ts
 * new InvalidAlarmTransitionError({
 *   alarmId: 'ALM-002',
 *   currentState: 'cleared',
 *   attemptedState: 'acknowledged',
 *   reason: 'Cannot acknowledge a cleared alarm'
 * })
 * ```
 */
export class InvalidAlarmTransitionError extends Data.TaggedError('InvalidAlarmTransitionError')<{
  /** Identifier of the alarm */
  readonly alarmId: string
  /** Current state of the alarm */
  readonly currentState: string
  /** State transition that was attempted */
  readonly attemptedState: string
  /** Human-readable reason why transition is invalid */
  readonly reason: string
}> {}

// =============================================================================
// Alarm Already Acknowledged
// =============================================================================

/**
 * Alarm has already been acknowledged.
 *
 * Thrown when attempting to acknowledge an alarm that was already
 * acknowledged by another operator.
 *
 * @example
 * ```ts
 * new AlarmAlreadyAcknowledgedError({
 *   alarmId: 'ALM-003',
 *   acknowledgedAt: new Date('2026-01-31T10:00:00Z'),
 *   acknowledgedBy: 'operator-456'
 * })
 * ```
 */
export class AlarmAlreadyAcknowledgedError extends Data.TaggedError('AlarmAlreadyAcknowledgedError')<{
  /** Identifier of the alarm */
  readonly alarmId: string
  /** Timestamp when the alarm was acknowledged */
  readonly acknowledgedAt: Date
  /** User ID of the operator who acknowledged */
  readonly acknowledgedBy: string
}> {}

// =============================================================================
// Union Types
// =============================================================================

/**
 * All alarm command errors as a discriminated union.
 *
 * Use with Effect.catchTags for exhaustive error handling:
 * @example
 * ```ts
 * pipe(
 *   acknowledgeAlarm(command),
 *   Effect.catchTags({
 *     AlarmNotFoundError: (e) => Effect.logWarning(`Alarm ${e.alarmId} not found`),
 *     InvalidAlarmTransitionError: (e) => Effect.logWarning(`Invalid: ${e.reason}`),
 *     AlarmAlreadyAcknowledgedError: (e) => Effect.logInfo(`Already acked by ${e.acknowledgedBy}`),
 *   })
 * )
 * ```
 */
export type AlarmCommandError =
  | AlarmNotFoundError
  | InvalidAlarmTransitionError
  | AlarmAlreadyAcknowledgedError
