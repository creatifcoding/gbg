/**
 * Work Order Domain Schemas
 *
 * Defines the core WorkOrder entity and supporting types for FDA-compliant
 * work order lifecycle management per ISA-95 Level 3.
 *
 * @module
 * @see ADR-0012 for ES boundaries
 * @see ISA-95/IEC 62264 for operations management
 * @see FDA 21 CFR Part 11 for electronic records compliance
 */

import { Schema } from 'effect'
import {
  WorkOrderId,
  WorkflowDefinitionId,
  TaskInstanceId,
  AssetId,
} from './identifiers'

// =============================================================================
// Work Order Status (State Machine)
// =============================================================================

/**
 * Work order lifecycle states per ISA-95 operations management.
 *
 * State machine:
 * ```
 * created --> submitted --> approved --> started --> completed --> closed
 *     |            |            |            |            |
 *     v            v            v            v            v
 * cancelled    rejected    cancelled    suspended    failed
 *                                           |            |
 *                                           v            v
 *                                        resumed      closed
 * ```
 */
export const WorkOrderStatus = Schema.Literal(
  'created',
  'submitted',
  'approved',
  'rejected',
  'started',
  'suspended',
  'resumed',
  'completed',
  'failed',
  'cancelled',
  'closed'
)
export type WorkOrderStatus = Schema.Schema.Type<typeof WorkOrderStatus>

/**
 * Work order priority levels for scheduling.
 */
export const WorkOrderPriority = Schema.Literal(
  'low',
  'normal',
  'high',
  'urgent',
  'emergency'
)
export type WorkOrderPriority = Schema.Schema.Type<typeof WorkOrderPriority>

/**
 * Work order completion outcome.
 */
export const WorkOrderOutcome = Schema.Literal(
  'success',
  'partial',
  'failed',
  'cancelled'
)
export type WorkOrderOutcome = Schema.Schema.Type<typeof WorkOrderOutcome>

/**
 * Reason for work order suspension.
 */
export const SuspensionReason = Schema.Literal(
  'awaiting_parts',
  'awaiting_approval',
  'awaiting_personnel',
  'equipment_unavailable',
  'safety_hold',
  'quality_hold',
  'scheduling_conflict',
  'external_dependency',
  'other'
)
export type SuspensionReason = Schema.Schema.Type<typeof SuspensionReason>

/**
 * Final status for closed work orders (archival).
 */
export const WorkOrderFinalStatus = Schema.Literal(
  'completed_success',
  'completed_partial',
  'failed',
  'cancelled_before_start',
  'cancelled_during_execution'
)
export type WorkOrderFinalStatus = Schema.Schema.Type<typeof WorkOrderFinalStatus>

// =============================================================================
// Work Order Type
// =============================================================================

/**
 * Type of work order per ISA-95.
 */
export const WorkOrderType = Schema.Literal(
  'preventive_maintenance',
  'corrective_maintenance',
  'emergency_repair',
  'calibration',
  'inspection',
  'installation',
  'modification',
  'decommissioning',
  'production',
  'changeover',
  'cleaning',
  'other'
)
export type WorkOrderType = Schema.Schema.Type<typeof WorkOrderType>

// =============================================================================
// State Transition Validation
// =============================================================================

/**
 * Valid state transitions for work orders.
 */
const validTransitions: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  created: ['submitted', 'cancelled'],
  submitted: ['approved', 'rejected'],
  approved: ['started', 'cancelled'],
  rejected: [], // Terminal state (requires new work order)
  started: ['suspended', 'completed', 'failed'],
  suspended: ['resumed', 'cancelled'],
  resumed: ['suspended', 'completed', 'failed'], // Same as 'started'
  completed: ['closed'],
  failed: ['closed'],
  cancelled: ['closed'],
  closed: [], // Terminal state
}

/**
 * Check if a state transition is valid.
 */
export const isValidWorkOrderTransition = (
  from: WorkOrderStatus,
  to: WorkOrderStatus
): boolean => validTransitions[from].includes(to)

/**
 * Get valid next states from current state.
 */
export const getValidNextStates = (
  current: WorkOrderStatus
): readonly WorkOrderStatus[] => validTransitions[current]

// =============================================================================
// Work Order Transition (Audit Trail)
// =============================================================================

/**
 * Work order state transition record.
 * Used for audit trails and FDA 21 CFR Part 11 compliance reporting.
 *
 * This class is defined before WorkOrder to enable embedding in the
 * WorkOrder's transitions array.
 */
export class WorkOrderTransition extends Schema.TaggedClass<WorkOrderTransition>()('WorkOrderTransition', {
  workOrderId: WorkOrderId,
  fromState: WorkOrderStatus,
  toState: WorkOrderStatus,
  transitionedAt: Schema.DateTimeUtc,
  transitionedBy: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
}) {}

// =============================================================================
// Work Order Entity
// =============================================================================

/**
 * Work Order entity - ISA-95 Level 3 operations management.
 *
 * Represents a unit of work to be performed on assets, with full lifecycle
 * tracking for FDA 21 CFR Part 11 compliance.
 *
 * @example
 * ```typescript
 * const wo = new WorkOrder({
 *   id: 'WO-2026-00001' as WorkOrderId,
 *   workflowDefinitionId: 'WF-pm-001' as WorkflowDefinitionId,
 *   workflowVersion: '1.0.0',
 *   title: 'Monthly PM - Line 1',
 *   description: 'Scheduled preventive maintenance',
 *   type: 'preventive_maintenance',
 *   priority: 'normal',
 *   status: 'created',
 *   createdBy: 'user-123',
 *   createdAt: new Date(),
 * })
 *
 * if (wo.canTransitionTo('submitted')) {
 *   // Submit for approval
 * }
 * ```
 */
export class WorkOrder extends Schema.TaggedClass<WorkOrder>()('WorkOrder', {
  /** Unique work order identifier */
  id: WorkOrderId,

  /** Reference to workflow template */
  workflowDefinitionId: WorkflowDefinitionId,

  /** Semantic version of workflow at creation time */
  workflowVersion: Schema.String,

  /** Human-readable title */
  title: Schema.NonEmptyString,

  /** Detailed description */
  description: Schema.String,

  /** Type of work order */
  type: WorkOrderType,

  /** Priority for scheduling */
  priority: WorkOrderPriority,

  /** Current lifecycle status */
  status: WorkOrderStatus,

  /** User who created the work order */
  createdBy: Schema.String,

  /** Creation timestamp */
  createdAt: Schema.DateTimeUtc,

  /** Scheduled start time (optional) */
  scheduledStart: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Due date (optional) */
  dueDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Actual start time (set when started) */
  actualStart: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Actual end time (set when completed/failed) */
  actualEnd: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Parent work order ID (for nested workflows) */
  parentWorkOrderId: Schema.optionalWith(WorkOrderId, { as: 'Option' }),

  /** Primary asset being worked on */
  primaryAssetId: Schema.optionalWith(AssetId, { as: 'Option' }),

  /** Assigned user/team (set after approval) */
  assignedTo: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Completion outcome (set when completed) */
  outcome: Schema.optionalWith(WorkOrderOutcome, { as: 'Option' }),

  /** Summary notes (set on completion/failure) */
  summary: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Failed task ID (set on failure) */
  failedTaskId: Schema.optionalWith(TaskInstanceId, { as: 'Option' }),

  /** Failure reason (set on failure) */
  failureReason: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Suspension reason (set when suspended) */
  suspensionReason: Schema.optionalWith(SuspensionReason, { as: 'Option' }),

  /** Expected resume time (set when suspended) */
  expectedResume: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Cancellation reason (set when cancelled) */
  cancellationReason: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Whether compensation is required on cancellation */
  compensationRequired: Schema.optionalWith(Schema.Boolean, { default: () => false }),

  /** Final archived status (set when closed) */
  finalStatus: Schema.optionalWith(WorkOrderFinalStatus, { as: 'Option' }),

  /** Extensible metadata */
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),

  /**
   * Append-only state transition history for FDA 21 CFR Part 11 audit trail.
   * Each transition records who, when, from/to states, and optional reason.
   * This is embedded within the WorkOrder for complete audit visibility.
   */
  transitions: Schema.optionalWith(Schema.Array(WorkOrderTransition), {
    default: () => [],
  }),
}) {
  /**
   * Check if the work order is in an active (non-terminal) state.
   */
  isActive(): boolean {
    return !['rejected', 'closed'].includes(this.status)
  }

  /**
   * Check if the work order is executable (started or resumed).
   */
  isExecuting(): boolean {
    return ['started', 'resumed'].includes(this.status)
  }

  /**
   * Check if the work order is in a terminal state.
   */
  isTerminal(): boolean {
    return ['rejected', 'closed'].includes(this.status)
  }

  /**
   * Check if the work order can transition to a new state.
   */
  canTransitionTo(newStatus: WorkOrderStatus): boolean {
    return isValidWorkOrderTransition(this.status, newStatus)
  }

  /**
   * Get valid next states from current state.
   */
  getValidNextStates(): readonly WorkOrderStatus[] {
    return getValidNextStates(this.status)
  }

  /**
   * Check if the work order requires approval.
   */
  requiresApproval(): boolean {
    return this.status === 'submitted'
  }

  /**
   * Check if the work order is overdue.
   */
  isOverdue(now: Date = new Date()): boolean {
    if (this.dueDate._tag === 'None') return false
    if (this.isTerminal()) return false
    return now > new Date(this.dueDate.value.epochMillis)
  }
}

// =============================================================================
// Command Parameter Schemas
// =============================================================================

/** Parameters for creating a new work order */
export const CreateWorkOrderParams = Schema.Struct({
  workflowDefinitionId: WorkflowDefinitionId,
  title: Schema.NonEmptyString,
  description: Schema.String,
  type: WorkOrderType,
  priority: WorkOrderPriority,
  scheduledStart: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  dueDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  parentWorkOrderId: Schema.optionalWith(WorkOrderId, { as: 'Option' }),
  primaryAssetId: Schema.optionalWith(AssetId, { as: 'Option' }),
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
})
export type CreateWorkOrderParams = Schema.Schema.Type<typeof CreateWorkOrderParams>

/** Parameters for submitting a work order for approval */
export const SubmitWorkOrderParams = Schema.Struct({
  workOrderId: WorkOrderId,
  comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type SubmitWorkOrderParams = Schema.Schema.Type<typeof SubmitWorkOrderParams>

/** Parameters for approving a work order */
export const ApproveWorkOrderParams = Schema.Struct({
  workOrderId: WorkOrderId,
  approvalLevel: Schema.Number,
  comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type ApproveWorkOrderParams = Schema.Schema.Type<typeof ApproveWorkOrderParams>

/** Parameters for rejecting a work order */
export const RejectWorkOrderParams = Schema.Struct({
  workOrderId: WorkOrderId,
  reason: Schema.NonEmptyString,
})
export type RejectWorkOrderParams = Schema.Schema.Type<typeof RejectWorkOrderParams>

/** Parameters for starting a work order */
export const StartWorkOrderParams = Schema.Struct({
  workOrderId: WorkOrderId,
  assignedTo: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type StartWorkOrderParams = Schema.Schema.Type<typeof StartWorkOrderParams>

/** Parameters for suspending a work order */
export const SuspendWorkOrderParams = Schema.Struct({
  workOrderId: WorkOrderId,
  reason: SuspensionReason,
  expectedResume: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type SuspendWorkOrderParams = Schema.Schema.Type<typeof SuspendWorkOrderParams>

/** Parameters for resuming a work order */
export const ResumeWorkOrderParams = Schema.Struct({
  workOrderId: WorkOrderId,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type ResumeWorkOrderParams = Schema.Schema.Type<typeof ResumeWorkOrderParams>

/** Parameters for completing a work order */
export const CompleteWorkOrderParams = Schema.Struct({
  workOrderId: WorkOrderId,
  outcome: WorkOrderOutcome,
  summary: Schema.String,
})
export type CompleteWorkOrderParams = Schema.Schema.Type<typeof CompleteWorkOrderParams>

/** Parameters for failing a work order */
export const FailWorkOrderParams = Schema.Struct({
  workOrderId: WorkOrderId,
  failedTaskId: Schema.optionalWith(TaskInstanceId, { as: 'Option' }),
  failureReason: Schema.NonEmptyString,
})
export type FailWorkOrderParams = Schema.Schema.Type<typeof FailWorkOrderParams>

/** Parameters for cancelling a work order */
export const CancelWorkOrderParams = Schema.Struct({
  workOrderId: WorkOrderId,
  reason: Schema.NonEmptyString,
  compensationRequired: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type CancelWorkOrderParams = Schema.Schema.Type<typeof CancelWorkOrderParams>

/** Parameters for closing a work order */
export const CloseWorkOrderParams = Schema.Struct({
  workOrderId: WorkOrderId,
  finalStatus: WorkOrderFinalStatus,
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type CloseWorkOrderParams = Schema.Schema.Type<typeof CloseWorkOrderParams>

// =============================================================================
// Query Parameter Schemas
// =============================================================================

/** Parameters for querying work orders */
export const WorkOrderQueryParams = Schema.Struct({
  status: Schema.optionalWith(Schema.Array(WorkOrderStatus), { as: 'Option' }),
  type: Schema.optionalWith(Schema.Array(WorkOrderType), { as: 'Option' }),
  priority: Schema.optionalWith(Schema.Array(WorkOrderPriority), { as: 'Option' }),
  assignedTo: Schema.optionalWith(Schema.String, { as: 'Option' }),
  primaryAssetId: Schema.optionalWith(AssetId, { as: 'Option' }),
  createdAfter: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  createdBefore: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  dueBefore: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  includeOverdue: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  limit: Schema.optionalWith(Schema.Number, { default: () => 50 }),
  offset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
})
export type WorkOrderQueryParams = Schema.Schema.Type<typeof WorkOrderQueryParams>

// =============================================================================
// Work Order History (for Temporal Queries)
// =============================================================================

/**
 * Work order state at a specific point in time.
 * Used for temporal queries: "What was the work order state at time T?"
 */
export class WorkOrderAtTime extends Schema.TaggedClass<WorkOrderAtTime>()('WorkOrderAtTime', {
  workOrder: WorkOrder,
  /** The point in time this represents */
  asOf: Schema.DateTimeUtc,
  /** Was this reconstructed from events? */
  fromReplay: Schema.Boolean,
}) {}
