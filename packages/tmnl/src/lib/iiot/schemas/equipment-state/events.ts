/**
 * Equipment State Events
 *
 * Event definitions for equipment state changes, extending BaseOperationalEvent
 * for EventLog integration. These events provide a complete audit trail of all
 * state transitions.
 *
 * Migration Notes (Epic 1.5):
 * - Events now extend BaseOperationalEvent for EventLog compatibility
 * - `entityId` contains the machineId (generic asset reference)
 * - `entityType` is always 'machine' for these events
 * - `occurredAt` replaces `timestamp` (inherited from base)
 * - `stateId` is kept as domain-specific field for equipment state tracking
 *
 * @module @gbg/tmnl/iiot/schemas/equipment-state/events
 * @see ISA-95/IEC 62264 for equipment state definitions
 * @see @effect/experimental/EventLog for event sourcing
 */

import { Schema } from 'effect'
import { BaseOperationalEvent } from '../events/base'
import { EquipmentStateId, StateType, StateReason } from './schema'

// =============================================================================
// StateStarted Event
// =============================================================================

/**
 * Event: Machine entered a new state.
 *
 * Emitted when a machine transitions into a new equipment state.
 * The previous state (if any) should be ended before this event.
 *
 * Field Mapping:
 * - entityId: The machine identifier (MachineId cast to AssetId)
 * - entityType: Always 'machine'
 * - occurredAt: When the state started (inherited)
 * - stateId: The EquipmentStateId for this state period
 *
 * @example
 * ```ts
 * const event = new StateStarted({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'OP-001',
 *   entityId: 'MCH-cnc-001' as AssetId,
 *   entityType: 'machine',
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   stateId: makeEquipmentStateId('mch001-001'),
 *   state: 'running',
 *   reason: Option.some('production' as StateReason),
 *   notes: Option.none(),
 * })
 * ```
 */
export class StateStarted extends BaseOperationalEvent.extend<StateStarted>(
  'StateStarted'
)({
  /** Equipment state ID for this state period */
  stateId: EquipmentStateId,

  /** The state that was entered */
  state: StateType,

  /** Reason for entering this state */
  reason: Schema.optionalWith(StateReason, { as: 'Option' }),

  /** Notes provided when starting the state */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  /**
   * Get a human-readable description of this event.
   */
  describe(): string {
    const reasonText = this.reason._tag === 'Some' ? ` (${this.reason.value})` : ''
    return `Machine ${this.entityId} entered ${this.state}${reasonText}`
  }
}
export type StateStartedType = typeof StateStarted.Type

// =============================================================================
// StateEnded Event
// =============================================================================

/**
 * Event: Machine exited a state.
 *
 * Emitted when a state period is closed. Includes the total duration
 * of the state period for analytics.
 *
 * @example
 * ```ts
 * const event = new StateEnded({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'OP-001',
 *   entityId: 'MCH-cnc-001' as AssetId,
 *   entityType: 'machine',
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   stateId: makeEquipmentStateId('mch001-001'),
 *   state: 'running',
 *   durationMs: 3600000, // 1 hour
 *   notes: Option.none(),
 * })
 * ```
 */
export class StateEnded extends BaseOperationalEvent.extend<StateEnded>(
  'StateEnded'
)({
  /** Equipment state ID being ended */
  stateId: EquipmentStateId,

  /** The state that was exited */
  state: StateType,

  /** Duration of the state period in milliseconds */
  durationMs: Schema.Number.pipe(Schema.nonNegative()),

  /** Notes provided when ending the state */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  /**
   * Get duration in seconds.
   */
  getDurationSeconds(): number {
    return this.durationMs / 1000
  }

  /**
   * Get duration in minutes.
   */
  getDurationMinutes(): number {
    return this.durationMs / 60000
  }

  /**
   * Get a human-readable description of this event.
   */
  describe(): string {
    const minutes = Math.round(this.getDurationMinutes())
    return `Machine ${this.entityId} exited ${this.state} after ${minutes} minutes`
  }
}
export type StateEndedType = typeof StateEnded.Type

// =============================================================================
// StateReasonUpdated Event
// =============================================================================

/**
 * Event: State reason was clarified or changed.
 *
 * Emitted when the reason for a state is updated after the fact.
 * Common when initial state is recorded as 'unknown' and later clarified.
 *
 * @example
 * ```ts
 * const event = new StateReasonUpdated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'OP-001',
 *   entityId: 'MCH-cnc-001' as AssetId,
 *   entityType: 'machine',
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   stateId: makeEquipmentStateId('mch001-001'),
 *   previousReason: Option.some('unknown' as StateReason),
 *   newReason: 'breakdown' as StateReason,
 *   notes: Option.none(),
 * })
 * ```
 */
export class StateReasonUpdated extends BaseOperationalEvent.extend<StateReasonUpdated>(
  'StateReasonUpdated'
)({
  /** Equipment state ID being updated */
  stateId: EquipmentStateId,

  /** Previous reason (if any) */
  previousReason: Schema.optionalWith(StateReason, { as: 'Option' }),

  /** New reason */
  newReason: StateReason,

  /** Notes explaining the reason change */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  /**
   * Get a human-readable description of this event.
   */
  describe(): string {
    const prevText =
      this.previousReason._tag === 'Some' ? this.previousReason.value : 'none'
    return `State ${this.stateId} reason changed from ${prevText} to ${this.newReason}`
  }
}
export type StateReasonUpdatedType = typeof StateReasonUpdated.Type

// =============================================================================
// StateAnnotated Event
// =============================================================================

/**
 * Event: Notes were added to a state record.
 *
 * Emitted when additional notes or annotations are added to a state.
 * Used for documenting root causes, observations, or follow-up actions.
 *
 * @example
 * ```ts
 * const event = new StateAnnotated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'OP-001',
 *   entityId: 'MCH-cnc-001' as AssetId,
 *   entityType: 'machine',
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   stateId: makeEquipmentStateId('mch001-001'),
 *   notes: 'Breakdown caused by worn bearing. Replacement scheduled.',
 *   tags: ['maintenance', 'bearing'],
 * })
 * ```
 */
export class StateAnnotated extends BaseOperationalEvent.extend<StateAnnotated>(
  'StateAnnotated'
)({
  /** Equipment state ID being annotated */
  stateId: EquipmentStateId,

  /** Notes/annotation added */
  notes: Schema.NonEmptyString,

  /** Tags for categorizing the annotation */
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
}) {
  /**
   * Get a human-readable description of this event.
   */
  describe(): string {
    const preview = this.notes.length > 50 ? `${this.notes.slice(0, 50)}...` : this.notes
    return `State ${this.stateId} annotated: "${preview}"`
  }
}
export type StateAnnotatedType = typeof StateAnnotated.Type

// =============================================================================
// StateTransitioned Event
// =============================================================================

/**
 * Event: Machine transitioned from one state to another.
 *
 * This is a compound event that captures the full transition context.
 * Useful for analytics that need to see both the from and to states together.
 *
 * @example
 * ```ts
 * const event = new StateTransitioned({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'OP-001',
 *   entityId: 'MCH-cnc-001' as AssetId,
 *   entityType: 'machine',
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   stateId: makeEquipmentStateId('mch001-002'), // new state ID
 *   fromState: 'running',
 *   fromStateId: makeEquipmentStateId('mch001-001'),
 *   fromDurationMs: 3600000,
 *   toState: 'unplanned_downtime',
 *   toReason: Option.some('breakdown' as StateReason),
 *   notes: Option.none(),
 * })
 * ```
 */
export class StateTransitioned extends BaseOperationalEvent.extend<StateTransitioned>(
  'StateTransitioned'
)({
  /** New equipment state ID */
  stateId: EquipmentStateId,

  /** State being exited */
  fromState: StateType,

  /** ID of the state being exited */
  fromStateId: EquipmentStateId,

  /** Duration of the previous state in milliseconds */
  fromDurationMs: Schema.Number.pipe(Schema.nonNegative()),

  /** State being entered */
  toState: StateType,

  /** Reason for entering the new state */
  toReason: Schema.optionalWith(StateReason, { as: 'Option' }),

  /** Notes about the transition */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  /**
   * Get a human-readable description of this event.
   */
  describe(): string {
    const reasonText = this.toReason._tag === 'Some' ? ` (${this.toReason.value})` : ''
    const minutes = Math.round(this.fromDurationMs / 60000)
    return `Machine ${this.entityId} transitioned from ${this.fromState} (${minutes}m) to ${this.toState}${reasonText}`
  }

  /**
   * Check if this transition was from productive to non-productive.
   */
  wasProductivityLoss(): boolean {
    return this.fromState === 'running' && this.toState !== 'running'
  }

  /**
   * Check if this transition was from non-productive to productive.
   */
  wasProductivityGain(): boolean {
    return this.fromState !== 'running' && this.toState === 'running'
  }
}
export type StateTransitionedType = typeof StateTransitioned.Type

// =============================================================================
// Event Union (for handlers)
// =============================================================================

/**
 * Union of all equipment state events.
 * Use this for event handler subscriptions.
 */
export const EquipmentStateEvent = Schema.Union(
  StateStarted,
  StateEnded,
  StateReasonUpdated,
  StateAnnotated,
  StateTransitioned
)
export type EquipmentStateEvent = typeof EquipmentStateEvent.Type

/**
 * Get the event type name from an event instance.
 */
export const getEventType = (
  event: EquipmentStateEvent
): string => {
  return event._tag
}
