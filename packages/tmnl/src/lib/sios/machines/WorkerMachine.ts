/**
 * WorkerMachine — Effect Machine for Worker cert/badge lifecycle
 * @module sios/machines/WorkerMachine
 */

import { Schema, Effect, pipe, Option, DateTime } from 'effect'
import { Machine } from '@effect/experimental'
import type { WorkerStateShape } from '../state/WorkerState'
import type { SiosFeatureFlagsShape } from '../infrastructure/feature-flags'
import { Worker, CreateWorkerParams } from '../schemas/worker'
import type { WorkerId } from '../schemas/identifiers'
import {
  canGoOnLeave, canReturnFromLeave, canRequestBadge, canIssueBadge,
  canExpireBadge, canRenewBadge, canExpireCert, canRenewCert, canOffboard,
  type WorkerStateNode,
} from './graphs/worker-graph'

export class MachineWorkerNotFoundError extends Schema.TaggedError<MachineWorkerNotFoundError>()('MachineWorkerNotFoundError', { workerId: Schema.String }) {}
export class MachineWorkerTransitionError extends Schema.TaggedError<MachineWorkerTransitionError>()('MachineWorkerTransitionError', { workerId: Schema.String, fromState: Schema.String, toState: Schema.String, message: Schema.String }) {}
export class MachineWorkerCreateError extends Schema.TaggedError<MachineWorkerCreateError>()('MachineWorkerCreateError', { message: Schema.String }) {}

export class InternalCreateWorker extends Schema.TaggedRequest<InternalCreateWorker>()('InternalCreateWorker', { failure: MachineWorkerCreateError, success: Worker, payload: { params: CreateWorkerParams } }) {}
export class InternalGetWorker extends Schema.TaggedRequest<InternalGetWorker>()('InternalGetWorker', { failure: MachineWorkerNotFoundError, success: Worker, payload: { workerId: Schema.String } }) {}
export class InternalGoOnLeave extends Schema.TaggedRequest<InternalGoOnLeave>()('InternalGoOnLeave', { failure: Schema.Union(MachineWorkerNotFoundError, MachineWorkerTransitionError), success: Worker, payload: { workerId: Schema.String } }) {}
export class InternalReturnFromLeave extends Schema.TaggedRequest<InternalReturnFromLeave>()('InternalReturnFromLeave', { failure: Schema.Union(MachineWorkerNotFoundError, MachineWorkerTransitionError), success: Worker, payload: { workerId: Schema.String } }) {}
export class InternalRequestBadge extends Schema.TaggedRequest<InternalRequestBadge>()('InternalRequestBadge', { failure: Schema.Union(MachineWorkerNotFoundError, MachineWorkerTransitionError), success: Worker, payload: { workerId: Schema.String } }) {}
export class InternalIssueBadge extends Schema.TaggedRequest<InternalIssueBadge>()('InternalIssueBadge', { failure: Schema.Union(MachineWorkerNotFoundError, MachineWorkerTransitionError), success: Worker, payload: { workerId: Schema.String, badgeNumber: Schema.String, badgeExpiry: Schema.DateTimeUtc } }) {}
export class InternalExpireBadge extends Schema.TaggedRequest<InternalExpireBadge>()('InternalExpireBadge', { failure: Schema.Union(MachineWorkerNotFoundError, MachineWorkerTransitionError), success: Worker, payload: { workerId: Schema.String } }) {}
export class InternalRenewBadge extends Schema.TaggedRequest<InternalRenewBadge>()('InternalRenewBadge', { failure: Schema.Union(MachineWorkerNotFoundError, MachineWorkerTransitionError), success: Worker, payload: { workerId: Schema.String, badgeNumber: Schema.String, badgeExpiry: Schema.DateTimeUtc } }) {}
export class InternalOffboard extends Schema.TaggedRequest<InternalOffboard>()('InternalOffboard', { failure: Schema.Union(MachineWorkerNotFoundError, MachineWorkerTransitionError), success: Worker, payload: { workerId: Schema.String } }) {}

export interface WorkerMachineState { readonly mode: WorkerStateNode }
export interface WorkerMachineDeps { readonly state: WorkerStateShape; readonly flags: SiosFeatureFlagsShape }

const getWorker = (state: WorkerStateShape, id: string) =>
  state.get(id as WorkerId).pipe(Effect.catchAll(() => Effect.fail(new MachineWorkerNotFoundError({ workerId: id }))))

const transitionWorker = (state: WorkerStateShape, id: string, target: WorkerStateNode, can: (s: WorkerStateNode) => boolean, label: string) =>
  Effect.gen(function* () {
    const w = yield* getWorker(state, id)
    if (!can(w.status as WorkerStateNode)) return yield* Effect.fail(new MachineWorkerTransitionError({ workerId: id, fromState: w.status, toState: target, message: `Cannot ${label} worker in state '${w.status}'.` }))
    const now = yield* DateTime.now
    const updated = new Worker({ ...w, status: target, updatedAt: Option.some(now) })
    yield* state.set(updated)
    return updated
  })

export const makeWorkerMachine = (deps: WorkerMachineDeps) =>
  Machine.make((_input: void, previous?: WorkerMachineState) =>
    Effect.gen(function* () {
      const { state } = deps
      return pipe(
        Machine.procedures.make(previous ?? { mode: 'active' as WorkerStateNode }),
        Machine.procedures.add<InternalCreateWorker>()('InternalCreateWorker', ({ request }) =>
          state.create(request.params).pipe(
            Effect.catchAll((e) => Effect.fail(new MachineWorkerCreateError({ message: String(e) }))),
            Effect.map((w) => [w, { mode: 'active' as WorkerStateNode }] as const)
          )
        ),
        Machine.procedures.add<InternalGetWorker>()('InternalGetWorker', ({ request }) =>
          getWorker(state, request.workerId).pipe(Effect.map((w) => [w, { mode: w.status as WorkerStateNode }] as const))
        ),
        Machine.procedures.add<InternalGoOnLeave>()('InternalGoOnLeave', ({ request }) =>
          transitionWorker(state, request.workerId, 'on_leave', canGoOnLeave, 'go on leave').pipe(
            Effect.map((w) => [w, { mode: 'on_leave' as WorkerStateNode }] as const))
        ),
        Machine.procedures.add<InternalReturnFromLeave>()('InternalReturnFromLeave', ({ request }) =>
          transitionWorker(state, request.workerId, 'active', canReturnFromLeave, 'return from leave').pipe(
            Effect.map((w) => [w, { mode: 'active' as WorkerStateNode }] as const))
        ),
        Machine.procedures.add<InternalRequestBadge>()('InternalRequestBadge', ({ request }) =>
          transitionWorker(state, request.workerId, 'badge_pending', canRequestBadge, 'request badge').pipe(
            Effect.map((w) => [w, { mode: 'badge_pending' as WorkerStateNode }] as const))
        ),
        Machine.procedures.add<InternalIssueBadge>()('InternalIssueBadge', ({ request }) =>
          Effect.gen(function* () {
            const w = yield* getWorker(state, request.workerId)
            if (!canIssueBadge(w.status as WorkerStateNode)) return yield* Effect.fail(new MachineWorkerTransitionError({ workerId: request.workerId, fromState: w.status, toState: 'active', message: 'Worker must be badge_pending to issue badge.' }))
            const now = yield* DateTime.now
            const updated = new Worker({ ...w, status: 'active', badgeNumber: Option.some(request.badgeNumber), badgeExpiry: Option.some(request.badgeExpiry), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'active' as WorkerStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalExpireBadge>()('InternalExpireBadge', ({ request }) =>
          transitionWorker(state, request.workerId, 'badge_expired', canExpireBadge, 'expire badge').pipe(
            Effect.map((w) => [w, { mode: 'badge_expired' as WorkerStateNode }] as const))
        ),
        Machine.procedures.add<InternalRenewBadge>()('InternalRenewBadge', ({ request }) =>
          Effect.gen(function* () {
            const w = yield* getWorker(state, request.workerId)
            if (!canRenewBadge(w.status as WorkerStateNode)) return yield* Effect.fail(new MachineWorkerTransitionError({ workerId: request.workerId, fromState: w.status, toState: 'active', message: 'Worker must be badge_expired to renew badge.' }))
            const now = yield* DateTime.now
            const updated = new Worker({ ...w, status: 'active', badgeNumber: Option.some(request.badgeNumber), badgeExpiry: Option.some(request.badgeExpiry), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'active' as WorkerStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalOffboard>()('InternalOffboard', ({ request }) =>
          transitionWorker(state, request.workerId, 'offboarded', canOffboard, 'offboard').pipe(
            Effect.map((w) => [w, { mode: 'offboarded' as WorkerStateNode }] as const))
        ),
      )
    })
  )

export type WorkerMachine = ReturnType<typeof makeWorkerMachine>
