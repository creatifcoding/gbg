/**
 * WorkerEntity — Machine-backed entity for Worker cert/badge lifecycle
 * @module sios/entity/WorkerEntity
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Worker, CreateWorkerParams } from '../schemas/worker'
import { WorkerId } from '../schemas/identifiers'
import { WorkerState } from '../state'
import { SiosFeatureFlags } from '../infrastructure'
import {
  makeWorkerMachine,
  InternalCreateWorker, InternalGetWorker,
  InternalGoOnLeave, InternalReturnFromLeave,
  InternalRequestBadge, InternalIssueBadge, InternalExpireBadge, InternalRenewBadge,
  InternalOffboard,
} from '../machines/WorkerMachine'

export class RpcWorkerNotFoundError extends Schema.TaggedError<RpcWorkerNotFoundError>()('RpcWorkerNotFoundError', { workerId: WorkerId }) {}
export class RpcWorkerTransitionError extends Schema.TaggedError<RpcWorkerTransitionError>()('RpcWorkerTransitionError', { workerId: WorkerId, message: Schema.String }) {}
export class RpcWorkerCreateError extends Schema.TaggedError<RpcWorkerCreateError>()('RpcWorkerCreateError', { message: Schema.String }) {}

const E = 'Worker' as const

export class CreateWorkerRpc extends Rpc.make(`${E}.Create`, { payload: CreateWorkerParams, primaryKey: ({ name }) => name, success: Worker, error: RpcWorkerCreateError }) {}
export class GetWorkerRpc extends Rpc.make(`${E}.Get`, { payload: Schema.Struct({ id: WorkerId }), primaryKey: ({ id }) => id, success: Worker, error: RpcWorkerNotFoundError }) {}
export class GoOnLeaveRpc extends Rpc.make(`${E}.GoOnLeave`, { payload: Schema.Struct({ id: WorkerId }), primaryKey: ({ id }) => id, success: Worker, error: Schema.Union(RpcWorkerNotFoundError, RpcWorkerTransitionError) }) {}
export class ReturnFromLeaveRpc extends Rpc.make(`${E}.ReturnFromLeave`, { payload: Schema.Struct({ id: WorkerId }), primaryKey: ({ id }) => id, success: Worker, error: Schema.Union(RpcWorkerNotFoundError, RpcWorkerTransitionError) }) {}
export class RequestBadgeRpc extends Rpc.make(`${E}.RequestBadge`, { payload: Schema.Struct({ id: WorkerId }), primaryKey: ({ id }) => id, success: Worker, error: Schema.Union(RpcWorkerNotFoundError, RpcWorkerTransitionError) }) {}
export class IssueBadgeRpc extends Rpc.make(`${E}.IssueBadge`, { payload: Schema.Struct({ id: WorkerId, badgeNumber: Schema.String, badgeExpiry: Schema.DateTimeUtc }), primaryKey: ({ id }) => id, success: Worker, error: Schema.Union(RpcWorkerNotFoundError, RpcWorkerTransitionError) }) {}
export class OffboardWorkerRpc extends Rpc.make(`${E}.Offboard`, { payload: Schema.Struct({ id: WorkerId }), primaryKey: ({ id }) => id, success: Worker, error: Schema.Union(RpcWorkerNotFoundError, RpcWorkerTransitionError) }) {}

export const WorkerEntity = Entity.make(E, [
  CreateWorkerRpc, GetWorkerRpc, GoOnLeaveRpc, ReturnFromLeaveRpc,
  RequestBadgeRpc, IssueBadgeRpc, OffboardWorkerRpc,
])

const mapErrors = Effect.catchTags({
  MachineWorkerNotFoundError: (e: { workerId: string }) => Effect.fail(new RpcWorkerNotFoundError({ workerId: e.workerId as WorkerId })),
  MachineWorkerTransitionError: (e: { workerId: string; message: string }) => Effect.fail(new RpcWorkerTransitionError({ workerId: e.workerId as WorkerId, message: e.message })),
})

export const WorkerEntityHandlers = WorkerEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* WorkerState
    const flags = yield* SiosFeatureFlags
    const actor = yield* Machine.boot(makeWorkerMachine({ state, flags }))
    return WorkerEntity.of({
      [`${E}.Create`]: (env: { payload: typeof CreateWorkerParams.Type }) =>
        actor.send(new InternalCreateWorker({ params: env.payload })).pipe(
          Effect.catchTag('MachineWorkerCreateError', (e) => Effect.fail(new RpcWorkerCreateError({ message: e.message })))
        ),
      [`${E}.Get`]: (env: { payload: { id: WorkerId } }) =>
        actor.send(new InternalGetWorker({ workerId: env.payload.id })).pipe(mapErrors),
      [`${E}.GoOnLeave`]: (env: { payload: { id: WorkerId } }) =>
        actor.send(new InternalGoOnLeave({ workerId: env.payload.id })).pipe(mapErrors),
      [`${E}.ReturnFromLeave`]: (env: { payload: { id: WorkerId } }) =>
        actor.send(new InternalReturnFromLeave({ workerId: env.payload.id })).pipe(mapErrors),
      [`${E}.RequestBadge`]: (env: { payload: { id: WorkerId } }) =>
        actor.send(new InternalRequestBadge({ workerId: env.payload.id })).pipe(mapErrors),
      [`${E}.IssueBadge`]: (env: { payload: { id: WorkerId; badgeNumber: string; badgeExpiry: any } }) =>
        actor.send(new InternalIssueBadge({ workerId: env.payload.id, badgeNumber: env.payload.badgeNumber, badgeExpiry: env.payload.badgeExpiry })).pipe(mapErrors),
      [`${E}.Offboard`]: (env: { payload: { id: WorkerId } }) =>
        actor.send(new InternalOffboard({ workerId: env.payload.id })).pipe(mapErrors),
    })
  })
)
