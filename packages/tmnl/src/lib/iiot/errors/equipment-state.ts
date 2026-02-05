/**
 * Equipment State Error Schemas
 *
 * Domain-specific errors for equipment state lifecycle operations.
 * Covers OEE state transitions, maintenance, and fault management.
 *
 * @module
 */

import { Data } from 'effect'

// =============================================================================
// Equipment State Not Found
// =============================================================================

/**
 * Equipment state record not found in the system.
 *
 * @example
 * ```ts
 * new EquipmentStateNotFoundError({ machineId: 'MCH-001' })
 * ```
 */
export class EquipmentStateNotFoundError extends Data.TaggedError('EquipmentStateNotFoundError')<{
  /** Identifier of the machine with missing state */
  readonly machineId: string
}> {}

// =============================================================================
// Invalid State Transition
// =============================================================================

/**
 * Invalid equipment state transition for OEE state machine.
 *
 * Thrown when attempting an invalid state transition per ISA-95/OEE rules.
 * Valid transitions:
 * - operational -> degraded, faulted, maintenance, offline
 * - degraded -> operational, faulted, maintenance, offline
 * - faulted -> maintenance, offline (must be cleared first)
 * - maintenance -> operational, degraded (after completion)
 * - offline -> operational (on power-up)
 *
 * @example
 * ```ts
 * new InvalidStateTransitionError({
 *   machineId: 'MCH-001',
 *   currentState: 'faulted',
 *   targetState: 'operational',
 *   reason: 'Fault must be cleared before returning to operational state'
 * })
 * ```
 */
export class InvalidStateTransitionError extends Data.TaggedError('InvalidStateTransitionError')<{
  /** Identifier of the machine */
  readonly machineId: string
  /** Current state of the equipment */
  readonly currentState: string
  /** State that was attempted */
  readonly targetState: string
  /** Reason why the transition is invalid */
  readonly reason: string
}> {}

// =============================================================================
// Equipment State Validation
// =============================================================================

/**
 * Equipment state data validation failed.
 *
 * Thrown when equipment state data fails schema validation.
 *
 * @example
 * ```ts
 * new EquipmentStateValidationError({
 *   machineId: 'MCH-001',
 *   field: 'performancePercent',
 *   message: 'Performance must be between 0 and 100'
 * })
 * ```
 */
export class EquipmentStateValidationError extends Data.TaggedError('EquipmentStateValidationError')<{
  /** Identifier of the machine */
  readonly machineId: string
  /** Field that failed validation */
  readonly field: string
  /** Validation error message */
  readonly message: string
}> {}

// =============================================================================
// Fault Not Found
// =============================================================================

/**
 * Fault record not found for equipment.
 *
 * Thrown when attempting to clear a fault that doesn't exist.
 *
 * @example
 * ```ts
 * new FaultNotFoundError({
 *   machineId: 'MCH-001',
 *   faultCode: 'ERR-MOT-001'
 * })
 * ```
 */
export class FaultNotFoundError extends Data.TaggedError('FaultNotFoundError')<{
  /** Identifier of the machine */
  readonly machineId: string
  /** Fault code that was not found */
  readonly faultCode: string
}> {}

// =============================================================================
// Maintenance In Progress
// =============================================================================

/**
 * Equipment is already in maintenance mode.
 *
 * Thrown when attempting to enter maintenance while already in maintenance.
 *
 * @example
 * ```ts
 * new MaintenanceInProgressError({
 *   machineId: 'MCH-001',
 *   workOrderId: 'WO-2026-00001'
 * })
 * ```
 */
export class MaintenanceInProgressError extends Data.TaggedError('MaintenanceInProgressError')<{
  /** Identifier of the machine */
  readonly machineId: string
  /** Active work order for current maintenance */
  readonly workOrderId: string | undefined
}> {}

// =============================================================================
// Union Types
// =============================================================================

/**
 * All equipment state command errors as a discriminated union.
 *
 * Use with Effect.catchTags for exhaustive error handling:
 * @example
 * ```ts
 * pipe(
 *   changeEquipmentState(command),
 *   Effect.catchTags({
 *     EquipmentStateNotFoundError: (e) => Effect.fail(new HttpNotFound(e.machineId)),
 *     InvalidStateTransitionError: (e) => Effect.fail(new HttpConflict(`Cannot transition from ${e.currentState} to ${e.targetState}: ${e.reason}`)),
 *     EquipmentStateValidationError: (e) => Effect.fail(new HttpBadRequest(`${e.field}: ${e.message}`)),
 *     FaultNotFoundError: (e) => Effect.fail(new HttpNotFound(`Fault ${e.faultCode} not found for ${e.machineId}`)),
 *     MaintenanceInProgressError: (e) => Effect.fail(new HttpConflict(`Maintenance already in progress: ${e.workOrderId}`)),
 *   })
 * )
 * ```
 */
export type EquipmentStateCommandError =
  | EquipmentStateNotFoundError
  | InvalidStateTransitionError
  | EquipmentStateValidationError
  | FaultNotFoundError
  | MaintenanceInProgressError
