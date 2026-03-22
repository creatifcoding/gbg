/**
 * WorkOrderModel - Effect SQL Model for WorkOrder Entity
 *
 * Derives from WorkOrder domain schema with Model-specific transforms
 * for PostgreSQL persistence.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import {
  WorkOrderId,
  WorkflowDefinitionId,
  TaskInstanceId,
  AssetId,
} from '../../schemas/identifiers'
import {
  WorkOrderType,
  WorkOrderPriority,
  WorkOrderStatus,
  WorkOrderOutcome,
  SuspensionReason,
  WorkOrderFinalStatus,
} from '../../schemas/work-orders'
import { CreatedAt, OptionalMetadata } from '../_common'

// =============================================================================
// Embedded Transition Schema for JSONB Storage
// =============================================================================

/**
 * Schema for WorkOrderTransition as stored in JSONB column.
 *
 * This is a simplified version of WorkOrderTransition for JSONB storage.
 * The pg driver returns JSONB as parsed objects, so we define the structure
 * that will be stored/retrieved.
 */
const WorkOrderTransitionJsonb = Schema.Struct({
  workOrderId: Schema.String,
  fromState: WorkOrderStatus,
  toState: WorkOrderStatus,
  /** ISO timestamp string for JSONB compatibility */
  transitionedAt: Schema.String,
  transitionedBy: Schema.optional(Schema.String),
  reason: Schema.optional(Schema.String),
})

// =============================================================================
// Model Definition
// =============================================================================

/**
 * WorkOrder Model
 *
 * Derives from WorkOrder domain schema (schemas/work-orders.ts).
 * Applies Model-specific transforms for PostgreSQL:
 * - Optional fields → Model.FieldOption (NULL ↔ Option)
 * - DateTimeUtc → Schema.DateFromSelf (pg Date objects)
 * - Metadata → Model.FieldOption (JSONB as parsed objects)
 *
 * PK: id (auto-generated WorkOrderId, e.g., "WO-2026-00001")
 * FK: workflowDefinitionId → iiot.workflow_definitions(id)
 * FK: parentWorkOrderId → iiot.work_orders(id) (self-referential)
 * FK: primaryAssetId → iiot.assets(id)
 */
export class WorkOrderModel extends Model.Class<WorkOrderModel>('WorkOrderModel')({
  // ==========================================================================
  // Primary Key
  // ==========================================================================
  id: Model.Generated(WorkOrderId),

  // ==========================================================================
  // Required Fields (direct schema reuse)
  // ==========================================================================
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

  // ==========================================================================
  // Timestamp Fields
  // ==========================================================================
  /** Creation timestamp */
  createdAt: CreatedAt,

  // ==========================================================================
  // Optional DateTime Fields (pg returns native Date objects)
  // ==========================================================================
  /** Scheduled start time */
  scheduledStart: Model.FieldOption(Schema.DateFromSelf),

  /** Due date */
  dueDate: Model.FieldOption(Schema.DateFromSelf),

  /** Actual start time (set when started) */
  actualStart: Model.FieldOption(Schema.DateFromSelf),

  /** Actual end time (set when completed/failed) */
  actualEnd: Model.FieldOption(Schema.DateFromSelf),

  /** Expected resume time (set when suspended) */
  expectedResume: Model.FieldOption(Schema.DateFromSelf),

  // ==========================================================================
  // Optional Identifier Fields
  // ==========================================================================
  /** Parent work order ID (for nested workflows) */
  parentWorkOrderId: Model.FieldOption(WorkOrderId),

  /** Primary asset being worked on */
  primaryAssetId: Model.FieldOption(AssetId),

  /** Failed task ID (set on failure) */
  failedTaskId: Model.FieldOption(TaskInstanceId),

  // ==========================================================================
  // Optional String Fields
  // ==========================================================================
  /** Assigned user/team (set after approval) */
  assignedTo: Model.FieldOption(Schema.String),

  /** Summary notes (set on completion/failure) */
  summary: Model.FieldOption(Schema.String),

  /** Failure reason (set on failure) */
  failureReason: Model.FieldOption(Schema.String),

  /** Cancellation reason (set when cancelled) */
  cancellationReason: Model.FieldOption(Schema.String),

  // ==========================================================================
  // Optional Enum Fields
  // ==========================================================================
  /** Completion outcome (set when completed) */
  outcome: Model.FieldOption(WorkOrderOutcome),

  /** Suspension reason (set when suspended) */
  suspensionReason: Model.FieldOption(SuspensionReason),

  /** Final archived status (set when closed) */
  finalStatus: Model.FieldOption(WorkOrderFinalStatus),

  // ==========================================================================
  // Boolean Fields
  // ==========================================================================
  /** Whether compensation is required on cancellation */
  compensationRequired: Schema.Boolean.pipe(Schema.propertySignature, Schema.withConstructorDefault(() => false)),

  // ==========================================================================
  // Metadata
  // ==========================================================================
  /** Extensible metadata (JSONB) */
  metadata: OptionalMetadata,

  // ==========================================================================
  // Audit Trail (FDA 21 CFR Part 11)
  // ==========================================================================
  /**
   * Append-only state transition history.
   *
   * NOTE: Transitions are stored in a NORMALIZED table (iiot.work_order_transitions)
   * not as a JSONB column. Use WorkOrderTransitionRepo to query transitions.
   *
   * This field is kept for backwards compatibility and in-memory use cases.
   * When reading from the database, it defaults to an empty array since the
   * actual transitions are in the separate table.
   *
   * @see WorkOrderTransitionRepo for database queries
   */
  transitions: Schema.optionalWith(Schema.Array(WorkOrderTransitionJsonb), {
    default: () => [],
  }),
}) {}
