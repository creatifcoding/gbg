/**
 * ProjectEntity — Machine-backed entity for Project lifecycle
 * @module sios/entity/ProjectEntity
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Project, CreateProjectParams } from '../schemas/project'
import { ProjectId } from '../schemas/identifiers'
import { ProjectState } from '../state'
import { SiosFeatureFlags } from '../infrastructure'
import {
  makeProjectMachine,
  InternalCreateProject, InternalGetProject,
  InternalAwardProject, InternalMobiliseProject, InternalActivateProject,
  InternalCommissionProject, InternalCompleteProject,
  InternalHoldProject, InternalResumeProject, InternalCancelProject,
} from '../machines/ProjectMachine'

export class RpcProjectNotFoundError extends Schema.TaggedError<RpcProjectNotFoundError>()('RpcProjectNotFoundError', { projectId: ProjectId }) {}
export class RpcProjectTransitionError extends Schema.TaggedError<RpcProjectTransitionError>()('RpcProjectTransitionError', { projectId: ProjectId, message: Schema.String }) {}
export class RpcProjectCreateError extends Schema.TaggedError<RpcProjectCreateError>()('RpcProjectCreateError', { message: Schema.String }) {}

const E = 'Project' as const

export class CreateProjectRpc extends Rpc.make(`${E}.Create`, { payload: CreateProjectParams, primaryKey: ({ code }) => code, success: Project, error: RpcProjectCreateError }) {}
export class GetProjectRpc extends Rpc.make(`${E}.Get`, { payload: Schema.Struct({ id: ProjectId }), primaryKey: ({ id }) => id, success: Project, error: RpcProjectNotFoundError }) {}
export class AwardProjectRpc extends Rpc.make(`${E}.Award`, { payload: Schema.Struct({ id: ProjectId }), primaryKey: ({ id }) => id, success: Project, error: Schema.Union(RpcProjectNotFoundError, RpcProjectTransitionError) }) {}
export class MobiliseProjectRpc extends Rpc.make(`${E}.Mobilise`, { payload: Schema.Struct({ id: ProjectId }), primaryKey: ({ id }) => id, success: Project, error: Schema.Union(RpcProjectNotFoundError, RpcProjectTransitionError) }) {}
export class ActivateProjectRpc extends Rpc.make(`${E}.Activate`, { payload: Schema.Struct({ id: ProjectId }), primaryKey: ({ id }) => id, success: Project, error: Schema.Union(RpcProjectNotFoundError, RpcProjectTransitionError) }) {}
export class CommissionProjectRpc extends Rpc.make(`${E}.Commission`, { payload: Schema.Struct({ id: ProjectId }), primaryKey: ({ id }) => id, success: Project, error: Schema.Union(RpcProjectNotFoundError, RpcProjectTransitionError) }) {}
export class CompleteProjectRpc extends Rpc.make(`${E}.Complete`, { payload: Schema.Struct({ id: ProjectId }), primaryKey: ({ id }) => id, success: Project, error: Schema.Union(RpcProjectNotFoundError, RpcProjectTransitionError) }) {}
export class HoldProjectRpc extends Rpc.make(`${E}.Hold`, { payload: Schema.Struct({ id: ProjectId, reason: Schema.NonEmptyString }), primaryKey: ({ id }) => id, success: Project, error: Schema.Union(RpcProjectNotFoundError, RpcProjectTransitionError) }) {}
export class ResumeProjectRpc extends Rpc.make(`${E}.Resume`, { payload: Schema.Struct({ id: ProjectId, targetState: Schema.String }), primaryKey: ({ id }) => id, success: Project, error: Schema.Union(RpcProjectNotFoundError, RpcProjectTransitionError) }) {}
export class CancelProjectRpc extends Rpc.make(`${E}.Cancel`, { payload: Schema.Struct({ id: ProjectId }), primaryKey: ({ id }) => id, success: Project, error: Schema.Union(RpcProjectNotFoundError, RpcProjectTransitionError) }) {}

export const ProjectEntity = Entity.make(E, [
  CreateProjectRpc, GetProjectRpc, AwardProjectRpc, MobiliseProjectRpc,
  ActivateProjectRpc, CommissionProjectRpc, CompleteProjectRpc,
  HoldProjectRpc, ResumeProjectRpc, CancelProjectRpc,
])

const mapErrors = Effect.catchTags({
  MachineProjectNotFoundError: (e: { projectId: string }) => Effect.fail(new RpcProjectNotFoundError({ projectId: e.projectId as ProjectId })),
  MachineProjectTransitionError: (e: { projectId: string; message: string }) => Effect.fail(new RpcProjectTransitionError({ projectId: e.projectId as ProjectId, message: e.message })),
})

export const ProjectEntityHandlers = ProjectEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* ProjectState
    const flags = yield* SiosFeatureFlags
    const machine = makeProjectMachine({ state, flags })
    const actor = yield* Machine.boot(machine)

    return ProjectEntity.of({
      [`${E}.Create`]: (env: { payload: typeof CreateProjectParams.Type }) =>
        actor.send(new InternalCreateProject({ params: env.payload })).pipe(
          Effect.catchTag('MachineProjectCreateError', (e) => Effect.fail(new RpcProjectCreateError({ message: e.message })))
        ),
      [`${E}.Get`]: (env: { payload: { id: ProjectId } }) =>
        actor.send(new InternalGetProject({ projectId: env.payload.id })).pipe(mapErrors),
      [`${E}.Award`]: (env: { payload: { id: ProjectId } }) =>
        actor.send(new InternalAwardProject({ projectId: env.payload.id })).pipe(mapErrors),
      [`${E}.Mobilise`]: (env: { payload: { id: ProjectId } }) =>
        actor.send(new InternalMobiliseProject({ projectId: env.payload.id })).pipe(mapErrors),
      [`${E}.Activate`]: (env: { payload: { id: ProjectId } }) =>
        actor.send(new InternalActivateProject({ projectId: env.payload.id })).pipe(mapErrors),
      [`${E}.Commission`]: (env: { payload: { id: ProjectId } }) =>
        actor.send(new InternalCommissionProject({ projectId: env.payload.id })).pipe(mapErrors),
      [`${E}.Complete`]: (env: { payload: { id: ProjectId } }) =>
        actor.send(new InternalCompleteProject({ projectId: env.payload.id })).pipe(mapErrors),
      [`${E}.Hold`]: (env: { payload: { id: ProjectId; reason: string } }) =>
        actor.send(new InternalHoldProject({ projectId: env.payload.id, reason: env.payload.reason })).pipe(mapErrors),
      [`${E}.Resume`]: (env: { payload: { id: ProjectId; targetState: string } }) =>
        actor.send(new InternalResumeProject({ projectId: env.payload.id, targetState: env.payload.targetState })).pipe(mapErrors),
      [`${E}.Cancel`]: (env: { payload: { id: ProjectId } }) =>
        actor.send(new InternalCancelProject({ projectId: env.payload.id })).pipe(mapErrors),
    })
  })
)
