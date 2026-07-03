/**
 * WorkPackageMachine — Effect Machine for WorkPackage Lifecycle
 *
 * Internal actor that wraps WorkPackageState and validates transitions
 * via the work-package-graph.
 *
 * Architecture (from IIoT SiteMachine):
 *   Entity.toLayer()
 *     |→ Machine.boot(WorkPackageMachine)
 *           |→ actor.send(InternalActivateWP)
 *                 |→ Machine.procedures handler
 *                       |→ graph validation (canActivate)
 *                       |→ state.set (update status)
 *                       |→ maybeEmit (if flags.eventsEnabled)
 *
 * @module sios/machines/WorkPackageMachine
 */

import { Schema, Effect, pipe, Option, DateTime } from 'effect'
import { Machine } from '@effect/experimental'
import type { WorkPackageStateShape } from '../state/WorkPackageState'
import type { SiosFeatureFlagsShape } from '../infrastructure/feature-flags'
import {
  WorkPackage,
  CreateWorkPackageParams,
} from '../schemas/work-package'
import type { WorkPackageId, CrewId } from '../schemas/identifiers'
import {
  canActivate,
  canSuspend,
  canResume,
  canComplete,
  canClose,
  type WorkPackageStateNode,
} from './graphs/work-package-graph'

// =============================================================================
// Internal Errors
// =============================================================================

export class MachineWPNotFoundError extends Schema.TaggedError<MachineWPNotFoundError>()(
  'MachineWPNotFoundError',
  { workPackageId: Schema.String }
) {}

export class MachineWPTransitionError extends Schema.TaggedError<MachineWPTransitionError>()(
  'MachineWPTransitionError',
  {
    workPackageId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  }
) {}

export class MachineWPCreateError extends Schema.TaggedError<MachineWPCreateError>()(
  'MachineWPCreateError',
  { message: Schema.String }
) {}

// =============================================================================
// Internal Requests — TaggedRequest for Machine procedures
// =============================================================================

export class InternalCreateWP extends Schema.TaggedRequest<InternalCreateWP>()(
  'InternalCreateWP',
  {
    failure: MachineWPCreateError,
    success: WorkPackage,
    payload: { params: CreateWorkPackageParams },
  }
) {}

export class InternalGetWP extends Schema.TaggedRequest<InternalGetWP>()(
  'InternalGetWP',
  {
    failure: MachineWPNotFoundError,
    success: WorkPackage,
    payload: { workPackageId: Schema.String },
  }
) {}

export class InternalActivateWP extends Schema.TaggedRequest<InternalActivateWP>()(
  'InternalActivateWP',
  {
    failure: Schema.Union(MachineWPNotFoundError, MachineWPTransitionError),
    success: WorkPackage,
    payload: { workPackageId: Schema.String },
  }
) {}

export class InternalSuspendWP extends Schema.TaggedRequest<InternalSuspendWP>()(
  'InternalSuspendWP',
  {
    failure: Schema.Union(MachineWPNotFoundError, MachineWPTransitionError),
    success: WorkPackage,
    payload: { workPackageId: Schema.String },
  }
) {}

export class InternalResumeWP extends Schema.TaggedRequest<InternalResumeWP>()(
  'InternalResumeWP',
  {
    failure: Schema.Union(MachineWPNotFoundError, MachineWPTransitionError),
    success: WorkPackage,
    payload: { workPackageId: Schema.String },
  }
) {}

export class InternalCompleteWP extends Schema.TaggedRequest<InternalCompleteWP>()(
  'InternalCompleteWP',
  {
    failure: Schema.Union(MachineWPNotFoundError, MachineWPTransitionError),
    success: WorkPackage,
    payload: { workPackageId: Schema.String },
  }
) {}

export class InternalCloseWP extends Schema.TaggedRequest<InternalCloseWP>()(
  'InternalCloseWP',
  {
    failure: Schema.Union(MachineWPNotFoundError, MachineWPTransitionError),
    success: WorkPackage,
    payload: { workPackageId: Schema.String },
  }
) {}

export class InternalAssignCrew extends Schema.TaggedRequest<InternalAssignCrew>()(
  'InternalAssignCrew',
  {
    failure: MachineWPNotFoundError,
    success: WorkPackage,
    payload: { workPackageId: Schema.String, crewId: Schema.String },
  }
) {}

export class InternalRecordProgress extends Schema.TaggedRequest<InternalRecordProgress>()(
  'InternalRecordProgress',
  {
    failure: MachineWPNotFoundError,
    success: WorkPackage,
    payload: {
      workPackageId: Schema.String,
      qtyCompleted: Schema.Number,
      hoursExpended: Schema.Number,
      costExpended: Schema.Number,
    },
  }
) {}

// =============================================================================
// Machine State
// =============================================================================

export interface WPMachineState {
  readonly mode: WorkPackageStateNode
}

// =============================================================================
// Dependencies
// =============================================================================

export interface WPMachineDeps {
  readonly state: WorkPackageStateShape
  readonly flags: SiosFeatureFlagsShape
}

// =============================================================================
// Transition Helper
// =============================================================================

const transitionWP = (
  state: WorkPackageStateShape,
  wpId: string,
  targetState: WorkPackageStateNode,
  canTransition: (s: WorkPackageStateNode) => boolean,
  label: string
) =>
  Effect.gen(function* () {
    const wp = yield* state.get(wpId as WorkPackageId).pipe(
      Effect.catchAll(() =>
        Effect.fail(new MachineWPNotFoundError({ workPackageId: wpId }))
      )
    )

    const currentState = wp.status as WorkPackageStateNode

    if (!canTransition(currentState)) {
      return yield* Effect.fail(
        new MachineWPTransitionError({
          workPackageId: wpId,
          fromState: currentState,
          toState: targetState,
          message: `Cannot ${label} work package in state '${currentState}'.`,
        })
      )
    }

    const now = yield* DateTime.now
    const updated = new WorkPackage({
      ...wp,
      status: targetState,
      updatedAt: Option.some(now),
    })

    yield* state.set(updated)
    yield* Effect.logInfo(`[WPMachine] WorkPackage ${wpId} → ${targetState}`)

    return updated
  })

// =============================================================================
// Machine Factory
// =============================================================================

export const makeWorkPackageMachine = (deps: WPMachineDeps) =>
  Machine.make(
    (_input: void, previous?: WPMachineState) =>
      Effect.gen(function* () {
        const { state, flags } = deps
        const initialState: WPMachineState = previous ?? { mode: 'planned' }

        return pipe(
          Machine.procedures.make(initialState),

          // CREATE
          Machine.procedures.add<InternalCreateWP>()(
            'InternalCreateWP',
            ({ request }) =>
              Effect.gen(function* () {
                const wp = yield* state.create(request.params).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineWPCreateError({ message: `Create WP failed: ${String(e)}` }))
                  )
                )
                yield* Effect.logInfo(`[WPMachine] Created WorkPackage ${wp.id}`)
                return [wp, { mode: 'planned' as WorkPackageStateNode }] as const
              })
          ),

          // GET
          Machine.procedures.add<InternalGetWP>()(
            'InternalGetWP',
            ({ request }) =>
              Effect.gen(function* () {
                const wp = yield* state.get(request.workPackageId as WorkPackageId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWPNotFoundError({ workPackageId: request.workPackageId }))
                  )
                )
                return [wp, { mode: wp.status as WorkPackageStateNode }] as const
              })
          ),

          // ACTIVATE (planned → active)
          Machine.procedures.add<InternalActivateWP>()(
            'InternalActivateWP',
            ({ request }) =>
              transitionWP(state, request.workPackageId, 'active', canActivate, 'activate').pipe(
                Effect.map((wp) => [wp, { mode: 'active' as WorkPackageStateNode }] as const)
              )
          ),

          // SUSPEND (active → suspended)
          Machine.procedures.add<InternalSuspendWP>()(
            'InternalSuspendWP',
            ({ request }) =>
              transitionWP(state, request.workPackageId, 'suspended', canSuspend, 'suspend').pipe(
                Effect.map((wp) => [wp, { mode: 'suspended' as WorkPackageStateNode }] as const)
              )
          ),

          // RESUME (suspended → active)
          Machine.procedures.add<InternalResumeWP>()(
            'InternalResumeWP',
            ({ request }) =>
              transitionWP(state, request.workPackageId, 'active', canResume, 'resume').pipe(
                Effect.map((wp) => [wp, { mode: 'active' as WorkPackageStateNode }] as const)
              )
          ),

          // COMPLETE (active → complete)
          Machine.procedures.add<InternalCompleteWP>()(
            'InternalCompleteWP',
            ({ request }) =>
              transitionWP(state, request.workPackageId, 'complete', canComplete, 'complete').pipe(
                Effect.map((wp) => [wp, { mode: 'complete' as WorkPackageStateNode }] as const)
              )
          ),

          // CLOSE (complete → closed)
          Machine.procedures.add<InternalCloseWP>()(
            'InternalCloseWP',
            ({ request }) =>
              transitionWP(state, request.workPackageId, 'closed', canClose, 'close').pipe(
                Effect.map((wp) => [wp, { mode: 'closed' as WorkPackageStateNode }] as const)
              )
          ),

          // ASSIGN CREW (any non-terminal state)
          Machine.procedures.add<InternalAssignCrew>()(
            'InternalAssignCrew',
            ({ request }) =>
              Effect.gen(function* () {
                const wp = yield* state.get(request.workPackageId as WorkPackageId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWPNotFoundError({ workPackageId: request.workPackageId }))
                  )
                )
                const now = yield* DateTime.now
                const updated = new WorkPackage({
                  ...wp,
                  assignedCrewId: Option.some(request.crewId as CrewId),
                  updatedAt: Option.some(now),
                })
                yield* state.set(updated)
                yield* Effect.logInfo(`[WPMachine] Assigned crew ${request.crewId} to WP ${request.workPackageId}`)
                return [updated, { mode: wp.status as WorkPackageStateNode }] as const
              })
          ),

          // RECORD PROGRESS (incremental qty/hours/cost update)
          Machine.procedures.add<InternalRecordProgress>()(
            'InternalRecordProgress',
            ({ request }) =>
              Effect.gen(function* () {
                const wp = yield* state.get(request.workPackageId as WorkPackageId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineWPNotFoundError({ workPackageId: request.workPackageId }))
                  )
                )
                const now = yield* DateTime.now
                const updated = new WorkPackage({
                  ...wp,
                  actualQty: wp.actualQty + request.qtyCompleted,
                  actualHours: wp.actualHours + request.hoursExpended,
                  actualCost: wp.actualCost + request.costExpended,
                  actualStart: Option.isNone(wp.actualStart)
                    ? Option.some(now)
                    : wp.actualStart,
                  updatedAt: Option.some(now),
                })
                yield* state.set(updated)
                return [updated, { mode: wp.status as WorkPackageStateNode }] as const
              })
          ),
        )
      })
  )

export type WorkPackageMachine = ReturnType<typeof makeWorkPackageMachine>
