/**
 * CheckpointMachine — Effect Machine for commissioning gate lifecycle
 * @module sios/machines/CheckpointMachine
 */

import { Schema, Effect, pipe, Option, DateTime } from 'effect'
import { Machine } from '@effect/experimental'
import type { CheckpointStateShape } from '../state/CheckpointState'
import type { SiosFeatureFlagsShape } from '../infrastructure/feature-flags'
import { Checkpoint, CreateCheckpointParams } from '../schemas/checkpoint'
import { Evidence } from '../schemas/value-objects'
import type { CheckpointId } from '../schemas/identifiers'
import { canMarkReady, canPass, canFail, canWaive, canRework, type CheckpointStateNode } from './graphs/checkpoint-graph'

export class MachineCheckpointNotFoundError extends Schema.TaggedError<MachineCheckpointNotFoundError>()('MachineCheckpointNotFoundError', { checkpointId: Schema.String }) {}
export class MachineCheckpointTransitionError extends Schema.TaggedError<MachineCheckpointTransitionError>()('MachineCheckpointTransitionError', { checkpointId: Schema.String, fromState: Schema.String, toState: Schema.String, message: Schema.String }) {}
export class MachineCheckpointCreateError extends Schema.TaggedError<MachineCheckpointCreateError>()('MachineCheckpointCreateError', { message: Schema.String }) {}

export class InternalCreateCheckpoint extends Schema.TaggedRequest<InternalCreateCheckpoint>()('InternalCreateCheckpoint', { failure: MachineCheckpointCreateError, success: Checkpoint, payload: { params: CreateCheckpointParams } }) {}
export class InternalGetCheckpoint extends Schema.TaggedRequest<InternalGetCheckpoint>()('InternalGetCheckpoint', { failure: MachineCheckpointNotFoundError, success: Checkpoint, payload: { checkpointId: Schema.String } }) {}
export class InternalMarkReady extends Schema.TaggedRequest<InternalMarkReady>()('InternalMarkReady', { failure: Schema.Union(MachineCheckpointNotFoundError, MachineCheckpointTransitionError), success: Checkpoint, payload: { checkpointId: Schema.String } }) {}
export class InternalPassCheckpoint extends Schema.TaggedRequest<InternalPassCheckpoint>()('InternalPassCheckpoint', { failure: Schema.Union(MachineCheckpointNotFoundError, MachineCheckpointTransitionError), success: Checkpoint, payload: { checkpointId: Schema.String, evidence: Schema.optional(Schema.Array(Evidence)) } }) {}
export class InternalFailCheckpoint extends Schema.TaggedRequest<InternalFailCheckpoint>()('InternalFailCheckpoint', { failure: Schema.Union(MachineCheckpointNotFoundError, MachineCheckpointTransitionError), success: Checkpoint, payload: { checkpointId: Schema.String, reason: Schema.NonEmptyString } }) {}
export class InternalWaiveCheckpoint extends Schema.TaggedRequest<InternalWaiveCheckpoint>()('InternalWaiveCheckpoint', { failure: Schema.Union(MachineCheckpointNotFoundError, MachineCheckpointTransitionError), success: Checkpoint, payload: { checkpointId: Schema.String, reason: Schema.NonEmptyString, approvedBy: Schema.NonEmptyString } }) {}
export class InternalReworkCheckpoint extends Schema.TaggedRequest<InternalReworkCheckpoint>()('InternalReworkCheckpoint', { failure: Schema.Union(MachineCheckpointNotFoundError, MachineCheckpointTransitionError), success: Checkpoint, payload: { checkpointId: Schema.String } }) {}

export interface CheckpointMachineState { readonly mode: CheckpointStateNode }
export interface CheckpointMachineDeps { readonly state: CheckpointStateShape; readonly flags: SiosFeatureFlagsShape }

const getCp = (state: CheckpointStateShape, id: string) =>
  state.get(id as CheckpointId).pipe(Effect.catchAll(() => Effect.fail(new MachineCheckpointNotFoundError({ checkpointId: id }))))

export const makeCheckpointMachine = (deps: CheckpointMachineDeps) =>
  Machine.make((_input: void, previous?: CheckpointMachineState) =>
    Effect.gen(function* () {
      const { state } = deps
      return pipe(
        Machine.procedures.make(previous ?? { mode: 'pending' as CheckpointStateNode }),
        Machine.procedures.add<InternalCreateCheckpoint>()('InternalCreateCheckpoint', ({ request }) =>
          state.create(request.params).pipe(
            Effect.catchAll((e) => Effect.fail(new MachineCheckpointCreateError({ message: String(e) }))),
            Effect.map((cp) => [cp, { mode: 'pending' as CheckpointStateNode }] as const)
          )
        ),
        Machine.procedures.add<InternalGetCheckpoint>()('InternalGetCheckpoint', ({ request }) =>
          getCp(state, request.checkpointId).pipe(Effect.map((cp) => [cp, { mode: cp.status as CheckpointStateNode }] as const))
        ),
        Machine.procedures.add<InternalMarkReady>()('InternalMarkReady', ({ request }) =>
          Effect.gen(function* () {
            const cp = yield* getCp(state, request.checkpointId)
            if (!canMarkReady(cp.status as CheckpointStateNode)) return yield* Effect.fail(new MachineCheckpointTransitionError({ checkpointId: request.checkpointId, fromState: cp.status, toState: 'ready', message: 'Checkpoint must be pending to mark ready.' }))
            const now = yield* DateTime.now
            const updated = new Checkpoint({ ...cp, status: 'ready', updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'ready' as CheckpointStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalPassCheckpoint>()('InternalPassCheckpoint', ({ request }) =>
          Effect.gen(function* () {
            const cp = yield* getCp(state, request.checkpointId)
            if (!canPass(cp.status as CheckpointStateNode)) return yield* Effect.fail(new MachineCheckpointTransitionError({ checkpointId: request.checkpointId, fromState: cp.status, toState: 'passed', message: 'Checkpoint must be ready to pass.' }))
            const now = yield* DateTime.now
            const allEvidence = request.evidence ? [...cp.collectedEvidence, ...request.evidence] : cp.collectedEvidence
            const updated = new Checkpoint({ ...cp, status: 'passed', collectedEvidence: allEvidence, completedDate: Option.some(now), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'passed' as CheckpointStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalFailCheckpoint>()('InternalFailCheckpoint', ({ request }) =>
          Effect.gen(function* () {
            const cp = yield* getCp(state, request.checkpointId)
            if (!canFail(cp.status as CheckpointStateNode)) return yield* Effect.fail(new MachineCheckpointTransitionError({ checkpointId: request.checkpointId, fromState: cp.status, toState: 'failed', message: 'Checkpoint must be ready to fail.' }))
            const now = yield* DateTime.now
            const updated = new Checkpoint({ ...cp, status: 'failed', failureReason: Option.some(request.reason), completedDate: Option.some(now), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'failed' as CheckpointStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalWaiveCheckpoint>()('InternalWaiveCheckpoint', ({ request }) =>
          Effect.gen(function* () {
            const cp = yield* getCp(state, request.checkpointId)
            if (!canWaive(cp.status as CheckpointStateNode)) return yield* Effect.fail(new MachineCheckpointTransitionError({ checkpointId: request.checkpointId, fromState: cp.status, toState: 'waived', message: 'Checkpoint must be ready to waive.' }))
            const now = yield* DateTime.now
            const updated = new Checkpoint({ ...cp, status: 'waived', waiverReason: Option.some(request.reason), waiverApprovedBy: Option.some(request.approvedBy), completedDate: Option.some(now), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'waived' as CheckpointStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalReworkCheckpoint>()('InternalReworkCheckpoint', ({ request }) =>
          Effect.gen(function* () {
            const cp = yield* getCp(state, request.checkpointId)
            if (!canRework(cp.status as CheckpointStateNode)) return yield* Effect.fail(new MachineCheckpointTransitionError({ checkpointId: request.checkpointId, fromState: cp.status, toState: 'pending', message: 'Checkpoint must be failed to rework.' }))
            const now = yield* DateTime.now
            const updated = new Checkpoint({ ...cp, status: 'pending', failureReason: Option.none(), completedDate: Option.none(), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'pending' as CheckpointStateNode }] as const
          })
        ),
      )
    })
  )

export type CheckpointMachine = ReturnType<typeof makeCheckpointMachine>
