/**
 * Approval Events - Approval Workflow State Transitions
 *
 * Defines 6 operational events for approval workflow lifecycle management:
 * - ApprovalRequested: Approval request created
 * - ApprovalGranted: Request approved
 * - ApprovalRejected: Request denied with reason
 * - ApprovalEscalated: Escalated to higher authority
 * - ApprovalCompleted: Approval process finished
 * - ApprovalExpired: Request expired without action
 *
 * These events are stored in EventLog (not TimescaleDB) for full audit trail.
 * Approvals are tied to WorkOrders and other approvalable entities with
 * multi-level approval chains, time-based expiration, and escalation paths.
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/approval-events
 * @see ADR-0012 for ES boundaries (approvals ARE event sourced)
 */

import { Schema } from 'effect'
import { BaseOperationalEvent } from '../base'

// =============================================================================
// Branded Identifiers for Approval Domain
// =============================================================================

/**
 * Approval request identifier (e.g., 'APREQ-abc123')
 * Distinct from ApprovalId in identifiers.ts - this is for the request itself.
 */
export const ApprovalRequestId = Schema.String.pipe(Schema.brand('ApprovalRequestId'))
export type ApprovalRequestId = Schema.Schema.Type<typeof ApprovalRequestId>

/**
 * Approver identifier - user/role who can approve (e.g., 'USER-001', 'ROLE-SUPERVISOR')
 */
export const ApproverId = Schema.String.pipe(Schema.brand('ApproverId'))
export type ApproverId = Schema.Schema.Type<typeof ApproverId>

/**
 * Approval level (1, 2, 3, etc.) - positive integer representing hierarchy depth.
 * Level 1 is the first/lowest approval, higher levels indicate more senior authority.
 */
export const ApprovalLevel = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand('ApprovalLevel')
)
export type ApprovalLevel = Schema.Schema.Type<typeof ApprovalLevel>

/**
 * Approval status enum for tracking request lifecycle.
 */
export const ApprovalStatus = Schema.Literal(
  'pending',    // Awaiting action
  'approved',   // Request approved
  'rejected',   // Request denied
  'escalated',  // Escalated to higher authority
  'expired'     // Request expired without action
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/ApprovalStatus',
    description: 'Status of an approval request in its lifecycle',
  })
)
export type ApprovalStatus = Schema.Schema.Type<typeof ApprovalStatus>

/**
 * Escalation reason - why the approval was escalated.
 */
export const EscalationReason = Schema.Literal(
  'timeout',    // No response within SLA
  'manual',     // Manually escalated by user
  'threshold',  // Value exceeded escalation threshold
  'policy'      // Policy-mandated escalation
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/events/EscalationReason',
    description: 'Reason for escalating an approval request',
  })
)
export type EscalationReason = Schema.Schema.Type<typeof EscalationReason>

// =============================================================================
// ApprovalRequested - Initial Request Created
// =============================================================================

/**
 * ApprovalRequested event.
 *
 * Emitted when an approval request is created. The request starts in 'pending'
 * state and may have an expiration time.
 *
 * @example
 * ```typescript
 * const event = new ApprovalRequested({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-001',
 *   entityId: workOrderId as AssetId,
 *   entityType: 'machine',
 *   approvalRequestId,
 *   requestedBy: userId,
 *   requiredLevel: 1,
 *   requestType: 'work_order_approval',
 *   subjectId: workOrderId,
 *   subjectType: 'WorkOrder',
 *   expiresAt: Option.some(expiry),
 *   justification: Option.some('Urgent maintenance'),
 *   metadata: Option.none(),
 * })
 * ```
 */
export class ApprovalRequested extends BaseOperationalEvent.extend<ApprovalRequested>(
  'ApprovalRequested'
)({
  /** Unique identifier for this approval request */
  approvalRequestId: ApprovalRequestId,

  /** User/system that initiated the request */
  requestedBy: ApproverId,

  /** Minimum approval level required */
  requiredLevel: ApprovalLevel,

  /** Type of approval request (e.g., 'work_order_approval', 'config_change') */
  requestType: Schema.NonEmptyString,

  /** ID of the subject being approved (WorkOrder, Config, etc.) */
  subjectId: Schema.NonEmptyString,

  /** Type of the subject being approved */
  subjectType: Schema.NonEmptyString,

  /** When the request expires (optional time-based expiration) */
  expiresAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Justification for the approval request */
  justification: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Custom metadata for the request */
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),
}) {}

export type ApprovalRequestedType = typeof ApprovalRequested.Type

// =============================================================================
// ApprovalGranted - Request Approved
// =============================================================================

/**
 * ApprovalGranted event.
 *
 * Emitted when an approver grants approval at their level.
 * May include conditions and time-limited validity.
 */
export class ApprovalGranted extends BaseOperationalEvent.extend<ApprovalGranted>(
  'ApprovalGranted'
)({
  /** Approval request being granted */
  approvalRequestId: ApprovalRequestId,

  /** Approver who granted the approval */
  approvedBy: ApproverId,

  /** Level at which approval was granted */
  approvalLevel: ApprovalLevel,

  /** Conditions attached to the approval (optional) */
  conditions: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Approval valid until (optional time limit) */
  validUntil: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Comments from the approver */
  comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type ApprovalGrantedType = typeof ApprovalGranted.Type

// =============================================================================
// ApprovalRejected - Request Denied
// =============================================================================

/**
 * ApprovalRejected event.
 *
 * Emitted when an approver rejects the request. Includes reason
 * and whether the request can be resubmitted.
 */
export class ApprovalRejected extends BaseOperationalEvent.extend<ApprovalRejected>(
  'ApprovalRejected'
)({
  /** Approval request being rejected */
  approvalRequestId: ApprovalRequestId,

  /** Approver who rejected the request */
  rejectedBy: ApproverId,

  /** Level at which rejection occurred */
  approvalLevel: ApprovalLevel,

  /** Reason for rejection (required for audit) */
  reason: Schema.NonEmptyString,

  /** Whether the requester can resubmit with modifications */
  canResubmit: Schema.Boolean,

  /** Suggested changes for resubmission (optional) */
  suggestedChanges: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type ApprovalRejectedType = typeof ApprovalRejected.Type

// =============================================================================
// ApprovalEscalated - Escalated to Higher Authority
// =============================================================================

/**
 * ApprovalEscalated event.
 *
 * Emitted when an approval request is escalated to a higher level.
 * Can be triggered by timeout, manual escalation, or policy.
 */
export class ApprovalEscalated extends BaseOperationalEvent.extend<ApprovalEscalated>(
  'ApprovalEscalated'
)({
  /** Approval request being escalated */
  approvalRequestId: ApprovalRequestId,

  /** Level from which escalation occurred */
  fromLevel: ApprovalLevel,

  /** Level to which request is escalated */
  toLevel: ApprovalLevel,

  /** User/role the request is escalated to */
  escalatedTo: ApproverId,

  /** Reason for escalation */
  escalationReason: EscalationReason,

  /** Seconds elapsed before escalation */
  elapsedSeconds: Schema.Number.pipe(Schema.nonNegative()),

  /** Previous approvers who had the request */
  previousApprovers: Schema.Array(Schema.String),

  /** Notes about the escalation */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type ApprovalEscalatedType = typeof ApprovalEscalated.Type

// =============================================================================
// ApprovalCompleted - Approval Process Finished
// =============================================================================

/**
 * ApprovalCompleted event.
 *
 * Emitted when the approval process reaches a terminal state
 * (all levels approved or rejected at any level).
 */
export class ApprovalCompleted extends BaseOperationalEvent.extend<ApprovalCompleted>(
  'ApprovalCompleted'
)({
  /** Approval request that completed */
  approvalRequestId: ApprovalRequestId,

  /** Final status of the approval process */
  finalStatus: Schema.Literal('approved', 'rejected', 'expired'),

  /** Total levels required for full approval */
  totalLevelsRequired: ApprovalLevel,

  /** Levels that were completed before termination */
  totalLevelsCompleted: ApprovalLevel,

  /** List of approvers who participated */
  approvers: Schema.Array(Schema.String),

  /** Total duration from request to completion (seconds) */
  totalDurationSeconds: Schema.Number.pipe(Schema.nonNegative()),

  /** Final notes about the process */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type ApprovalCompletedType = typeof ApprovalCompleted.Type

// =============================================================================
// ApprovalExpired - Request Expired Without Action
// =============================================================================

/**
 * ApprovalExpired event.
 *
 * Emitted when an approval request expires without receiving
 * all required approvals.
 */
export class ApprovalExpired extends BaseOperationalEvent.extend<ApprovalExpired>(
  'ApprovalExpired'
)({
  /** Approval request that expired */
  approvalRequestId: ApprovalRequestId,

  /** When the request expired */
  expiredAt: Schema.DateTimeUtc,

  /** Last level that was active when expiration occurred */
  lastActiveLevel: ApprovalLevel,

  /** Approvers who had pending action when expired */
  pendingApprovers: Schema.Array(Schema.String),

  /** Whether the request will be auto-renewed */
  autoRenew: Schema.Boolean,

  /** Notes about the expiration */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type ApprovalExpiredType = typeof ApprovalExpired.Type

// =============================================================================
// Union Type for All Approval Events
// =============================================================================

/**
 * Union of all approval events for type guards and handlers.
 */
export type ApprovalEvent =
  | ApprovalRequested
  | ApprovalGranted
  | ApprovalRejected
  | ApprovalEscalated
  | ApprovalCompleted
  | ApprovalExpired

/**
 * Approval event tags for type narrowing.
 */
export const APPROVAL_EVENT_TAGS = [
  'ApprovalRequested',
  'ApprovalGranted',
  'ApprovalRejected',
  'ApprovalEscalated',
  'ApprovalCompleted',
  'ApprovalExpired',
] as const

export type ApprovalEventTag = (typeof APPROVAL_EVENT_TAGS)[number]
