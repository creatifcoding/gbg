/**
 * Task Instance Events — Work Order Task Lifecycle
 *
 * Defines 9 operational events for task instance lifecycle management:
 * - TaskBecameReady: Dependencies satisfied, task can start
 * - TaskStarted: Task execution began
 * - TaskProgressUpdated: Progress percentage updated
 * - TaskBlocked: Task blocked by dependency/issue
 * - TaskUnblocked: Block resolved, task can continue
 * - TaskCompleted: Task successfully finished
 * - TaskFailed: Task failed with error
 * - TaskSkipped: Task intentionally skipped
 * - TaskCompensated: Compensating action executed (saga pattern)
 *
 * These events are stored in EventLog (not TimescaleDB) for full audit trail.
 * Tasks belong to WorkOrders and can have dependencies on other tasks.
 *
 * @module @gbg/tmnl/iiot/schemas/events/operational/task-events
 * @see EL-3.9-12 for task event requirements
 * @see ADR-0012 for ES boundaries
 */

import { Schema } from 'effect'
import {
  TaskInstanceId,
  TaskDefinitionId,
  WorkOrderId,
  AssetId,
} from '../../identifiers'
import { BlockingReason, CompensationResult, TaskStatus } from '../../task-instance'
import { BaseOperationalEvent } from '../base'

// =============================================================================
// Re-export TaskDefinitionId for convenience
// =============================================================================

export { TaskDefinitionId } from '../../identifiers'

// =============================================================================
// TaskBecameReady — Dependencies Satisfied
// =============================================================================

/**
 * TaskBecameReady event.
 *
 * Emitted when all predecessor tasks have completed and the task is
 * ready to start. State transition: pending -> ready
 *
 * @example
 * ```typescript
 * const event = new TaskBecameReady({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'work-order-service',
 *   entityId: taskInstanceId as AssetId,
 *   entityType: 'device',
 *   taskInstanceId,
 *   workOrderId,
 *   taskDefinitionId,
 *   satisfiedDependencies: [predecessorTaskId1, predecessorTaskId2],
 *   previousStatus: 'pending',
 * })
 * ```
 */
export class TaskBecameReady extends BaseOperationalEvent.extend<TaskBecameReady>(
  'TaskBecameReady'
)({
  /** Task instance that became ready */
  taskInstanceId: TaskInstanceId,

  /** Parent work order */
  workOrderId: WorkOrderId,

  /** Reference to task definition in workflow template */
  taskDefinitionId: TaskDefinitionId,

  /** List of predecessor task IDs that were satisfied */
  satisfiedDependencies: Schema.Array(TaskInstanceId),

  /** Previous status before becoming ready */
  previousStatus: TaskStatus,
}) {}

export type TaskBecameReadyType = typeof TaskBecameReady.Type

// =============================================================================
// TaskStarted — Execution Began
// =============================================================================

/**
 * TaskStarted event.
 *
 * Emitted when task execution begins. State transition: ready -> started
 * or unblocked -> started
 *
 * @example
 * ```typescript
 * const event = new TaskStarted({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-001',
 *   entityId: taskInstanceId as AssetId,
 *   entityType: 'device',
 *   taskInstanceId,
 *   workOrderId,
 *   taskDefinitionId,
 *   startedBy: 'operator-001',
 *   targetAssetId: Option.some(machineId),
 *   estimatedDurationMinutes: Option.some(60),
 * })
 * ```
 */
export class TaskStarted extends BaseOperationalEvent.extend<TaskStarted>(
  'TaskStarted'
)({
  /** Task instance that started */
  taskInstanceId: TaskInstanceId,

  /** Parent work order */
  workOrderId: WorkOrderId,

  /** Reference to task definition in workflow template */
  taskDefinitionId: TaskDefinitionId,

  /** User or system that started the task */
  startedBy: Schema.NonEmptyString,

  /** Target asset for this task (machine, device, etc.) */
  targetAssetId: Schema.optionalWith(AssetId, { as: 'Option' }),

  /** Estimated duration in minutes */
  estimatedDurationMinutes: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
    as: 'Option',
  }),
}) {}

export type TaskStartedType = typeof TaskStarted.Type

// =============================================================================
// TaskProgressUpdated — Progress Percentage Updated
// =============================================================================

/**
 * TaskProgressUpdated event.
 *
 * Emitted when task progress is updated. Progress tracked 0-100%.
 * Does not change task status, only records progress.
 *
 * @example
 * ```typescript
 * const event = new TaskProgressUpdated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-001',
 *   entityId: taskInstanceId as AssetId,
 *   entityType: 'device',
 *   taskInstanceId,
 *   workOrderId,
 *   previousProgress: 25,
 *   newProgress: 50,
 *   notes: Option.some('Halfway complete'),
 *   updatedBy: 'operator-001',
 * })
 * ```
 */
export class TaskProgressUpdated extends BaseOperationalEvent.extend<TaskProgressUpdated>(
  'TaskProgressUpdated'
)({
  /** Task instance with progress update */
  taskInstanceId: TaskInstanceId,

  /** Parent work order */
  workOrderId: WorkOrderId,

  /** Previous progress percentage (0-100) */
  previousProgress: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),

  /** New progress percentage (0-100) */
  newProgress: Schema.Number.pipe(Schema.int(), Schema.between(0, 100)),

  /** Optional progress notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** User or system that updated progress */
  updatedBy: Schema.NonEmptyString,
}) {}

export type TaskProgressUpdatedType = typeof TaskProgressUpdated.Type

// =============================================================================
// TaskBlocked — Blocked by Dependency/Issue
// =============================================================================

/**
 * TaskBlocked event.
 *
 * Emitted when a task is blocked by an issue or dependency.
 * State transition: started -> blocked
 *
 * @example
 * ```typescript
 * const event = new TaskBlocked({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-001',
 *   entityId: taskInstanceId as AssetId,
 *   entityType: 'device',
 *   taskInstanceId,
 *   workOrderId,
 *   blockingReason: 'missing_parts',
 *   blockedBy: 'operator-001',
 *   details: Option.some('Waiting for replacement filter'),
 *   blockedDependencyIds: Option.none(),
 * })
 * ```
 */
export class TaskBlocked extends BaseOperationalEvent.extend<TaskBlocked>(
  'TaskBlocked'
)({
  /** Task instance that was blocked */
  taskInstanceId: TaskInstanceId,

  /** Parent work order */
  workOrderId: WorkOrderId,

  /** Reason for blocking */
  blockingReason: BlockingReason,

  /** User or system that blocked the task */
  blockedBy: Schema.NonEmptyString,

  /** Additional blocking details */
  details: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** IDs of predecessor tasks that caused the block (for predecessor_failed) */
  blockedDependencyIds: Schema.optionalWith(Schema.Array(TaskInstanceId), { as: 'Option' }),
}) {}

export type TaskBlockedType = typeof TaskBlocked.Type

// =============================================================================
// TaskUnblocked — Block Resolved
// =============================================================================

/**
 * TaskUnblocked event.
 *
 * Emitted when a block is resolved and task can continue.
 * State transition: blocked -> unblocked
 *
 * @example
 * ```typescript
 * const event = new TaskUnblocked({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-001',
 *   entityId: taskInstanceId as AssetId,
 *   entityType: 'device',
 *   taskInstanceId,
 *   workOrderId,
 *   previousBlockingReason: 'missing_parts',
 *   unblockedBy: 'operator-001',
 *   resolutionNotes: Option.some('Parts received and installed'),
 * })
 * ```
 */
export class TaskUnblocked extends BaseOperationalEvent.extend<TaskUnblocked>(
  'TaskUnblocked'
)({
  /** Task instance that was unblocked */
  taskInstanceId: TaskInstanceId,

  /** Parent work order */
  workOrderId: WorkOrderId,

  /** Previous blocking reason */
  previousBlockingReason: BlockingReason,

  /** User or system that unblocked the task */
  unblockedBy: Schema.NonEmptyString,

  /** Notes about how the block was resolved */
  resolutionNotes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type TaskUnblockedType = typeof TaskUnblocked.Type

// =============================================================================
// TaskCompleted — Successfully Finished
// =============================================================================

/**
 * TaskCompleted event.
 *
 * Emitted when a task is successfully completed.
 * State transition: started -> completed
 *
 * @example
 * ```typescript
 * const event = new TaskCompleted({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'operator-001',
 *   entityId: taskInstanceId as AssetId,
 *   entityType: 'device',
 *   taskInstanceId,
 *   workOrderId,
 *   taskDefinitionId,
 *   completedBy: 'operator-001',
 *   durationMinutes: Option.some(45),
 *   output: Option.some({ result: 'success' }),
 *   notes: Option.some('Task completed successfully'),
 * })
 * ```
 */
export class TaskCompleted extends BaseOperationalEvent.extend<TaskCompleted>(
  'TaskCompleted'
)({
  /** Task instance that was completed */
  taskInstanceId: TaskInstanceId,

  /** Parent work order */
  workOrderId: WorkOrderId,

  /** Reference to task definition in workflow template */
  taskDefinitionId: TaskDefinitionId,

  /** User or system that completed the task */
  completedBy: Schema.NonEmptyString,

  /** Actual duration in minutes */
  durationMinutes: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
    as: 'Option',
  }),

  /** Task output/result data */
  output: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { as: 'Option' }
  ),

  /** Completion notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type TaskCompletedType = typeof TaskCompleted.Type

// =============================================================================
// TaskFailed — Failed with Error
// =============================================================================

/**
 * TaskFailed event.
 *
 * Emitted when a task fails with an error.
 * State transition: started -> failed
 *
 * @example
 * ```typescript
 * const event = new TaskFailed({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'system',
 *   entityId: taskInstanceId as AssetId,
 *   entityType: 'device',
 *   taskInstanceId,
 *   workOrderId,
 *   taskDefinitionId,
 *   failedBy: 'system',
 *   error: 'Equipment malfunction: Motor overheated',
 *   errorCode: Option.some('ERR-MOT-001'),
 *   retryable: true,
 *   retryCount: 0,
 * })
 * ```
 */
export class TaskFailed extends BaseOperationalEvent.extend<TaskFailed>(
  'TaskFailed'
)({
  /** Task instance that failed */
  taskInstanceId: TaskInstanceId,

  /** Parent work order */
  workOrderId: WorkOrderId,

  /** Reference to task definition in workflow template */
  taskDefinitionId: TaskDefinitionId,

  /** User or system that recorded the failure */
  failedBy: Schema.NonEmptyString,

  /** Error message describing the failure */
  error: Schema.NonEmptyString,

  /** Optional error code for categorization */
  errorCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Whether the task is retryable */
  retryable: Schema.Boolean,

  /** Number of retry attempts made */
  retryCount: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
}) {}

export type TaskFailedType = typeof TaskFailed.Type

// =============================================================================
// TaskSkipped — Intentionally Skipped
// =============================================================================

/**
 * TaskSkipped event.
 *
 * Emitted when a task is intentionally skipped.
 * State transition: pending|ready -> skipped
 *
 * @example
 * ```typescript
 * const event = new TaskSkipped({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'supervisor-001',
 *   entityId: taskInstanceId as AssetId,
 *   entityType: 'device',
 *   taskInstanceId,
 *   workOrderId,
 *   taskDefinitionId,
 *   skippedBy: 'supervisor-001',
 *   reason: 'Equipment already calibrated within tolerance',
 *   approvedBy: Option.some('manager-001'),
 * })
 * ```
 */
export class TaskSkipped extends BaseOperationalEvent.extend<TaskSkipped>(
  'TaskSkipped'
)({
  /** Task instance that was skipped */
  taskInstanceId: TaskInstanceId,

  /** Parent work order */
  workOrderId: WorkOrderId,

  /** Reference to task definition in workflow template */
  taskDefinitionId: TaskDefinitionId,

  /** User who skipped the task */
  skippedBy: Schema.NonEmptyString,

  /** Reason for skipping */
  reason: Schema.NonEmptyString,

  /** Optional approval for skip (may require authorization) */
  approvedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type TaskSkippedType = typeof TaskSkipped.Type

// =============================================================================
// TaskCompensated — Compensating Action Executed (Saga Pattern)
// =============================================================================

/**
 * TaskCompensated event.
 *
 * Emitted when a compensating action is executed for a failed task.
 * Supports saga pattern for distributed transactions.
 * State transition: completed|failed -> compensated
 *
 * @example
 * ```typescript
 * const event = new TaskCompensated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'system',
 *   entityId: taskInstanceId as AssetId,
 *   entityType: 'device',
 *   taskInstanceId,
 *   workOrderId,
 *   taskDefinitionId,
 *   compensatedBy: 'system',
 *   compensationResult: 'success',
 *   originalError: Option.some('Task failed due to timeout'),
 *   compensationAction: 'Rolled back configuration changes',
 *   notes: Option.some('Automatic rollback completed'),
 * })
 * ```
 */
export class TaskCompensated extends BaseOperationalEvent.extend<TaskCompensated>(
  'TaskCompensated'
)({
  /** Task instance that was compensated */
  taskInstanceId: TaskInstanceId,

  /** Parent work order */
  workOrderId: WorkOrderId,

  /** Reference to task definition in workflow template */
  taskDefinitionId: TaskDefinitionId,

  /** User or system that executed compensation */
  compensatedBy: Schema.NonEmptyString,

  /** Result of the compensation action */
  compensationResult: CompensationResult,

  /** Original error that triggered compensation */
  originalError: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Description of the compensating action taken */
  compensationAction: Schema.NonEmptyString,

  /** Additional notes about the compensation */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}

export type TaskCompensatedType = typeof TaskCompensated.Type

// =============================================================================
// Union Type for All Task Events
// =============================================================================

/**
 * Union of all task events for type guards and handlers.
 */
export type TaskEvent =
  | TaskBecameReady
  | TaskStarted
  | TaskProgressUpdated
  | TaskBlocked
  | TaskUnblocked
  | TaskCompleted
  | TaskFailed
  | TaskSkipped
  | TaskCompensated

/**
 * Task event tags for type narrowing.
 */
export const TASK_EVENT_TAGS = [
  'TaskBecameReady',
  'TaskStarted',
  'TaskProgressUpdated',
  'TaskBlocked',
  'TaskUnblocked',
  'TaskCompleted',
  'TaskFailed',
  'TaskSkipped',
  'TaskCompensated',
] as const

export type TaskEventTag = (typeof TASK_EVENT_TAGS)[number]
