/**
 * CheckpointEntity — Machine-backed entity for commissioning gates
 * @module sios/entity/CheckpointEntity
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Checkpoint, CreateCheckpointParams } from '../schemas/checkpoint'
import { CheckpointId } from '../schemas/identifiers'
import { Evidence } from '../schemas/value-objects'
import { CheckpointState } from '../state'
import { SiosFeatureFlags } from '../infrastructure'
import {
  makeCheckpointMachine,
  InternalCreateCheckpoint, InternalGetCheckpoint,
  InternalMarkReady, InternalPassCheckpoint, InternalFailCheckpoint,
  InternalWaiveCheckpoint, InternalReworkCheckpoint,
} from '../machines/CheckpointMachine'

export class RpcCheckpointNotFoundError extends Schema.TaggedError<RpcCheckpointNotFoundError>()('RpcCheckpointNotFoundError', { checkpointId: CheckpointId }) {}
export class RpcCheckpointTransitionError extends Schema.TaggedError<RpcCheckpointTransitionError>()('RpcCheckpointTransitionError', { checkpointId: CheckpointId, message: Schema.String }) {}
export class RpcCheckpointCreateError extends Schema.TaggedError<RpcCheckpointCreateError>()('RpcCheckpointCreateError', { message: Schema.String }) {}

const E = 'Checkpoint' as const

export class CreateCheckpointRpc extends Rpc.make(`${E}.Create`, { payload: CreateCheckpointParams, primaryKey: ({ workPackageId }) => workPackageId, success: Checkpoint, error: RpcCheckpointCreateError }) {}
export class GetCheckpointRpc extends Rpc.make(`${E}.Get`, { payload: Schema.Struct({ id: CheckpointId }), primaryKey: ({ id }) => id, success: Checkpoint, error: RpcCheckpointNotFoundError }) {}
export class MarkReadyRpc extends Rpc.make(`${E}.MarkReady`, { payload: Schema.Struct({ id: CheckpointId }), primaryKey: ({ id }) => id, success: Checkpoint, error: Schema.Union(RpcCheckpointNotFoundError, RpcCheckpointTransitionError) }) {}
export class PassCheckpointRpc extends Rpc.make(`${E}.Pass`, { payload: Schema.Struct({ id: CheckpointId, evidence: Schema.optional(Schema.Array(Evidence)) }), primaryKey: ({ id }) => id, success: Checkpoint, error: Schema.Union(RpcCheckpointNotFoundError, RpcCheckpointTransitionError) }) {}
export class FailCheckpointRpc extends Rpc.make(`${E}.Fail`, { payload: Schema.Struct({ id: CheckpointId, reason: Schema.NonEmptyString }), primaryKey: ({ id }) => id, success: Checkpoint, error: Schema.Union(RpcCheckpointNotFoundError, RpcCheckpointTransitionError) }) {}
export class WaiveCheckpointRpc extends Rpc.make(`${E}.Waive`, { payload: Schema.Struct({ id: CheckpointId, reason: Schema.NonEmptyString, approvedBy: Schema.NonEmptyString }), primaryKey: ({ id }) => id, success: Checkpoint, error: Schema.Union(RpcCheckpointNotFoundError, RpcCheckpointTransitionError) }) {}
export class ReworkCheckpointRpc extends Rpc.make(`${E}.Rework`, { payload: Schema.Struct({ id: CheckpointId }), primaryKey: ({ id }) => id, success: Checkpoint, error: Schema.Union(RpcCheckpointNotFoundError, RpcCheckpointTransitionError) }) {}

export const CheckpointEntity = Entity.make(E, [
  CreateCheckpointRpc, GetCheckpointRpc, MarkReadyRpc,
  PassCheckpointRpc, FailCheckpointRpc, WaiveCheckpointRpc, ReworkCheckpointRpc,
])

const mapErrors = Effect.catchTags({
  MachineCheckpointNotFoundError: (e: { checkpointId: string }) => Effect.fail(new RpcCheckpointNotFoundError({ checkpointId: e.checkpointId as CheckpointId })),
  MachineCheckpointTransitionError: (e: { checkpointId: string; message: string }) => Effect.fail(new RpcCheckpointTransitionError({ checkpointId: e.checkpointId as CheckpointId, message: e.message })),
})

export const CheckpointEntityHandlers = CheckpointEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* CheckpointState
    const flags = yield* SiosFeatureFlags
    const actor = yield* Machine.boot(makeCheckpointMachine({ state, flags }))
    return CheckpointEntity.of({
      [`${E}.Create`]: (env: { payload: typeof CreateCheckpointParams.Type }) =>
        actor.send(new InternalCreateCheckpoint({ params: env.payload })).pipe(
          Effect.catchTag('MachineCheckpointCreateError', (e) => Effect.fail(new RpcCheckpointCreateError({ message: e.message })))
        ),
      [`${E}.Get`]: (env: { payload: { id: CheckpointId } }) =>
        actor.send(new InternalGetCheckpoint({ checkpointId: env.payload.id })).pipe(mapErrors),
      [`${E}.MarkReady`]: (env: { payload: { id: CheckpointId } }) =>
        actor.send(new InternalMarkReady({ checkpointId: env.payload.id })).pipe(mapErrors),
      [`${E}.Pass`]: (env: { payload: { id: CheckpointId; evidence?: typeof Evidence.Type[] } }) =>
        actor.send(new InternalPassCheckpoint({ checkpointId: env.payload.id, evidence: env.payload.evidence })).pipe(mapErrors),
      [`${E}.Fail`]: (env: { payload: { id: CheckpointId; reason: string } }) =>
        actor.send(new InternalFailCheckpoint({ checkpointId: env.payload.id, reason: env.payload.reason })).pipe(mapErrors),
      [`${E}.Waive`]: (env: { payload: { id: CheckpointId; reason: string; approvedBy: string } }) =>
        actor.send(new InternalWaiveCheckpoint({ checkpointId: env.payload.id, reason: env.payload.reason, approvedBy: env.payload.approvedBy })).pipe(mapErrors),
      [`${E}.Rework`]: (env: { payload: { id: CheckpointId } }) =>
        actor.send(new InternalReworkCheckpoint({ checkpointId: env.payload.id })).pipe(mapErrors),
    })
  })
)
