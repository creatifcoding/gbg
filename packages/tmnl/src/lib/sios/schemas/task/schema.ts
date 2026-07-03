/**
 * Task Entity Schema
 *
 * The atomic unit of field work. A foreman assigns it, a crew member completes it.
 *   "Install conveyor frame CV-03, Section A–B"
 *   "Terminate Panel PNL-07, circuits 1–24"
 *   "I/O checkout: Zone C photo-eyes PE-001 through PE-048"
 *
 * 7-state lifecycle:
 *   pending → active → suspended → active → needs_evidence → done
 *                   → blocked → active
 *                   → cancelled
 *
 * Belongs to exactly one WorkPackage (discipline, zone, project).
 * TimeEntries accumulate against tasks.
 * Evidence captured before completion when checkpoint requires it.
 *
 * @module sios/schemas/task
 */

import { Schema, Option } from 'effect'
import { TaskId, WorkPackageId, WorkerId } from '../identifiers'
import { Evidence } from '../value-objects'
import { BaseSiosFields } from '../common'

// =============================================================================
// Task Status — 7-state lifecycle
// =============================================================================

export const TaskStatus = Schema.Literal(
  'pending',         // queued, not started
  'active',          // in progress
  'suspended',       // paused (night shift end, access revoked, crew rotated)
  'needs_evidence',  // quality gate — photo/measurement/sign-off required before done
  'done',            // completed with evidence
  'blocked',         // waiting on materials, drawings, access, preceding task
  'cancelled'
).pipe(
  Schema.annotations({
    identifier: 'sios/TaskStatus',
    description: 'Task lifecycle state — 7 states with suspension and evidence gates',
  })
)
export type TaskStatus = typeof TaskStatus.Type

// =============================================================================
// Task Priority
// =============================================================================

export const TaskPriority = Schema.Literal(
  'critical',  // blocks commissioning
  'high',      // on critical path
  'normal',    // standard scheduled work
  'low'        // can be deferred
).pipe(
  Schema.annotations({
    identifier: 'sios/TaskPriority',
    description: 'Task urgency level',
  })
)
export type TaskPriority = typeof TaskPriority.Type

// =============================================================================
// Task Entity — TaggedClass with lifecycle methods
// =============================================================================

export class Task extends Schema.TaggedClass<Task>()('Task', {
  id: TaskId,
  workPackageId: WorkPackageId,

  /** Foreman-readable: "Install CV-03 frame, Bay 4–6" */
  title: Schema.NonEmptyString,
  /** Detailed instructions or scope clarification */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  status: TaskStatus,
  priority: TaskPriority,

  /** Who is doing this task */
  assignedTo: Schema.optionalWith(WorkerId, { as: 'Option' }),

  // ── Progress ──────────────────────────────────────────────────────
  /**
   * Quantity of work this task represents in the WP's progress unit.
   * A WP tracking linear_meters might have tasks of 10m, 15m, 8m.
   */
  plannedQty: Schema.Number,
  /** How much of that quantity is actually complete */
  actualQty: Schema.Number,
  /** Estimated hours to complete */
  plannedHours: Schema.Number,
  /** Actual hours expended (sum of TimeEntries) */
  actualHours: Schema.Number,

  // ── Evidence ──────────────────────────────────────────────────────
  /** Photos, measurements, sign-offs captured during/after work */
  evidence: Schema.Array(Evidence),
  /**
   * If true, task transitions through needs_evidence before done.
   * Enforced by the state machine — active cannot go directly to done.
   */
  requiresEvidence: Schema.Boolean,

  // ── Lifecycle timestamps ──────────────────────────────────────────
  startedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  completedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  suspendedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  // ── Blocking ──────────────────────────────────────────────────────
  blockedReason: Schema.optionalWith(Schema.String, { as: 'Option' }),
  blockedSince: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  // ── Cost tracking ─────────────────────────────────────────────────
  /** Override cost code (falls back to WP default if absent) */
  costCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

  // ── Ordering ──────────────────────────────────────────────────────
  /** Sequence within the work package for daily plan ordering */
  sortOrder: Schema.Number,

  // ── Notes ──────────────────────────────────────────────────────────
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),

  // ── Base fields ───────────────────────────────────────────────────
  ...BaseSiosFields,
}) {
  // ─────────────────────────────────────────────────────────────────
  // Lifecycle Methods
  // ─────────────────────────────────────────────────────────────────

  /** Is this task in a terminal state? (done or cancelled) */
  isTerminal(): boolean {
    return this.status === 'done' || this.status === 'cancelled'
  }

  /** Is this task currently blocked? */
  isBlocked(): boolean {
    return this.status === 'blocked'
  }

  /** Is this task awaiting evidence before it can complete? */
  isAwaitingEvidence(): boolean {
    return this.status === 'needs_evidence'
  }

  /** Is this task currently active (in progress)? */
  isActive(): boolean {
    return this.status === 'active'
  }

  /** Has a worker been assigned? */
  isAssigned(): boolean {
    return Option.isSome(this.assignedTo)
  }

  /** Hours remaining estimate (clamped to 0) */
  hoursRemaining(): number {
    return Math.max(0, this.plannedHours - this.actualHours)
  }

  /** Percent complete by quantity */
  percentComplete(): number {
    return this.plannedQty === 0 ? 0 : (this.actualQty / this.plannedQty) * 100
  }

  /** Does this task have any evidence attached? */
  hasEvidence(): boolean {
    return this.evidence.length > 0
  }

  /** How many evidence items are attached? */
  evidenceCount(): number {
    return this.evidence.length
  }
}

// =============================================================================
// Create Params
// =============================================================================

export const CreateTaskParams = Schema.Struct({
  workPackageId: WorkPackageId,
  title: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
  priority: Schema.optionalWith(TaskPriority, { default: () => 'normal' as const }),
  plannedQty: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  plannedHours: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  requiresEvidence: Schema.optionalWith(Schema.Boolean, { default: () => false }),
  costCode: Schema.optional(Schema.String),
  sortOrder: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  assignedTo: Schema.optional(WorkerId),
})
export type CreateTaskParams = typeof CreateTaskParams.Type

// =============================================================================
// Update Params
// =============================================================================

export const UpdateTaskParams = Schema.Struct({
  id: TaskId,
  title: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  priority: Schema.optionalWith(TaskPriority, { as: 'Option' }),
  assignedTo: Schema.optionalWith(WorkerId, { as: 'Option' }),
  costCode: Schema.optionalWith(Schema.String, { as: 'Option' }),
  sortOrder: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type UpdateTaskParams = typeof UpdateTaskParams.Type
