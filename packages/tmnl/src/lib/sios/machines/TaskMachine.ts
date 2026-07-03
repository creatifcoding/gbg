/**
 * TaskMachine — Effect Machine for the 7-state Task lifecycle.
 *
 * Handles suspension (night shift), evidence gates (quality checkpoints),
 * blocking (material/access), and cancellation.
 *
 * @module sios/machines/TaskMachine
 */

import { Schema, Effect, pipe, Option, DateTime } from 'effect'
import { Machine } from '@effect/experimental'
import type { TaskStateShape } from '../state/TaskState'
import type { SiosFeatureFlagsShape } from '../infrastructure/feature-flags'
import { Task, CreateTaskParams } from '../schemas/task'
import { Evidence } from '../schemas/value-objects'
import type { TaskId, WorkerId } from '../schemas/identifiers'
import {
  canStart,
  canSuspend,
  canResume,
  canRequestEvidence,
  canSubmitEvidence,
  canComplete,
  canBlock,
  canUnblock,
  canCancel,
  type TaskStateNode,
} from './graphs/task-graph'

// =============================================================================
// Internal Errors
// =============================================================================

export class MachineTaskNotFoundError extends Schema.TaggedError<MachineTaskNotFoundError>()(
  'MachineTaskNotFoundError',
  { taskId: Schema.String }
) {}

export class MachineTaskTransitionError extends Schema.TaggedError<MachineTaskTransitionError>()(
  'MachineTaskTransitionError',
  {
    taskId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  }
) {}

export class MachineTaskCreateError extends Schema.TaggedError<MachineTaskCreateError>()(
  'MachineTaskCreateError',
  { message: Schema.String }
) {}

// =============================================================================
// Internal Requests
// =============================================================================

export class InternalCreateTask extends Schema.TaggedRequest<InternalCreateTask>()(
  'InternalCreateTask',
  { failure: MachineTaskCreateError, success: Task, payload: { params: CreateTaskParams } }
) {}

export class InternalGetTask extends Schema.TaggedRequest<InternalGetTask>()(
  'InternalGetTask',
  { failure: MachineTaskNotFoundError, success: Task, payload: { taskId: Schema.String } }
) {}

export class InternalStartTask extends Schema.TaggedRequest<InternalStartTask>()(
  'InternalStartTask',
  {
    failure: Schema.Union(MachineTaskNotFoundError, MachineTaskTransitionError),
    success: Task,
    payload: { taskId: Schema.String },
  }
) {}

export class InternalSuspendTask extends Schema.TaggedRequest<InternalSuspendTask>()(
  'InternalSuspendTask',
  {
    failure: Schema.Union(MachineTaskNotFoundError, MachineTaskTransitionError),
    success: Task,
    payload: { taskId: Schema.String, reason: Schema.optional(Schema.String) },
  }
) {}

export class InternalResumeTask extends Schema.TaggedRequest<InternalResumeTask>()(
  'InternalResumeTask',
  {
    failure: Schema.Union(MachineTaskNotFoundError, MachineTaskTransitionError),
    success: Task,
    payload: { taskId: Schema.String },
  }
) {}

export class InternalBlockTask extends Schema.TaggedRequest<InternalBlockTask>()(
  'InternalBlockTask',
  {
    failure: Schema.Union(MachineTaskNotFoundError, MachineTaskTransitionError),
    success: Task,
    payload: { taskId: Schema.String, reason: Schema.NonEmptyString },
  }
) {}

export class InternalUnblockTask extends Schema.TaggedRequest<InternalUnblockTask>()(
  'InternalUnblockTask',
  {
    failure: Schema.Union(MachineTaskNotFoundError, MachineTaskTransitionError),
    success: Task,
    payload: { taskId: Schema.String },
  }
) {}

export class InternalRequestEvidence extends Schema.TaggedRequest<InternalRequestEvidence>()(
  'InternalRequestEvidence',
  {
    failure: Schema.Union(MachineTaskNotFoundError, MachineTaskTransitionError),
    success: Task,
    payload: { taskId: Schema.String },
  }
) {}

export class InternalCompleteTask extends Schema.TaggedRequest<InternalCompleteTask>()(
  'InternalCompleteTask',
  {
    failure: Schema.Union(MachineTaskNotFoundError, MachineTaskTransitionError),
    success: Task,
    payload: {
      taskId: Schema.String,
      actualQty: Schema.Number,
      actualHours: Schema.Number,
      evidence: Schema.optional(Schema.Array(Evidence)),
      notes: Schema.optional(Schema.String),
    },
  }
) {}

export class InternalCancelTask extends Schema.TaggedRequest<InternalCancelTask>()(
  'InternalCancelTask',
  {
    failure: Schema.Union(MachineTaskNotFoundError, MachineTaskTransitionError),
    success: Task,
    payload: { taskId: Schema.String, reason: Schema.NonEmptyString },
  }
) {}

// =============================================================================
// Machine State
// =============================================================================

export interface TaskMachineState {
  readonly mode: TaskStateNode
}

export interface TaskMachineDeps {
  readonly state: TaskStateShape
  readonly flags: SiosFeatureFlagsShape
}

// =============================================================================
// Transition Helper
// =============================================================================

const getTask = (state: TaskStateShape, taskId: string) =>
  state.get(taskId as TaskId).pipe(
    Effect.catchAll(() =>
      Effect.fail(new MachineTaskNotFoundError({ taskId }))
    )
  )

const failTransition = (taskId: string, from: string, to: string, msg: string) =>
  Effect.fail(new MachineTaskTransitionError({
    taskId, fromState: from, toState: to, message: msg,
  }))

// =============================================================================
// Machine Factory
// =============================================================================

export const makeTaskMachine = (deps: TaskMachineDeps) =>
  Machine.make(
    (_input: void, previous?: TaskMachineState) =>
      Effect.gen(function* () {
        const { state } = deps
        const initialState: TaskMachineState = previous ?? { mode: 'pending' }

        return pipe(
          Machine.procedures.make(initialState),

          // CREATE
          Machine.procedures.add<InternalCreateTask>()(
            'InternalCreateTask',
            ({ request }) =>
              Effect.gen(function* () {
                const task = yield* state.create(request.params).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineTaskCreateError({ message: `Create task failed: ${String(e)}` }))
                  )
                )
                yield* Effect.logInfo(`[TaskMachine] Created Task ${task.id}`)
                return [task, { mode: 'pending' as TaskStateNode }] as const
              })
          ),

          // GET
          Machine.procedures.add<InternalGetTask>()(
            'InternalGetTask',
            ({ request }) =>
              Effect.gen(function* () {
                const task = yield* getTask(state, request.taskId)
                return [task, { mode: task.status as TaskStateNode }] as const
              })
          ),

          // START (pending → active)
          Machine.procedures.add<InternalStartTask>()(
            'InternalStartTask',
            ({ request }) =>
              Effect.gen(function* () {
                const task = yield* getTask(state, request.taskId)
                if (!canStart(task.status as TaskStateNode)) {
                  return yield* failTransition(request.taskId, task.status, 'active', 'Task must be pending to start')
                }
                const now = yield* DateTime.now
                const updated = new Task({
                  ...task,
                  status: 'active',
                  startedAt: Option.some(now),
                  updatedAt: Option.some(now),
                })
                yield* state.set(updated)
                yield* Effect.logInfo(`[TaskMachine] Task ${request.taskId} started`)
                return [updated, { mode: 'active' as TaskStateNode }] as const
              })
          ),

          // SUSPEND (active → suspended)
          Machine.procedures.add<InternalSuspendTask>()(
            'InternalSuspendTask',
            ({ request }) =>
              Effect.gen(function* () {
                const task = yield* getTask(state, request.taskId)
                if (!canSuspend(task.status as TaskStateNode)) {
                  return yield* failTransition(request.taskId, task.status, 'suspended', 'Task must be active to suspend')
                }
                const now = yield* DateTime.now
                const updated = new Task({
                  ...task,
                  status: 'suspended',
                  suspendedAt: Option.some(now),
                  updatedAt: Option.some(now),
                })
                yield* state.set(updated)
                yield* Effect.logInfo(`[TaskMachine] Task ${request.taskId} suspended`)
                return [updated, { mode: 'suspended' as TaskStateNode }] as const
              })
          ),

          // RESUME (suspended → active)
          Machine.procedures.add<InternalResumeTask>()(
            'InternalResumeTask',
            ({ request }) =>
              Effect.gen(function* () {
                const task = yield* getTask(state, request.taskId)
                if (!canResume(task.status as TaskStateNode)) {
                  return yield* failTransition(request.taskId, task.status, 'active', 'Task must be suspended to resume')
                }
                const now = yield* DateTime.now
                const updated = new Task({
                  ...task,
                  status: 'active',
                  suspendedAt: Option.none(),
                  updatedAt: Option.some(now),
                })
                yield* state.set(updated)
                yield* Effect.logInfo(`[TaskMachine] Task ${request.taskId} resumed`)
                return [updated, { mode: 'active' as TaskStateNode }] as const
              })
          ),

          // BLOCK (active → blocked)
          Machine.procedures.add<InternalBlockTask>()(
            'InternalBlockTask',
            ({ request }) =>
              Effect.gen(function* () {
                const task = yield* getTask(state, request.taskId)
                if (!canBlock(task.status as TaskStateNode)) {
                  return yield* failTransition(request.taskId, task.status, 'blocked', 'Task must be active to block')
                }
                const now = yield* DateTime.now
                const updated = new Task({
                  ...task,
                  status: 'blocked',
                  blockedReason: Option.some(request.reason),
                  blockedSince: Option.some(now),
                  updatedAt: Option.some(now),
                })
                yield* state.set(updated)
                yield* Effect.logInfo(`[TaskMachine] Task ${request.taskId} blocked: ${request.reason}`)
                return [updated, { mode: 'blocked' as TaskStateNode }] as const
              })
          ),

          // UNBLOCK (blocked → active)
          Machine.procedures.add<InternalUnblockTask>()(
            'InternalUnblockTask',
            ({ request }) =>
              Effect.gen(function* () {
                const task = yield* getTask(state, request.taskId)
                if (!canUnblock(task.status as TaskStateNode)) {
                  return yield* failTransition(request.taskId, task.status, 'active', 'Task must be blocked to unblock')
                }
                const now = yield* DateTime.now
                const updated = new Task({
                  ...task,
                  status: 'active',
                  blockedReason: Option.none(),
                  blockedSince: Option.none(),
                  updatedAt: Option.some(now),
                })
                yield* state.set(updated)
                yield* Effect.logInfo(`[TaskMachine] Task ${request.taskId} unblocked`)
                return [updated, { mode: 'active' as TaskStateNode }] as const
              })
          ),

          // REQUEST EVIDENCE (active → needs_evidence)
          Machine.procedures.add<InternalRequestEvidence>()(
            'InternalRequestEvidence',
            ({ request }) =>
              Effect.gen(function* () {
                const task = yield* getTask(state, request.taskId)
                if (!canRequestEvidence(task.status as TaskStateNode)) {
                  return yield* failTransition(request.taskId, task.status, 'needs_evidence', 'Task must be active to request evidence')
                }
                const now = yield* DateTime.now
                const updated = new Task({
                  ...task,
                  status: 'needs_evidence',
                  updatedAt: Option.some(now),
                })
                yield* state.set(updated)
                yield* Effect.logInfo(`[TaskMachine] Task ${request.taskId} awaiting evidence`)
                return [updated, { mode: 'needs_evidence' as TaskStateNode }] as const
              })
          ),

          // COMPLETE (active → done OR needs_evidence → done)
          Machine.procedures.add<InternalCompleteTask>()(
            'InternalCompleteTask',
            ({ request }) =>
              Effect.gen(function* () {
                const task = yield* getTask(state, request.taskId)
                const currentState = task.status as TaskStateNode

                // If task requires evidence and is active, must go through needs_evidence first
                if (task.requiresEvidence && currentState === 'active') {
                  return yield* failTransition(
                    request.taskId, currentState, 'done',
                    'Task requires evidence. Transition to needs_evidence first, then submit evidence to complete.'
                  )
                }

                // Can complete from active (no evidence required) or needs_evidence (evidence submitted)
                if (!canComplete(currentState) && !canSubmitEvidence(currentState)) {
                  return yield* failTransition(
                    request.taskId, currentState, 'done',
                    `Cannot complete task in state '${currentState}'`
                  )
                }

                const now = yield* DateTime.now
                const updated = new Task({
                  ...task,
                  status: 'done',
                  actualQty: request.actualQty,
                  actualHours: request.actualHours,
                  evidence: request.evidence ? [...task.evidence, ...request.evidence] : task.evidence,
                  notes: request.notes ? Option.some(request.notes) : task.notes,
                  completedAt: Option.some(now),
                  updatedAt: Option.some(now),
                })
                yield* state.set(updated)
                yield* Effect.logInfo(`[TaskMachine] Task ${request.taskId} completed (qty: ${request.actualQty}, hrs: ${request.actualHours})`)
                return [updated, { mode: 'done' as TaskStateNode }] as const
              })
          ),

          // CANCEL
          Machine.procedures.add<InternalCancelTask>()(
            'InternalCancelTask',
            ({ request }) =>
              Effect.gen(function* () {
                const task = yield* getTask(state, request.taskId)
                if (!canCancel(task.status as TaskStateNode)) {
                  return yield* failTransition(request.taskId, task.status, 'cancelled', `Cannot cancel task in state '${task.status}'`)
                }
                const now = yield* DateTime.now
                const updated = new Task({
                  ...task,
                  status: 'cancelled',
                  notes: Option.some(`Cancelled: ${request.reason}`),
                  updatedAt: Option.some(now),
                })
                yield* state.set(updated)
                yield* Effect.logInfo(`[TaskMachine] Task ${request.taskId} cancelled: ${request.reason}`)
                return [updated, { mode: 'cancelled' as TaskStateNode }] as const
              })
          ),
        )
      })
  )

export type TaskMachine = ReturnType<typeof makeTaskMachine>
