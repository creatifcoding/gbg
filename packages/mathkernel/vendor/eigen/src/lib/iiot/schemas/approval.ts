/**
 * Approval Request Schemas
 *
 * Defines approval workflows for FDA 21 CFR Part 11 compliance,
 * supporting single and dual (4-eyes) approval patterns.
 *
 * @module
 * @see ADR-0012 for ES boundaries
 * @see FDA 21 CFR Part 11 for electronic signatures
 * @see ISO 9001 for quality management approval requirements
 */

import { Schema } from 'effect'
import { ApprovalId, WorkOrderId, TaskInstanceId } from './identifiers'

// =============================================================================
// Approval Types
// =============================================================================

/**
 * Type of approval requirement.
 *
 * - `none`: Auto-approve (no human intervention)
 * - `single`: One approver required
 * - `dual`: Two approvers required (4-eyes principle)
 * - `supervisor`: Requires supervisor role
 * - `quality`: Requires QA role
 * - `manager`: Requires manager role
 */
export const ApprovalType = Schema.Literal(
  'none',
  'single',
  'dual',
  'supervisor',
  'quality',
  'manager'
)
export type ApprovalType = Schema.Schema.Type<typeof ApprovalType>

/**
 * Final status of an approval request.
 */
export const ApprovalFinalStatus = Schema.Literal(
  'approved',
  'rejected',
  'expired',
  'cancelled'
)
export type ApprovalFinalStatus = Schema.Schema.Type<typeof ApprovalFinalStatus>

/**
 * Current status of an approval request.
 */
export const ApprovalStatus = Schema.Literal(
  'pending',
  'partially_approved',  // For dual approval - one of two received
  'approved',
  'rejected',
  'escalated',
  'expired',
  'cancelled'
)
export type ApprovalStatus = Schema.Schema.Type<typeof ApprovalStatus>

/**
 * Escalation level for approval timeouts.
 */
export const EscalationLevel = Schema.Literal(
  'none',
  'level_1',  // First escalation
  'level_2',  // Second escalation
  'level_3',  // Final escalation (e.g., plant manager)
  'auto_reject'  // Auto-reject after all escalations
)
export type EscalationLevel = Schema.Schema.Type<typeof EscalationLevel>

// =============================================================================
// Approval Request Entity
// =============================================================================

/**
 * Approval Request - gate for work order or task progression.
 *
 * Implements FDA 21 CFR Part 11 electronic signature requirements
 * with support for single and dual (4-eyes) approval patterns.
 */
export class ApprovalRequest extends Schema.TaggedClass<ApprovalRequest>()('ApprovalRequest', {
  /** Unique approval identifier */
  id: ApprovalId,

  /** Parent work order */
  workOrderId: WorkOrderId,

  /** Associated task (optional - for task-level approvals) */
  taskInstanceId: Schema.optionalWith(TaskInstanceId, { as: 'Option' }),

  /** Type of approval required */
  approvalType: ApprovalType,

  /** Current status */
  status: ApprovalStatus,

  /** List of users who can approve */
  requiredApprovers: Schema.Array(Schema.String),

  /** Number of approvals required (1 for single, 2 for dual) */
  requiredCount: Schema.Number.pipe(Schema.int(), Schema.positive()),

  /** Number of approvals received */
  approvalCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),

  /** Users who have approved */
  approvedBy: Schema.Array(Schema.String),

  /** Approval timestamps */
  approvalTimestamps: Schema.Array(Schema.DateTimeUtc),

  /** Approval comments */
  approvalComments: Schema.Array(Schema.String),

  /** User who requested the approval */
  requestedBy: Schema.String,

  /** Request timestamp */
  requestedAt: Schema.DateTimeUtc,

  /** Expiration timestamp */
  expiresAt: Schema.DateTimeUtc,

  /** Current escalation level */
  escalationLevel: EscalationLevel,

  /** Escalation history */
  escalationHistory: Schema.Array(
    Schema.Struct({
      level: EscalationLevel,
      escalatedAt: Schema.DateTimeUtc,
      newApprovers: Schema.Array(Schema.String),
      reason: Schema.String,
    })
  ),

  /** Rejection details (if rejected) */
  rejectedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
  rejectedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  rejectionReason: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Completion details */
  completedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  finalStatus: Schema.optionalWith(ApprovalFinalStatus, { as: 'Option' }),

  /** Description of what is being approved */
  description: Schema.String,

  /** Extensible metadata */
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {
  /**
   * Check if approval is still pending.
   */
  isPending(): boolean {
    return ['pending', 'partially_approved', 'escalated'].includes(this.status)
  }

  /**
   * Check if approval is complete.
   */
  isComplete(): boolean {
    return ['approved', 'rejected', 'expired', 'cancelled'].includes(this.status)
  }

  /**
   * Check if all required approvals have been received.
   */
  isFullyApproved(): boolean {
    return this.approvalCount >= this.requiredCount
  }

  /**
   * Check if the approval has expired.
   */
  isExpired(now: Date = new Date()): boolean {
    return now > new Date(this.expiresAt.epochMillis)
  }

  /**
   * Check if a user can approve this request.
   */
  canBeApprovedBy(userId: string): boolean {
    if (!this.isPending()) return false
    if (this.approvedBy.includes(userId)) return false // Already approved
    return this.requiredApprovers.includes(userId)
  }

  /**
   * Get remaining approvers needed.
   */
  getRemainingApproversNeeded(): number {
    return Math.max(0, this.requiredCount - this.approvalCount)
  }
}

// =============================================================================
// Command Parameter Schemas
// =============================================================================

/** Parameters for creating an approval request */
export const CreateApprovalParams = Schema.Struct({
  workOrderId: WorkOrderId,
  taskInstanceId: Schema.optionalWith(TaskInstanceId, { as: 'Option' }),
  approvalType: ApprovalType,
  requiredApprovers: Schema.Array(Schema.NonEmptyString),
  expiresInMinutes: Schema.optionalWith(Schema.Number, { default: () => 1440 }), // 24 hours default
  description: Schema.String,
})
export type CreateApprovalParams = Schema.Schema.Type<typeof CreateApprovalParams>

/** Parameters for granting approval */
export const GrantApprovalParams = Schema.Struct({
  approvalId: ApprovalId,
  comments: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type GrantApprovalParams = Schema.Schema.Type<typeof GrantApprovalParams>

/** Parameters for rejecting approval */
export const RejectApprovalParams = Schema.Struct({
  approvalId: ApprovalId,
  reason: Schema.NonEmptyString,
})
export type RejectApprovalParams = Schema.Schema.Type<typeof RejectApprovalParams>

/** Parameters for escalating approval */
export const EscalateApprovalParams = Schema.Struct({
  approvalId: ApprovalId,
  newApprovers: Schema.Array(Schema.NonEmptyString),
  reason: Schema.String,
})
export type EscalateApprovalParams = Schema.Schema.Type<typeof EscalateApprovalParams>
