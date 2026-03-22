/**
 * Equipment State Schema Exports
 *
 * ISA-95 / OEE standard equipment states for tracking machine availability
 * and performance metrics.
 *
 * @module @gbg/tmnl/iiot/schemas/equipment-state
 */

// Schema exports
export {
  // Identifiers
  EquipmentStateId,
  makeEquipmentStateId,
  // State types
  StateType,
  StateReason,
  // Validation
  isValidStateTransition,
  getValidReasonsForState,
  // Entity
  EquipmentState,
  EquipmentStateSummary,
  // Command params
  StartStateParams,
  EndStateParams,
  UpdateReasonParams,
  TransitionStateParams,
  // Query params
  EquipmentStateQueryParams,
  // Aggregations
  StateDurationAggregate,
} from './schema'

// Type exports
export type {
  EquipmentStateType,
  EquipmentStateSummaryType,
  StateDurationAggregateType,
} from './schema'

// Event exports
export {
  // Events
  StateStarted,
  StateEnded,
  StateReasonUpdated,
  StateAnnotated,
  StateTransitioned,
  // Event union
  EquipmentStateEvent,
  getEventType,
} from './events'

// Event type exports
export type {
  StateStartedType,
  StateEndedType,
  StateReasonUpdatedType,
  StateAnnotatedType,
  StateTransitionedType,
} from './events'
