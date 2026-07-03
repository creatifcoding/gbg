/**
 * TaskEntity — Effect Cluster Entity for 7-state Task lifecycle
 *
 * @module sios/entity/TaskEntity
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Task, CreateTaskParams, TaskPriority } from '../schemas/task'
import { TaskId, WorkPackageId, WorkerId } from '../schemas/identifiers'
import { Evidence } from '../schemas/value-objects'
import { TaskState } from '../state'
import { SiosFeatureFlags } from '../infrastructure'
import {
  makeTaskMachine,
  InternalCreateTask,
  InternalGetTask,
  InternalStartTask,
  InternalSuspendTask,
  InternalResumeTask,
  InternalBlockTask,
  InternalUnblockTask,
  InternalRequestEvidence,
  InternalCompleteTask,
  InternalCancelTask,
} from '../machines/TaskMachine'

// =============================================================================
// RPC Errors
// =============================================================================

export class RpcTaskNotFoundError extends Schema.TaggedError<RpcTaskNotFoundError>()(
  'RpcTaskNotFoundError',
  { taskId: TaskId }
) {}

export class RpcTaskTransitionError extends Schema.TaggedError<RpcTaskTransitionError>()(
  'RpcTaskTransitionError',
  { taskId: TaskId, message: Schema.String }
) {}

export class RpcTaskCreateError extends Schema.TaggedError<RpcTaskCreateError>()(
  'RpcTaskCreateError',
  { message: Schema.String }
) {}

// =============================================================================
// RPCs
// =============================================================================

const E = 'Task' as const

export class CreateTaskRpc extends Rpc.make(`${E}.Create`, {
  payload: CreateTaskParams,
  primaryKey: ({ workPackageId }) => workPackageId,
  success: Task,
  error: RpcTaskCreateError,
}) {}

export class GetTaskRpc extends Rpc.make(`${E}.Get`, {
  payload: Schema.Struct({ id: TaskId }),
  primaryKey: ({ id }) => id,
  success: Task,
  error: RpcTaskNotFoundError,
}) {}

export class StartTaskRpc extends Rpc.make(`${E}.Start`, {
  payload: Schema.Struct({ id: TaskId }),
  primaryKey: ({ id }) => id,
  success: Task,
  error: Schema.Union(RpcTaskNotFoundError, RpcTaskTransitionError),
}) {}

export class SuspendTaskRpc extends Rpc.make(`${E}.Suspend`, {
  payload: Schema.Struct({ id: TaskId, reason: Schema.optional(Schema.String) }),
  primaryKey: ({ id }) => id,
  success: Task,
  error: Schema.Union(RpcTaskNotFoundError, RpcTaskTransitionError),
}) {}

export class ResumeTaskRpc extends Rpc.make(`${E}.Resume`, {
  payload: Schema.Struct({ id: TaskId }),
  primaryKey: ({ id }) => id,
  success: Task,
  error: Schema.Union(RpcTaskNotFoundError, RpcTaskTransitionError),
}) {}

export class BlockTaskRpc extends Rpc.make(`${E}.Block`, {
  payload: Schema.Struct({ id: TaskId, reason: Schema.NonEmptyString }),
  primaryKey: ({ id }) => id,
  success: Task,
  error: Schema.Union(RpcTaskNotFoundError, RpcTaskTransitionError),
}) {}

export class UnblockTaskRpc extends Rpc.make(`${E}.Unblock`, {
  payload: Schema.Struct({ id: TaskId }),
  primaryKey: ({ id }) => id,
  success: Task,
  error: Schema.Union(RpcTaskNotFoundError, RpcTaskTransitionError),
}) {}

export class RequestEvidenceRpc extends Rpc.make(`${E}.RequestEvidence`, {
  payload: Schema.Struct({ id: TaskId }),
  primaryKey: ({ id }) => id,
  success: Task,
  error: Schema.Union(RpcTaskNotFoundError, RpcTaskTransitionError),
}) {}

export class CompleteTaskRpc extends Rpc.make(`${E}.Complete`, {
  payload: Schema.Struct({
    id: TaskId,
    actualQty: Schema.Number,
    actualHours: Schema.Number,
    evidence: Schema.optional(Schema.Array(Evidence)),
    notes: Schema.optional(Schema.String),
  }),
  primaryKey: ({ id }) => id,
  success: Task,
  error: Schema.Union(RpcTaskNotFoundError, RpcTaskTransitionError),
}) {}

export class CancelTaskRpc extends Rpc.make(`${E}.Cancel`, {
  payload: Schema.Struct({ id: TaskId, reason: Schema.NonEmptyString }),
  primaryKey: ({ id }) => id,
  success: Task,
  error: Schema.Union(RpcTaskNotFoundError, RpcTaskTransitionError),
}) {}

// =============================================================================
// Entity
// =============================================================================

export const TaskEntity = Entity.make(E, [
  CreateTaskRpc,
  GetTaskRpc,
  StartTaskRpc,
  SuspendTaskRpc,
  ResumeTaskRpc,
  BlockTaskRpc,
  UnblockTaskRpc,
  RequestEvidenceRpc,
  CompleteTaskRpc,
  CancelTaskRpc,
])

// =============================================================================
// Handler
// =============================================================================

export const TaskEntityHandlers = TaskEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* TaskState
    const flags = yield* SiosFeatureFlags

    const machine = makeTaskMachine({ state, flags })
    const actor = yield* Machine.boot(machine)

    return TaskEntity.of({
      [`${E}.Create`]: (env: { payload: CreateTaskParams }) =>
        actor.send(new InternalCreateTask({ params: env.payload })).pipe(
          Effect.catchTag('MachineTaskCreateError', (e) =>
            Effect.fail(new RpcTaskCreateError({ message: e.message })))
        ),

      [`${E}.Get`]: (env: { payload: { id: TaskId } }) =>
        actor.send(new InternalGetTask({ taskId: env.payload.id })).pipe(
          Effect.catchTag('MachineTaskNotFoundError', (e) =>
            Effect.fail(new RpcTaskNotFoundError({ taskId: e.taskId as TaskId })))
        ),

      [`${E}.Start`]: (env: { payload: { id: TaskId } }) =>
        actor.send(new InternalStartTask({ taskId: env.payload.id })).pipe(
          Effect.catchTags({
            MachineTaskNotFoundError: (e) => Effect.fail(new RpcTaskNotFoundError({ taskId: e.taskId as TaskId })),
            MachineTaskTransitionError: (e) => Effect.fail(new RpcTaskTransitionError({ taskId: e.taskId as TaskId, message: e.message })),
          })
        ),

      [`${E}.Suspend`]: (env: { payload: { id: TaskId; reason?: string } }) =>
        actor.send(new InternalSuspendTask({ taskId: env.payload.id, reason: env.payload.reason })).pipe(
          Effect.catchTags({
            MachineTaskNotFoundError: (e) => Effect.fail(new RpcTaskNotFoundError({ taskId: e.taskId as TaskId })),
            MachineTaskTransitionError: (e) => Effect.fail(new RpcTaskTransitionError({ taskId: e.taskId as TaskId, message: e.message })),
          })
        ),

      [`${E}.Resume`]: (env: { payload: { id: TaskId } }) =>
        actor.send(new InternalResumeTask({ taskId: env.payload.id })).pipe(
          Effect.catchTags({
            MachineTaskNotFoundError: (e) => Effect.fail(new RpcTaskNotFoundError({ taskId: e.taskId as TaskId })),
            MachineTaskTransitionError: (e) => Effect.fail(new RpcTaskTransitionError({ taskId: e.taskId as TaskId, message: e.message })),
          })
        ),

      [`${E}.Block`]: (env: { payload: { id: TaskId; reason: string } }) =>
        actor.send(new InternalBlockTask({ taskId: env.payload.id, reason: env.payload.reason })).pipe(
          Effect.catchTags({
            MachineTaskNotFoundError: (e) => Effect.fail(new RpcTaskNotFoundError({ taskId: e.taskId as TaskId })),
            MachineTaskTransitionError: (e) => Effect.fail(new RpcTaskTransitionError({ taskId: e.taskId as TaskId, message: e.message })),
          })
        ),

      [`${E}.Unblock`]: (env: { payload: { id: TaskId } }) =>
        actor.send(new InternalUnblockTask({ taskId: env.payload.id })).pipe(
          Effect.catchTags({
            MachineTaskNotFoundError: (e) => Effect.fail(new RpcTaskNotFoundError({ taskId: e.taskId as TaskId })),
            MachineTaskTransitionError: (e) => Effect.fail(new RpcTaskTransitionError({ taskId: e.taskId as TaskId, message: e.message })),
          })
        ),

      [`${E}.RequestEvidence`]: (env: { payload: { id: TaskId } }) =>
        actor.send(new InternalRequestEvidence({ taskId: env.payload.id })).pipe(
          Effect.catchTags({
            MachineTaskNotFoundError: (e) => Effect.fail(new RpcTaskNotFoundError({ taskId: e.taskId as TaskId })),
            MachineTaskTransitionError: (e) => Effect.fail(new RpcTaskTransitionError({ taskId: e.taskId as TaskId, message: e.message })),
          })
        ),

      [`${E}.Complete`]: (env: { payload: { id: TaskId; actualQty: number; actualHours: number; evidence?: typeof Evidence.Type[]; notes?: string } }) =>
        actor.send(new InternalCompleteTask({
          taskId: env.payload.id,
          actualQty: env.payload.actualQty,
          actualHours: env.payload.actualHours,
          evidence: env.payload.evidence,
          notes: env.payload.notes,
        })).pipe(
          Effect.catchTags({
            MachineTaskNotFoundError: (e) => Effect.fail(new RpcTaskNotFoundError({ taskId: e.taskId as TaskId })),
            MachineTaskTransitionError: (e) => Effect.fail(new RpcTaskTransitionError({ taskId: e.taskId as TaskId, message: e.message })),
          })
        ),

      [`${E}.Cancel`]: (env: { payload: { id: TaskId; reason: string } }) =>
        actor.send(new InternalCancelTask({ taskId: env.payload.id, reason: env.payload.reason })).pipe(
          Effect.catchTags({
            MachineTaskNotFoundError: (e) => Effect.fail(new RpcTaskNotFoundError({ taskId: e.taskId as TaskId })),
            MachineTaskTransitionError: (e) => Effect.fail(new RpcTaskTransitionError({ taskId: e.taskId as TaskId, message: e.message })),
          })
        ),
    })
  })
)
