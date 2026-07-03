/**
 * WorkPackage Entity Schema
 *
 * The EVM rollup boundary. A discipline-scoped container of work within a zone.
 * Zone A's mechanical work, Zone A's electrical work, Zone A's controls work
 * are each separate WorkPackages with own crew, progress metric, and CPI/SPI.
 *
 * This is the entity that enables "Zone C electrical is at CPI 0.78" visibility.
 *
 * Uses Schema.TaggedClass — adds _tag field + instance methods.
 * Instance methods make the WorkPackage a live EVM calculator, not a data bag.
 *
 * API (verified via effect-docs):
 *   Schema.TaggedClass<Self>()("Tag", { fields })
 *   Schema.optionalWith(schema, { as: 'Option' }) → Option<T>
 *   Schema.Literal(...values) → union literal type
 *
 * @module sios/schemas/work-package
 */

import { Schema, Option } from 'effect'
import { WorkPackageId, ZoneId, ProjectId, CrewId } from '../identifiers'
import { BaseSiosFields } from '../common'

// =============================================================================
// Work Package Status — lifecycle enum
// =============================================================================

export const WorkPackageStatus = Schema.Literal(
  'planned',     // in the schedule, not started
  'active',      // crew assigned, work in progress
  'suspended',   // paused (access, materials, etc.)
  'complete',    // all tasks done
  'closed'       // EVM finalised, archived
).pipe(
  Schema.annotations({
    identifier: 'sios/WorkPackageStatus',
    description: 'WorkPackage lifecycle state',
  })
)
export type WorkPackageStatus = typeof WorkPackageStatus.Type

// =============================================================================
// Discipline — the trades JCK fields
// =============================================================================

export const Discipline = Schema.Literal(
  'mechanical',     // conveyor frames, rollers, motors, alignment
  'electrical',     // cable tray, wiring, termination, panels
  'controls',       // PLC, HMI, sensors, I/O checkout
  'steelwork',      // structural steel, mezzanines, platforms
  'commissioning',  // testing, ramp-up, acceptance
  'general'         // general labour, logistics, site prep
).pipe(
  Schema.annotations({
    identifier: 'sios/Discipline',
    description: 'Trade discipline for a work package',
  })
)
export type Discipline = typeof Discipline.Type

// =============================================================================
// Progress Unit — what we're counting, varies by discipline
// =============================================================================

export const ProgressUnit = Schema.Literal(
  'linear_meters',   // conveyor runs, cable tray
  'units',           // motors, sensors, panels
  'io_points',       // I/O checkout (DI/DO/AI/AO)
  'tonnes',          // steelwork
  'cable_pulls',     // number of cable runs
  'terminations',    // wire terminations
  'percent',         // subjective (avoid where possible)
  'hours'            // labour hours (fallback)
).pipe(
  Schema.annotations({
    identifier: 'sios/ProgressUnit',
    description: 'Unit of measure for progress tracking',
  })
)
export type ProgressUnit = typeof ProgressUnit.Type

// =============================================================================
// Equipment Family — what's being installed (drives parametric models)
// =============================================================================

export const EquipmentFamily = Schema.Literal(
  // Vanderlande
  'variobelt', 'variotilttray', 'variotray', 'variostore',
  // BEUMER
  'baxorter', 'autover', 'crisplant',
  // Generic
  'belt_conveyor', 'roller_conveyor', 'spiral_conveyor',
  'crossbelt_sorter', 'tilttray_sorter', 'push_divert',
  'plc_panel', 'mcc_panel', 'field_cabinet',
  'structural_steel', 'mezzanine', 'catwalk',
  'other'
).pipe(
  Schema.annotations({
    identifier: 'sios/EquipmentFamily',
    description: 'OEM equipment type — determines parametric estimating baselines',
  })
)
export type EquipmentFamily = typeof EquipmentFamily.Type

// =============================================================================
// WorkPackage Entity — TaggedClass with EVM methods
// =============================================================================

/**
 * WorkPackage — the most important entity in SIOS.
 *
 * Instance methods make this a live EVM calculator:
 *   wp.percentComplete()   → 45.2
 *   wp.earnedValue()       → $180,000
 *   wp.cpi()               → 0.87
 *   wp.isOverBudget()      → true
 *
 * Budget is in both hours and cost, enabling dual-axis EVM.
 */
export class WorkPackage extends Schema.TaggedClass<WorkPackage>()('WorkPackage', {
  id: WorkPackageId,
  zoneId: ZoneId,
  projectId: ProjectId,

  /** Which trade owns this work */
  discipline: Discipline,
  /** Descriptive name: "Zone A — Mechanical Installation" */
  name: Schema.NonEmptyString,
  /** Equipment being installed (drives parametric model lookup) */
  equipmentFamily: Schema.optionalWith(EquipmentFamily, { as: 'Option' }),

  status: WorkPackageStatus,

  // ── Progress ──────────────────────────────────────────────────────
  /** What we're counting */
  progressUnit: ProgressUnit,
  /** How much was planned */
  plannedQty: Schema.Number,
  /** How much is actually done — updated from Task completions */
  actualQty: Schema.Number,

  // ── Budget (EVM inputs) ───────────────────────────────────────────
  /** Planned hours for this work package (contributes to PV) */
  budgetedHours: Schema.Number,
  /** Planned cost (hours × blended rate, or explicit) */
  budgetedCost: Schema.Number,
  /** Actual hours expended — sum of TimeEntries */
  actualHours: Schema.Number,
  /** Actual cost — sum of TimeEntry costs */
  actualCost: Schema.Number,

  // ── Schedule ──────────────────────────────────────────────────────
  plannedStart: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  plannedEnd: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  actualStart: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  actualEnd: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  // ── Crew ──────────────────────────────────────────────────────────
  assignedCrewId: Schema.optionalWith(CrewId, { as: 'Option' }),

  // ── Cost Code ─────────────────────────────────────────────────────
  /** Default cost code for tasks in this WP (e.g., "03.MEK.CV") */
  costCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

  // ── Base fields ───────────────────────────────────────────────────
  ...BaseSiosFields,
}) {
  // ─────────────────────────────────────────────────────────────────
  // EVM Methods — make this entity a live calculator
  // ─────────────────────────────────────────────────────────────────

  /** Physical percent complete: actualQty / plannedQty × 100 */
  percentComplete(): number {
    return this.plannedQty === 0 ? 0 : (this.actualQty / this.plannedQty) * 100
  }

  /** Earned Value: BAC × (actualQty / plannedQty) */
  earnedValue(): number {
    return this.budgetedCost * (this.plannedQty === 0 ? 0 : this.actualQty / this.plannedQty)
  }

  /** Cost Variance: EV - AC (positive = under budget) */
  costVariance(): number {
    return this.earnedValue() - this.actualCost
  }

  /** Cost Performance Index: EV / AC (>1.0 = under budget) */
  cpi(): number {
    return this.actualCost === 0 ? 0 : this.earnedValue() / this.actualCost
  }

  /** Is this WP over budget? (CPI < 1.0 with work done) */
  isOverBudget(): boolean {
    return this.actualCost > 0 && this.cpi() < 1.0
  }

  /**
   * Schedule Performance Index: EV / PV
   * Requires scheduledQtyToDate — the planned qty at this point in time.
   * SPI > 1.0 = ahead of schedule.
   */
  spi(scheduledQtyToDate: number): number {
    const pv = this.budgetedCost * (this.plannedQty === 0 ? 0 : scheduledQtyToDate / this.plannedQty)
    return pv === 0 ? 0 : this.earnedValue() / pv
  }

  /** Is this WP behind schedule? */
  isBehindSchedule(scheduledQtyToDate: number): boolean {
    return scheduledQtyToDate > 0 && this.spi(scheduledQtyToDate) < 1.0
  }

  /** Estimate at Completion: BAC / CPI */
  eac(): number {
    const c = this.cpi()
    return c > 0 ? this.budgetedCost / c : this.budgetedCost * 2
  }

  /** Estimate to Complete: EAC - AC */
  etc(): number {
    return this.eac() - this.actualCost
  }

  /** Has a crew been assigned? */
  hasCrewAssigned(): boolean {
    return Option.isSome(this.assignedCrewId)
  }

  /** Is this WP in a terminal state? */
  isTerminal(): boolean {
    return this.status === 'complete' || this.status === 'closed'
  }
}

// =============================================================================
// Create Params — what you need to create a WorkPackage
// =============================================================================

export const CreateWorkPackageParams = Schema.Struct({
  /** Slug for ID generation (will be prefixed) */
  zoneId: ZoneId,
  projectId: ProjectId,
  discipline: Discipline,
  name: Schema.NonEmptyString,
  equipmentFamily: Schema.optional(EquipmentFamily),
  progressUnit: ProgressUnit,
  plannedQty: Schema.Number,
  budgetedHours: Schema.Number,
  budgetedCost: Schema.Number,
  plannedStart: Schema.optional(Schema.DateTimeUtc),
  plannedEnd: Schema.optional(Schema.DateTimeUtc),
  costCode: Schema.optional(Schema.String),
})
export type CreateWorkPackageParams = typeof CreateWorkPackageParams.Type

// =============================================================================
// Update Params — what you can change on a WorkPackage
// =============================================================================

export const UpdateWorkPackageParams = Schema.Struct({
  id: WorkPackageId,
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),
  status: Schema.optionalWith(WorkPackageStatus, { as: 'Option' }),
  assignedCrewId: Schema.optionalWith(CrewId, { as: 'Option' }),
  costCode: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type UpdateWorkPackageParams = typeof UpdateWorkPackageParams.Type
