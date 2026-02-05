/**
 * WorkOrderTransitionModel - Effect SQL Model for Work Order State Transitions
 *
 * Normalized transition table for FDA 21 CFR Part 11 audit trail compliance.
 * Each row represents a single state transition with full audit metadata.
 *
 * Design rationale: Normalized table (NOT JSONB array) because:
 * 1. FDA 21 CFR Part 11 requires immutable, queryable audit trails
 * 2. Better indexing for temporal queries ("What transitions happened between X and Y?")
 * 3. Referential integrity via FK to work_orders
 * 4. No document size growth concerns for long-running work orders
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { WorkOrderId } from '../../schemas/identifiers'
import { WorkOrderStatus } from '../../schemas/work-orders'

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Work Order Transition Model
 *
 * Represents a single state transition in the work order lifecycle.
 *
 * PK: id (auto-generated UUID)
 * FK: workOrderId -> iiot.work_orders(id) ON DELETE CASCADE
 *
 * Index: (work_order_id, transitioned_at) for chronological queries
 */
export class WorkOrderTransitionModel extends Model.Class<WorkOrderTransitionModel>(
  'WorkOrderTransitionModel'
)({
  // ==========================================================================
  // Primary Key
  // ==========================================================================
  /** Auto-generated UUID */
  id: Model.Generated(Schema.String),

  // ==========================================================================
  // Foreign Key
  // ==========================================================================
  /** Reference to parent work order */
  workOrderId: WorkOrderId,

  // ==========================================================================
  // State Transition
  // ==========================================================================
  /** State before transition */
  fromState: WorkOrderStatus,

  /** State after transition */
  toState: WorkOrderStatus,

  // ==========================================================================
  // Audit Metadata
  // ==========================================================================
  /**
   * Timestamp of transition.
   * Uses Model.Generated(Schema.DateFromSelf) because:
   * 1. Model.Generated excludes field from insert type (DB generates via DEFAULT NOW())
   * 2. Schema.DateFromSelf handles native Date objects from pg driver
   * 3. FDA 21 CFR Part 11 requires tamper-proof server-generated timestamps
   */
  transitionedAt: Model.Generated(Schema.DateFromSelf),

  /** User who performed the transition (FDA requirement) */
  transitionedBy: Model.FieldOption(Schema.String),

  /** Reason/justification for transition (FDA requirement for some transitions) */
  reason: Model.FieldOption(Schema.String),
}) {}
