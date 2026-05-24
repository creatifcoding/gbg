/**
 * Work Order Events — ISA-95 Level 3 Work Order Lifecycle
 *
 * Defines 11 operational events for work order lifecycle management:
 * - WorkOrderCreated: Initial work order creation
 * - WorkOrderSubmitted: Submitted for approval
 * - WorkOrderApproved: Approved to proceed
 * - WorkOrderRejected: Rejected with reason
 * - WorkOrderStarted: Execution started
 * - WorkOrderSuspended: Temporarily paused
 * - WorkOrderResumed: Resumed from suspension
 * - WorkOrderCompleted: Successfully finished
 * - WorkOrderFailed: Failed with error
 * - WorkOrderCancelled: Cancelled before completion
 * - WorkOrderClosed: Archived after completion
 *
 * These events are stored in EventLog (not TimescaleDB) for full audit trail.
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/work-order-events
 * @see EL-3.1-4 for work order event requirements
 * @see ISA-95/IEC 62264 for operations management
 * @see FDA 21 CFR Part 11 for electronic records compliance
 */

import { Schema } from 'effect'
import {
  WorkOrderId,
  TaskInstanceId,
  WorkflowDefinitionId,
  PropagationId,
} from '../../identifiers'
import {
  WorkOrderPriority,
  WorkOrderOutcome,
  SuspensionReason,
  WorkOrderFinalStatus,
} from '../../work-orders'
import { BaseOperationalEvent } from '../base'

// =============================================================================
// WorkOrderCreated — Initial Work Order Creation
// =============================================================================

/**
 * WorkOrderCreated event.
 *
 * Emitted when a new work order is created. The work order starts
 * in 'created' (draft) state.
 *
 * @example
 * ```typescript
 * const event = new WorkOrderCreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'user-123',
 *   entityId: workOrderId as AssetId,
 *   entityType: 'workcell',
 *   workOrderId,
 *   templateId: Option.some(workflowDefId),
 *   priority: 'normal',
 *   scheduledStart: Option.some(scheduledDate),
 *   assignedTo: Option.none(),
 *   title: 'Monthly PM - Line 1',
 *   description: Option.some('Scheduled preventive maintenance'),
 * })
 * ```
 */
export class WorkOrderCreated extends BaseOperationalEvent.extend<WorkOrderCreated>(
  'WorkOrderCreated'
)({
  /** Unique work order identifier */
  workOrderId: WorkOrderId,

  /** Reference to workflow template (optional) */
  templateId: Schema.optionalWith(WorkflowDefinitionId, { as: 'Option' }),

  /** Priority level for scheduling */
  priority: WorkOrderPriority,

  /** Scheduled start time (optional) */
  scheduledStart: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Initial assignee (optional) */
  assignedTo: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Human-readable title */
  title: Schema.NonEmptyString,

  /** Detailed description (optional) */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Custom metadata */
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
}) {}

export type WorkOrderCreatedType = typeof WorkOrderCreated.Type

// =============================================================================
// WorkOrderSubmitted — Submitted for Approval
// =============================================================================

/**
 * WorkOrderSubmitted event.
 *
 * Emitted when a work order is submitted for approval.
 * State transition: created -> submitted
 */
export class WorkOrderSubmitted extends BaseOperationalEvent.extend<WorkOrderSubmitted>(
  'WorkOrderSubmitted'
)({
  /** Work order being submitted */
  workOrderId: WorkOrderId,

  /** Optional submission comments */
  comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type WorkOrderSubmittedType = typeof WorkOrderSubmitted.Type

// =============================================================================
// WorkOrderApproved — Approved to Proceed
// =============================================================================

/**
 * WorkOrderApproved event.
 *
 * Emitted when a work order is approved for execution.
 * State transition: submitted -> approved
 */
export class WorkOrderApproved extends BaseOperationalEvent.extend<WorkOrderApproved>(
  'WorkOrderApproved'
)({
  /** Work order being approved */
  workOrderId: WorkOrderId,

  /** User who approved */
  approvedBy: Schema.NonEmptyString,

  /** Approval level (for multi-level approval workflows) */
  approvalLevel: Schema.Number.pipe(Schema.int(), Schema.positive()),

  /** Optional approval comments */
  comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type WorkOrderApprovedType = typeof WorkOrderApproved.Type

// =============================================================================
// WorkOrderRejected — Rejected with Reason
// =============================================================================

/**
 * WorkOrderRejected event.
 *
 * Emitted when a work order is rejected during approval.
 * State transition: submitted -> rejected (terminal)
 */
export class WorkOrderRejected extends BaseOperationalEvent.extend<WorkOrderRejected>(
  'WorkOrderRejected'
)({
  /** Work order being rejected */
  workOrderId: WorkOrderId,

  /** User who rejected */
  rejectedBy: Schema.NonEmptyString,

  /** Rejection reason (required for audit) */
  reason: Schema.NonEmptyString,
}) {}

export type WorkOrderRejectedType = typeof WorkOrderRejected.Type

// =============================================================================
// WorkOrderStarted — Execution Started
// =============================================================================

/**
 * WorkOrderStarted event.
 *
 * Emitted when work order execution begins.
 * State transition: approved -> started
 */
export class WorkOrderStarted extends BaseOperationalEvent.extend<WorkOrderStarted>(
  'WorkOrderStarted'
)({
  /** Work order being started */
  workOrderId: WorkOrderId,

  /** User who started execution */
  startedBy: Schema.NonEmptyString,

  /** Assigned team/user (optional) */
  assignedTo: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type WorkOrderStartedType = typeof WorkOrderStarted.Type

// =============================================================================
// WorkOrderSuspended — Temporarily Paused
// =============================================================================

/**
 * WorkOrderSuspended event.
 *
 * Emitted when a work order is temporarily suspended.
 * State transition: started|resumed -> suspended
 */
export class WorkOrderSuspended extends BaseOperationalEvent.extend<WorkOrderSuspended>(
  'WorkOrderSuspended'
)({
  /** Work order being suspended */
  workOrderId: WorkOrderId,

  /** User who suspended */
  suspendedBy: Schema.NonEmptyString,

  /** Reason for suspension (required) */
  reason: SuspensionReason,

  /** Expected resume time (optional) */
  expectedResume: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Additional notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Local propagation id minted by the WorkOrder suspend transition. Optional for legacy journal entries. */
  propagationId: Schema.optional(PropagationId),

  /** Source propagation id that caused this suspend, when Reactor-triggered. */
  causedByPropagationId: Schema.optional(PropagationId),
}) {}

export type WorkOrderSuspendedType = typeof WorkOrderSuspended.Type

// =============================================================================
// WorkOrderResumed — Resumed from Suspension
// =============================================================================

/**
 * WorkOrderResumed event.
 *
 * Emitted when a suspended work order is resumed.
 * State transition: suspended -> resumed
 */
export class WorkOrderResumed extends BaseOperationalEvent.extend<WorkOrderResumed>(
  'WorkOrderResumed'
)({
  /** Work order being resumed */
  workOrderId: WorkOrderId,

  /** User who resumed */
  resumedBy: Schema.NonEmptyString,

  /** Optional resume notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Source propagation id that caused this resume, when Reactor-triggered. */
  causedByPropagationId: Schema.optional(PropagationId),
}) {}

export type WorkOrderResumedType = typeof WorkOrderResumed.Type

// =============================================================================
// WorkOrderCompleted — Successfully Finished
// =============================================================================

/**
 * WorkOrderCompleted event.
 *
 * Emitted when a work order is successfully completed.
 * State transition: started|resumed -> completed
 */
export class WorkOrderCompleted extends BaseOperationalEvent.extend<WorkOrderCompleted>(
  'WorkOrderCompleted'
)({
  /** Work order being completed */
  workOrderId: WorkOrderId,

  /** User who completed */
  completedBy: Schema.NonEmptyString,

  /** Completion outcome */
  outcome: WorkOrderOutcome,

  /** Completion summary */
  summary: Schema.NonEmptyString,

  /** Actual duration in minutes (optional) */
  actualDurationMinutes: Schema.optionalWith(
    Schema.Number.pipe(Schema.positive()),
    { as: 'Option' }
  ),
}) {}

export type WorkOrderCompletedType = typeof WorkOrderCompleted.Type

// =============================================================================
// WorkOrderFailed — Failed with Error
// =============================================================================

/**
 * WorkOrderFailed event.
 *
 * Emitted when a work order fails during execution.
 * State transition: started|resumed -> failed
 */
export class WorkOrderFailed extends BaseOperationalEvent.extend<WorkOrderFailed>(
  'WorkOrderFailed'
)({
  /** Work order that failed */
  workOrderId: WorkOrderId,

  /** Task that caused the failure (optional) */
  failedTaskId: Schema.optionalWith(TaskInstanceId, { as: 'Option' }),

  /** Failure reason (required for audit) */
  failureReason: Schema.NonEmptyString,

  /** User who reported the failure */
  reportedBy: Schema.NonEmptyString,
}) {}

export type WorkOrderFailedType = typeof WorkOrderFailed.Type

// =============================================================================
// WorkOrderCancelled — Cancelled Before Completion
// =============================================================================

/**
 * WorkOrderCancelled event.
 *
 * Emitted when a work order is cancelled before completion.
 * State transitions: created|approved|suspended -> cancelled
 */
export class WorkOrderCancelled extends BaseOperationalEvent.extend<WorkOrderCancelled>(
  'WorkOrderCancelled'
)({
  /** Work order being cancelled */
  workOrderId: WorkOrderId,

  /** User who cancelled */
  cancelledBy: Schema.NonEmptyString,

  /** Cancellation reason (required for audit) */
  reason: Schema.NonEmptyString,

  /** Whether compensation actions are required */
  compensationRequired: Schema.optionalWith(Schema.Boolean, {
    default: () => false,
  }),
}) {}

export type WorkOrderCancelledType = typeof WorkOrderCancelled.Type

// =============================================================================
// WorkOrderClosed — Archived After Completion
// =============================================================================

/**
 * WorkOrderClosed event.
 *
 * Emitted when a work order is archived after reaching terminal state.
 * State transition: completed|failed|cancelled -> closed
 */
export class WorkOrderClosed extends BaseOperationalEvent.extend<WorkOrderClosed>(
  'WorkOrderClosed'
)({
  /** Work order being closed */
  workOrderId: WorkOrderId,

  /** User/system that closed */
  closedBy: Schema.NonEmptyString,

  /** Final archived status */
  finalStatus: WorkOrderFinalStatus,

  /** Archive reference (optional) */
  archiveReference: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Closing notes (optional) */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type WorkOrderClosedType = typeof WorkOrderClosed.Type

// =============================================================================
// Union Type for All Work Order Events
// =============================================================================

/**
 * Union of all work order events for type guards and handlers.
 */
export type WorkOrderEvent =
  | WorkOrderCreated
  | WorkOrderSubmitted
  | WorkOrderApproved
  | WorkOrderRejected
  | WorkOrderStarted
  | WorkOrderSuspended
  | WorkOrderResumed
  | WorkOrderCompleted
  | WorkOrderFailed
  | WorkOrderCancelled
  | WorkOrderClosed

/**
 * Work order event tags for type narrowing.
 */
export const WORK_ORDER_EVENT_TAGS = [
  'WorkOrderCreated',
  'WorkOrderSubmitted',
  'WorkOrderApproved',
  'WorkOrderRejected',
  'WorkOrderStarted',
  'WorkOrderSuspended',
  'WorkOrderResumed',
  'WorkOrderCompleted',
  'WorkOrderFailed',
  'WorkOrderCancelled',
  'WorkOrderClosed',
] as const

export type WorkOrderEventTag = (typeof WORK_ORDER_EVENT_TAGS)[number]
