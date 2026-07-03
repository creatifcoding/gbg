/**
 * Issue Entity Schema
 *
 * Field issues — quality problems, safety concerns, design conflicts,
 * material shortages, access restrictions, coordination failures.
 *
 * Lifecycle: open → assigned → in_progress → resolved → verified → closed
 *            + wont_fix (from in_progress)
 *            + closed (from open, for duplicates/invalids)
 *
 * @module sios/schemas/issue
 */

import { Schema, Option } from 'effect'
import { IssueId, ProjectId, ZoneId, WorkPackageId, WorkerId } from '../identifiers'
import { Evidence } from '../value-objects'
import { BaseSiosFields } from '../common'

// =============================================================================
// Enums
// =============================================================================

export const IssueStatus = Schema.Literal(
  'open',
  'assigned',
  'in_progress',
  'resolved',
  'verified',
  'closed',
  'wont_fix'
)
export type IssueStatus = typeof IssueStatus.Type

export const IssueSeverity = Schema.Literal('critical', 'high', 'medium', 'low')
export type IssueSeverity = typeof IssueSeverity.Type

export const IssueCategory = Schema.Literal(
  'safety',
  'quality',
  'design',
  'material',
  'access',
  'coordination',
  'equipment',
  'environmental',
  'other'
)
export type IssueCategory = typeof IssueCategory.Type

// =============================================================================
// Issue Entity — TaggedClass
// =============================================================================

export class Issue extends Schema.TaggedClass<Issue>()('Issue', {
  id: IssueId,
  projectId: ProjectId,
  zoneId: Schema.optionalWith(ZoneId, { as: 'Option' }),
  workPackageId: Schema.optionalWith(WorkPackageId, { as: 'Option' }),

  title: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  status: IssueStatus,
  severity: IssueSeverity,
  category: IssueCategory,

  /** Who reported the issue */
  reportedBy: Schema.NonEmptyString,
  /** Who is assigned to resolve it */
  assignedTo: Schema.optionalWith(WorkerId, { as: 'Option' }),

  /** Evidence (photos, documents, etc.) */
  evidence: Schema.Array(Evidence),

  /** SLA deadline for resolution */
  slaDeadline: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  /** When the issue was resolved */
  resolvedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  /** When the resolution was verified */
  verifiedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Resolution notes */
  resolution: Schema.optionalWith(Schema.String, { as: 'Option' }),

  ...BaseSiosFields,
}) {
  /** Is the issue still open (not resolved/closed/wont_fix)? */
  isOpen(): boolean {
    return (
      this.status === 'open' ||
      this.status === 'assigned' ||
      this.status === 'in_progress'
    )
  }

  /** Has this issue breached its SLA deadline? */
  isPastSLA(): boolean {
    if (Option.isNone(this.slaDeadline)) return false
    const now = new Date()
    return new Date(this.slaDeadline.value.toString()) < now
  }

  /** Hours remaining until SLA breach (negative if past) */
  hoursUntilSLA(): number | null {
    if (Option.isNone(this.slaDeadline)) return null
    const now = new Date()
    const deadline = new Date(this.slaDeadline.value.toString())
    return (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
  }

  /** Is this issue in a terminal state? */
  isTerminal(): boolean {
    return this.status === 'closed' || this.status === 'wont_fix'
  }

  /** Is this a safety issue? (always highest priority) */
  isSafetyIssue(): boolean {
    return this.category === 'safety'
  }
}

// =============================================================================
// Create Params
// =============================================================================

export const CreateIssueParams = Schema.Struct({
  projectId: ProjectId,
  zoneId: Schema.optional(ZoneId),
  workPackageId: Schema.optional(WorkPackageId),
  title: Schema.NonEmptyString,
  description: Schema.NonEmptyString,
  severity: IssueSeverity,
  category: IssueCategory,
  reportedBy: Schema.NonEmptyString,
  assignedTo: Schema.optional(WorkerId),
  evidence: Schema.optional(Schema.Array(Evidence)),
  slaDeadline: Schema.optional(Schema.DateTimeUtc),
})
export type CreateIssueParams = typeof CreateIssueParams.Type
