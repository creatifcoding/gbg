/**
 * Task Instance Schemas
 *
 * Defines task instances within work orders - the atomic units of work
 * that make up a work order's execution plan.
 *
 * @module
 * @see ADR-0012 for ES boundaries
 * @see ISA-95 Work Definition for task structure
 */

import { Schema } from 'effect'
import { TaskInstanceId, WorkOrderId, AssetId } from './identifiers'

// =============================================================================
// Task Status (State Machine)
// =============================================================================

/**
 * Task instance lifecycle states.
 *
 * State machine:
 * ```
 * pending --> ready --> started --> completed
 *               |          |            |
 *               v          v            v
 *            skipped    blocked      failed
 *                          |            |
 *                          v            v
 *                       unblocked   compensated
 * ```
 */
export const TaskStatus = Schema.Literal(
  'pending',     // Waiting for dependencies
  'ready',       // Dependencies satisfied, can start
  'started',     // Execution in progress
  'blocked',     // Blocked by issue/dependency
  'unblocked',   // Block resolved, can continue
  'completed',   // Successfully completed
  'failed',      // Failed with error
  'skipped',     // Conditionally skipped
  'compensated'  // Rollback executed
)
export type TaskStatus = Schema.Schema.Type<typeof TaskStatus>

/**
 * Reason for task being blocked.
 */
export const BlockingReason = Schema.Literal(
  'missing_parts',
  'missing_tools',
  'missing_personnel',
  'equipment_fault',
  'safety_issue',
  'quality_issue',
  'awaiting_approval',
  'external_dependency',
  'predecessor_failed',
  'other'
)
export type BlockingReason = Schema.Schema.Type<typeof BlockingReason>

/**
 * Result of compensation (rollback) execution.
 */
export const CompensationResult = Schema.Literal(
  'success',
  'partial',
  'failed',
  'not_applicable'
)
export type CompensationResult = Schema.Schema.Type<typeof CompensationResult>

/**
 * Type of task within a workflow.
 */
export const TaskType = Schema.Literal(
  'manual',          // Requires human execution
  'automated',       // Machine-executed
  'inspection',      // Quality check
  'approval',        // Approval gate
  'documentation',   // Record keeping
  'verification',    // Verification step
  'setup',           // Equipment setup
  'cleanup',         // Post-work cleanup
  'transport',       // Material movement
  'other'
)
export type TaskType = Schema.Schema.Type<typeof TaskType>

// =============================================================================
// State Transition Validation
// =============================================================================

const validTransitions: Record<TaskStatus, readonly TaskStatus[]> = {
  pending: ['ready', 'skipped'],
  ready: ['started', 'skipped'],
  started: ['completed', 'failed', 'blocked'],
  blocked: ['unblocked', 'failed'],
  unblocked: ['started'], // Returns to started
  completed: ['compensated'], // Only via explicit rollback
  failed: ['compensated'],
  skipped: [], // Terminal
  compensated: [], // Terminal
}

export const isValidTaskTransition = (
  from: TaskStatus,
  to: TaskStatus
): boolean => validTransitions[from].includes(to)

// =============================================================================
// Task Instance Entity
// =============================================================================

/**
 * Task Instance - atomic unit of work within a work order.
 *
 * Represents a single step in a work order's execution plan, with
 * progress tracking, dependency management, and compensation support.
 */
export class TaskInstance extends Schema.TaggedClass<TaskInstance>()('TaskInstance', {
  /** Unique task instance identifier */
  id: TaskInstanceId,

  /** Parent work order */
  workOrderId: WorkOrderId,

  /** Reference to task definition in workflow template */
  taskDefinitionId: Schema.String,

  /** Human-readable name */
  name: Schema.NonEmptyString,

  /** Task description/instructions */
  description: Schema.String,

  /** Type of task */
  type: TaskType,

  /** Sequence order within work order */
  sequenceNumber: Schema.Number,

  /** Current status */
  status: TaskStatus,

  /** Progress percentage (0-100) */
  progress: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),

  /** IDs of tasks that must complete before this one */
  predecessorTaskIds: Schema.Array(TaskInstanceId),

  /** Assigned user (for manual tasks) */
  assignedTo: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Target asset for this task */
  targetAssetId: Schema.optionalWith(AssetId, { as: 'Option' }),

  /** Estimated duration in minutes */
  estimatedDuration: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Actual start time */
  startedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Actual completion time */
  completedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** User who started the task */
  startedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** User who completed the task */
  completedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Blocking reason (if blocked) */
  blockingReason: Schema.optionalWith(BlockingReason, { as: 'Option' }),

  /** Blocking details/notes */
  blockingDetails: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Error details (if failed) */
  error: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Whether the task is retryable on failure */
  retryable: Schema.optionalWith(Schema.Boolean, { default: () => true }),

  /** Skip reason (if skipped) */
  skipReason: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** User who skipped the task */
  skippedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Compensation result (if compensated) */
  compensationResult: Schema.optionalWith(CompensationResult, { as: 'Option' }),

  /** Task output/result data */
  output: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    as: 'Option',
  }),

  /** Progress notes/updates */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Extensible metadata */
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    default: () => ({}),
  }),
}) {
  /**
   * Check if task is actionable (ready or unblocked).
   */
  isActionable(): boolean {
    return ['ready', 'unblocked'].includes(this.status)
  }

  /**
   * Check if task is in progress.
   */
  isInProgress(): boolean {
    return this.status === 'started'
  }

  /**
   * Check if task is complete (success or skip).
   */
  isComplete(): boolean {
    return ['completed', 'skipped'].includes(this.status)
  }

  /**
   * Check if task is terminal (no further transitions).
   */
  isTerminal(): boolean {
    return ['skipped', 'compensated'].includes(this.status)
  }

  /**
   * Check if task can transition to a new status.
   */
  canTransitionTo(newStatus: TaskStatus): boolean {
    return isValidTaskTransition(this.status, newStatus)
  }
}

// =============================================================================
// Command Parameter Schemas
// =============================================================================

/** Parameters for updating task progress */
export const UpdateTaskProgressParams = Schema.Struct({
  taskInstanceId: TaskInstanceId,
  progress: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type UpdateTaskProgressParams = Schema.Schema.Type<typeof UpdateTaskProgressParams>

/** Parameters for blocking a task */
export const BlockTaskParams = Schema.Struct({
  taskInstanceId: TaskInstanceId,
  reason: BlockingReason,
  details: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type BlockTaskParams = Schema.Schema.Type<typeof BlockTaskParams>

/** Parameters for completing a task */
export const CompleteTaskParams = Schema.Struct({
  taskInstanceId: TaskInstanceId,
  output: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.Unknown }), {
    as: 'Option',
  }),
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
export type CompleteTaskParams = Schema.Schema.Type<typeof CompleteTaskParams>

/** Parameters for failing a task */
export const FailTaskParams = Schema.Struct({
  taskInstanceId: TaskInstanceId,
  error: Schema.NonEmptyString,
  retryable: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})
export type FailTaskParams = Schema.Schema.Type<typeof FailTaskParams>

/** Parameters for skipping a task */
export const SkipTaskParams = Schema.Struct({
  taskInstanceId: TaskInstanceId,
  reason: Schema.NonEmptyString,
})
export type SkipTaskParams = Schema.Schema.Type<typeof SkipTaskParams>
