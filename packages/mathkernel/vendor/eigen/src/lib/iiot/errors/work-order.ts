/**
 * Work Order Error Schemas
 *
 * Domain-specific errors for work order lifecycle operations.
 * Covers state transitions, approvals, and validation.
 *
 * @module
 */

import { Data } from 'effect'

// =============================================================================
// Work Order Not Found
// =============================================================================

/**
 * Work order not found in the system.
 *
 * @example
 * ```ts
 * new WorkOrderNotFoundError({ workOrderId: 'WO-2026-00001' })
 * ```
 */
export class WorkOrderNotFoundError extends Data.TaggedError('WorkOrderNotFoundError')<{
  /** Identifier of the missing work order */
  readonly workOrderId: string
}> {}

// =============================================================================
// Work Order State
// =============================================================================

/**
 * Invalid work order state for attempted action.
 *
 * Thrown when a work order operation is invalid given current state.
 *
 * @example
 * ```ts
 * new InvalidWorkOrderStateError({
 *   workOrderId: 'WO-2026-00002',
 *   currentState: 'completed',
 *   attemptedAction: 'start'
 * })
 * ```
 */
export class InvalidWorkOrderStateError extends Data.TaggedError('InvalidWorkOrderStateError')<{
  /** Identifier of the work order */
  readonly workOrderId: string
  /** Current state of the work order */
  readonly currentState: string
  /** Action that was attempted */
  readonly attemptedAction: string
}> {}

// =============================================================================
// Work Order Approval
// =============================================================================

/**
 * Work order requires approval before proceeding.
 *
 * Thrown when an action requires an approval that hasn't been granted.
 *
 * @example
 * ```ts
 * new WorkOrderApprovalRequiredError({
 *   workOrderId: 'WO-2026-00003',
 *   requiredApprovalType: 'safety'
 * })
 * ```
 */
export class WorkOrderApprovalRequiredError extends Data.TaggedError('WorkOrderApprovalRequiredError')<{
  /** Identifier of the work order */
  readonly workOrderId: string
  /** Type of approval required (safety, supervisor, quality, etc.) */
  readonly requiredApprovalType: string
}> {}

// =============================================================================
// Union Types
// =============================================================================

/**
 * All work order command errors as a discriminated union.
 *
 * Use with Effect.catchTags for exhaustive error handling:
 * @example
 * ```ts
 * pipe(
 *   completeWorkOrder(command),
 *   Effect.catchTags({
 *     WorkOrderNotFoundError: (e) => Effect.fail(new HttpNotFound(e.workOrderId)),
 *     InvalidWorkOrderStateError: (e) => Effect.fail(new HttpConflict(`Cannot ${e.attemptedAction} in ${e.currentState}`)),
 *     WorkOrderApprovalRequiredError: (e) => Effect.fail(new HttpForbidden(`Requires ${e.requiredApprovalType} approval`)),
 *   })
 * )
 * ```
 */
export type WorkOrderCommandError =
  | WorkOrderNotFoundError
  | InvalidWorkOrderStateError
  | WorkOrderApprovalRequiredError
