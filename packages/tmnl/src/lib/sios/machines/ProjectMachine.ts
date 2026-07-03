/**
 * ProjectMachine — Effect Machine for Project Lifecycle
 * @module sios/machines/ProjectMachine
 */

import { Schema, Effect, pipe, Option, DateTime } from 'effect'
import { Machine } from '@effect/experimental'
import type { ProjectStateShape } from '../state/ProjectState'
import type { SiosFeatureFlagsShape } from '../infrastructure/feature-flags'
import { Project, CreateProjectParams } from '../schemas/project'
import type { ProjectId } from '../schemas/identifiers'
import {
  canAward, canMobilise, canActivate, canCommission, canComplete,
  canHold, canResume, canCancel, type ProjectStateNode,
} from './graphs/project-graph'

// ─── Errors ───
export class MachineProjectNotFoundError extends Schema.TaggedError<MachineProjectNotFoundError>()(
  'MachineProjectNotFoundError', { projectId: Schema.String }
) {}
export class MachineProjectTransitionError extends Schema.TaggedError<MachineProjectTransitionError>()(
  'MachineProjectTransitionError', { projectId: Schema.String, fromState: Schema.String, toState: Schema.String, message: Schema.String }
) {}
export class MachineProjectCreateError extends Schema.TaggedError<MachineProjectCreateError>()(
  'MachineProjectCreateError', { message: Schema.String }
) {}

// ─── Internal Requests ───
export class InternalCreateProject extends Schema.TaggedRequest<InternalCreateProject>()(
  'InternalCreateProject', { failure: MachineProjectCreateError, success: Project, payload: { params: CreateProjectParams } }
) {}
export class InternalGetProject extends Schema.TaggedRequest<InternalGetProject>()(
  'InternalGetProject', { failure: MachineProjectNotFoundError, success: Project, payload: { projectId: Schema.String } }
) {}
export class InternalAwardProject extends Schema.TaggedRequest<InternalAwardProject>()(
  'InternalAwardProject', { failure: Schema.Union(MachineProjectNotFoundError, MachineProjectTransitionError), success: Project, payload: { projectId: Schema.String } }
) {}
export class InternalMobiliseProject extends Schema.TaggedRequest<InternalMobiliseProject>()(
  'InternalMobiliseProject', { failure: Schema.Union(MachineProjectNotFoundError, MachineProjectTransitionError), success: Project, payload: { projectId: Schema.String } }
) {}
export class InternalActivateProject extends Schema.TaggedRequest<InternalActivateProject>()(
  'InternalActivateProject', { failure: Schema.Union(MachineProjectNotFoundError, MachineProjectTransitionError), success: Project, payload: { projectId: Schema.String } }
) {}
export class InternalCommissionProject extends Schema.TaggedRequest<InternalCommissionProject>()(
  'InternalCommissionProject', { failure: Schema.Union(MachineProjectNotFoundError, MachineProjectTransitionError), success: Project, payload: { projectId: Schema.String } }
) {}
export class InternalCompleteProject extends Schema.TaggedRequest<InternalCompleteProject>()(
  'InternalCompleteProject', { failure: Schema.Union(MachineProjectNotFoundError, MachineProjectTransitionError), success: Project, payload: { projectId: Schema.String } }
) {}
export class InternalHoldProject extends Schema.TaggedRequest<InternalHoldProject>()(
  'InternalHoldProject', { failure: Schema.Union(MachineProjectNotFoundError, MachineProjectTransitionError), success: Project, payload: { projectId: Schema.String, reason: Schema.NonEmptyString } }
) {}
export class InternalResumeProject extends Schema.TaggedRequest<InternalResumeProject>()(
  'InternalResumeProject', { failure: Schema.Union(MachineProjectNotFoundError, MachineProjectTransitionError), success: Project, payload: { projectId: Schema.String, targetState: Schema.String } }
) {}
export class InternalCancelProject extends Schema.TaggedRequest<InternalCancelProject>()(
  'InternalCancelProject', { failure: Schema.Union(MachineProjectNotFoundError, MachineProjectTransitionError), success: Project, payload: { projectId: Schema.String } }
) {}

export interface ProjectMachineState { readonly mode: ProjectStateNode }
export interface ProjectMachineDeps { readonly state: ProjectStateShape; readonly flags: SiosFeatureFlagsShape }

const getProject = (state: ProjectStateShape, id: string) =>
  state.get(id as ProjectId).pipe(
    Effect.catchAll(() => Effect.fail(new MachineProjectNotFoundError({ projectId: id })))
  )

const transition = (
  state: ProjectStateShape, id: string, target: ProjectStateNode,
  canDo: (s: ProjectStateNode) => boolean, label: string
) =>
  Effect.gen(function* () {
    const p = yield* getProject(state, id)
    if (!canDo(p.status as ProjectStateNode)) {
      return yield* Effect.fail(new MachineProjectTransitionError({
        projectId: id, fromState: p.status, toState: target,
        message: `Cannot ${label} project in state '${p.status}'.`,
      }))
    }
    const now = yield* DateTime.now
    const updated = new Project({ ...p, status: target, updatedAt: Option.some(now) })
    yield* state.set(updated)
    yield* Effect.logInfo(`[ProjectMachine] Project ${id} → ${target}`)
    return updated
  })

export const makeProjectMachine = (deps: ProjectMachineDeps) =>
  Machine.make((_input: void, previous?: ProjectMachineState) =>
    Effect.gen(function* () {
      const { state } = deps
      const initial: ProjectMachineState = previous ?? { mode: 'bidding' }
      return pipe(
        Machine.procedures.make(initial),
        Machine.procedures.add<InternalCreateProject>()('InternalCreateProject', ({ request }) =>
          Effect.gen(function* () {
            const p = yield* state.create(request.params).pipe(
              Effect.catchAll((e) => Effect.fail(new MachineProjectCreateError({ message: String(e) })))
            )
            return [p, { mode: 'bidding' as ProjectStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalGetProject>()('InternalGetProject', ({ request }) =>
          getProject(state, request.projectId).pipe(
            Effect.map((p) => [p, { mode: p.status as ProjectStateNode }] as const)
          )
        ),
        Machine.procedures.add<InternalAwardProject>()('InternalAwardProject', ({ request }) =>
          transition(state, request.projectId, 'awarded', canAward, 'award').pipe(
            Effect.map((p) => [p, { mode: 'awarded' as ProjectStateNode }] as const)
          )
        ),
        Machine.procedures.add<InternalMobiliseProject>()('InternalMobiliseProject', ({ request }) =>
          transition(state, request.projectId, 'mobilising', canMobilise, 'mobilise').pipe(
            Effect.map((p) => [p, { mode: 'mobilising' as ProjectStateNode }] as const)
          )
        ),
        Machine.procedures.add<InternalActivateProject>()('InternalActivateProject', ({ request }) =>
          transition(state, request.projectId, 'active', canActivate, 'activate').pipe(
            Effect.map((p) => [p, { mode: 'active' as ProjectStateNode }] as const)
          )
        ),
        Machine.procedures.add<InternalCommissionProject>()('InternalCommissionProject', ({ request }) =>
          transition(state, request.projectId, 'commissioning', canCommission, 'commission').pipe(
            Effect.map((p) => [p, { mode: 'commissioning' as ProjectStateNode }] as const)
          )
        ),
        Machine.procedures.add<InternalCompleteProject>()('InternalCompleteProject', ({ request }) =>
          transition(state, request.projectId, 'complete', canComplete, 'complete').pipe(
            Effect.map((p) => [p, { mode: 'complete' as ProjectStateNode }] as const)
          )
        ),
        Machine.procedures.add<InternalHoldProject>()('InternalHoldProject', ({ request }) =>
          Effect.gen(function* () {
            const p = yield* getProject(state, request.projectId)
            if (!canHold(p.status as ProjectStateNode)) {
              return yield* Effect.fail(new MachineProjectTransitionError({
                projectId: request.projectId, fromState: p.status, toState: 'on_hold',
                message: `Cannot hold project in state '${p.status}'.`,
              }))
            }
            const now = yield* DateTime.now
            const updated = new Project({ ...p, status: 'on_hold', holdReason: Option.some(request.reason), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'on_hold' as ProjectStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalResumeProject>()('InternalResumeProject', ({ request }) =>
          Effect.gen(function* () {
            const p = yield* getProject(state, request.projectId)
            if (!canResume(p.status as ProjectStateNode)) {
              return yield* Effect.fail(new MachineProjectTransitionError({
                projectId: request.projectId, fromState: p.status, toState: request.targetState,
                message: `Cannot resume project in state '${p.status}'.`,
              }))
            }
            const now = yield* DateTime.now
            const target = request.targetState as ProjectStateNode
            const updated = new Project({ ...p, status: target, holdReason: Option.none(), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: target }] as const
          })
        ),
        Machine.procedures.add<InternalCancelProject>()('InternalCancelProject', ({ request }) =>
          transition(state, request.projectId, 'cancelled', canCancel, 'cancel').pipe(
            Effect.map((p) => [p, { mode: 'cancelled' as ProjectStateNode }] as const)
          )
        ),
      )
    })
  )

export type ProjectMachine = ReturnType<typeof makeProjectMachine>
