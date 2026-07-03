/**
 * TimeEntry Entity Schema
 *
 * Hours worked by a specific worker on a specific task.
 * Append-only — no lifecycle states, no graph, no machine.
 *
 * Feeds:
 *   - Task.actualHours (sum)
 *   - WorkPackage.actualHours + actualCost (sum)
 *   - EVM Actual Cost calculation
 *   - Parametric estimating feedback loop (historical cost per unit)
 *
 * @module sios/schemas/time-entry
 */

import { Schema } from 'effect'
import { TimeEntryId, TaskId, WorkPackageId, WorkerId } from '../identifiers'
import { BaseSiosFields } from '../common'

// =============================================================================
// Shift Pattern — when the work was done
// =============================================================================

export const ShiftPattern = Schema.Literal(
  'day',       // standard day shift
  'night',     // airport night window (typ 10pm–5am)
  'swing',     // rotating
  'extended'   // 10–12 hour shifts
).pipe(
  Schema.annotations({
    identifier: 'sios/ShiftPattern',
    description: 'Which shift pattern this time entry was worked under',
  })
)
export type ShiftPattern = typeof ShiftPattern.Type

// =============================================================================
// TimeEntry Entity — TaggedClass
// =============================================================================

export class TimeEntry extends Schema.TaggedClass<TimeEntry>()('TimeEntry', {
  id: TimeEntryId,
  taskId: TaskId,
  /** Denormalised for efficient WP-level aggregation queries */
  workPackageId: WorkPackageId,
  workerId: WorkerId,

  /** Hours worked in this entry */
  hours: Schema.Number.pipe(Schema.greaterThan(0)),

  /**
   * Cost for this entry. If absent, derive from worker.hourlyRate × hours.
   * Explicit when overtime rates, premium rates, or per diem apply.
   */
  cost: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Date the work was performed (ISO date string, not datetime) */
  workDate: Schema.DateTimeUtc,

  /** Which shift this entry belongs to */
  shiftPattern: Schema.optionalWith(ShiftPattern, { as: 'Option' }),

  /** Cost code — falls back to task → WP default chain */
  costCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Free-text notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),

  ...BaseSiosFields,
}) {
  /**
   * Derive cost from hours × rate if no explicit cost set.
   * Pure calculation — caller provides the rate.
   */
  derivedCost(hourlyRate: number): number {
    return this.cost._tag === 'Some'
      ? this.cost.value
      : this.hours * hourlyRate
  }
}

// =============================================================================
// Create Params
// =============================================================================

export const CreateTimeEntryParams = Schema.Struct({
  taskId: TaskId,
  workPackageId: WorkPackageId,
  workerId: WorkerId,
  hours: Schema.Number.pipe(Schema.greaterThan(0)),
  cost: Schema.optional(Schema.Number),
  workDate: Schema.DateTimeUtc,
  shiftPattern: Schema.optional(ShiftPattern),
  costCode: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
})
export type CreateTimeEntryParams = typeof CreateTimeEntryParams.Type
