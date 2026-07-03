/**
 * Checkpoint Entity Schema
 *
 * Quality/commissioning gate — must pass before zone handover.
 * I/O checkout, conveyor run tests, divert accuracy, SCADA integration, etc.
 *
 * Lifecycle: pending → ready → passed
 *                            → failed → pending (rework cycle)
 *                            → waived
 *
 * @module sios/schemas/checkpoint
 */

import { Schema, Option } from 'effect'
import { CheckpointId, WorkPackageId, ZoneId, WorkerId } from '../identifiers'
import { Evidence, EvidenceType } from '../value-objects'
import { BaseSiosFields } from '../common'

// =============================================================================
// Enums
// =============================================================================

export const CheckpointStatus = Schema.Literal(
  'pending',
  'ready',
  'passed',
  'failed',
  'waived'
)
export type CheckpointStatus = typeof CheckpointStatus.Type

export const CheckpointCategory = Schema.Literal(
  'io_checkout',          // Input/output point verification
  'power_on',             // First power-on test
  'conveyor_run',         // Belt/chain run test
  'divert_accuracy',      // Sort accuracy test
  'plc_logic',            // PLC program verification
  'scada_integration',    // SCADA/HMI point verification
  'network_comm',         // Network communication test
  'safety_interlock',     // E-stop, light curtain, guard verification
  'weight_calibration',   // Scale/weigher calibration
  'barcode_read_rate',    // Scanner read rate test
  'structural',           // Steel alignment, anchor inspection
  'fire_system',          // Fire suppression integration
  'acceptance',           // Final customer acceptance
  'other'
)
export type CheckpointCategory = typeof CheckpointCategory.Type

// =============================================================================
// Checklist Item
// =============================================================================

export const ChecklistItem = Schema.Struct({
  label: Schema.NonEmptyString,
  passed: Schema.Boolean,
  notes: Schema.optional(Schema.String),
})
export type ChecklistItem = typeof ChecklistItem.Type

// =============================================================================
// Checkpoint Entity — TaggedClass
// =============================================================================

export class Checkpoint extends Schema.TaggedClass<Checkpoint>()('Checkpoint', {
  id: CheckpointId,
  workPackageId: WorkPackageId,
  zoneId: Schema.optionalWith(ZoneId, { as: 'Option' }),

  name: Schema.NonEmptyString,
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
  status: CheckpointStatus,
  category: CheckpointCategory,

  /** Individual checklist items */
  checklistItems: Schema.Array(ChecklistItem),

  /** What types of evidence are required to pass? */
  requiredEvidence: Schema.Array(EvidenceType),
  /** Evidence actually collected */
  collectedEvidence: Schema.Array(Evidence),

  /** Inspector performing the checkpoint */
  inspectorId: Schema.optionalWith(WorkerId, { as: 'Option' }),

  /** Scheduled and actual completion dates */
  scheduledDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),
  completedDate: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Failure details */
  failureReason: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Waiver details */
  waiverReason: Schema.optionalWith(Schema.String, { as: 'Option' }),
  waiverApprovedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),

  ...BaseSiosFields,
}) {
  /** Has this checkpoint been completed (passed/failed/waived)? */
  isComplete(): boolean {
    return (
      this.status === 'passed' ||
      this.status === 'failed' ||
      this.status === 'waived'
    )
  }

  /** Do we have all required evidence types? */
  hasAllEvidence(): boolean {
    const collectedTypes = new Set(this.collectedEvidence.map((e) => e.type))
    return this.requiredEvidence.every((type) => collectedTypes.has(type))
  }

  /** How many checklist items failed? */
  failedItemCount(): number {
    return this.checklistItems.filter((item) => !item.passed).length
  }

  /** How many checklist items passed? */
  passedItemCount(): number {
    return this.checklistItems.filter((item) => item.passed).length
  }

  /** Percentage of checklist items passed */
  checklistProgress(): number {
    if (this.checklistItems.length === 0) return 100
    return (this.passedItemCount() / this.checklistItems.length) * 100
  }

  /** Is this a terminal state? */
  isTerminal(): boolean {
    return this.status === 'passed' || this.status === 'waived'
  }
}

// =============================================================================
// Create Params
// =============================================================================

export const CreateCheckpointParams = Schema.Struct({
  workPackageId: WorkPackageId,
  zoneId: Schema.optional(ZoneId),
  name: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
  category: CheckpointCategory,
  checklistItems: Schema.optional(Schema.Array(ChecklistItem)),
  requiredEvidence: Schema.optional(Schema.Array(EvidenceType)),
  inspectorId: Schema.optional(WorkerId),
  scheduledDate: Schema.optional(Schema.DateTimeUtc),
})
export type CreateCheckpointParams = typeof CreateCheckpointParams.Type
