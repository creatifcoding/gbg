/**
 * CrewEntity — Simple CRUD (no machine, no graph)
 * @module sios/entity/CrewEntity
 */

import { Schema, Effect, Option, DateTime } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Crew, CreateCrewParams, UpdateCrewParams } from '../schemas/crew'
import { CrewId, ProjectId } from '../schemas/identifiers'
import { CrewState } from '../state'

export class RpcCrewNotFoundError extends Schema.TaggedError<RpcCrewNotFoundError>()('RpcCrewNotFoundError', { crewId: CrewId }) {}
export class RpcCrewCreateError extends Schema.TaggedError<RpcCrewCreateError>()('RpcCrewCreateError', { message: Schema.String }) {}

const E = 'Crew' as const

export class CreateCrewRpc extends Rpc.make(`${E}.Create`, { payload: CreateCrewParams, primaryKey: ({ projectId }) => projectId, success: Crew, error: RpcCrewCreateError }) {}
export class GetCrewRpc extends Rpc.make(`${E}.Get`, { payload: Schema.Struct({ id: CrewId }), primaryKey: ({ id }) => id, success: Crew, error: RpcCrewNotFoundError }) {}
export class UpdateCrewRpc extends Rpc.make(`${E}.Update`, { payload: Schema.Struct({ id: CrewId, updates: UpdateCrewParams }), primaryKey: ({ id }) => id, success: Crew, error: RpcCrewNotFoundError }) {}
export class ListCrewRpc extends Rpc.make(`${E}.List`, { payload: Schema.Struct({ projectId: ProjectId }), primaryKey: ({ projectId }) => projectId, success: Schema.Array(Crew), error: Schema.Never }) {}
export class DeleteCrewRpc extends Rpc.make(`${E}.Delete`, { payload: Schema.Struct({ id: CrewId }), primaryKey: ({ id }) => id, success: Schema.Boolean, error: Schema.Never }) {}

export const CrewEntity = Entity.make(E, [CreateCrewRpc, GetCrewRpc, UpdateCrewRpc, ListCrewRpc, DeleteCrewRpc])

export const CrewEntityHandlers = CrewEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* CrewState
    return CrewEntity.of({
      [`${E}.Create`]: (env: { payload: typeof CreateCrewParams.Type }) =>
        state.create(env.payload).pipe(
          Effect.catchAll((e) => Effect.fail(new RpcCrewCreateError({ message: String(e) })))
        ),
      [`${E}.Get`]: (env: { payload: { id: CrewId } }) =>
        state.get(env.payload.id).pipe(
          Effect.catchAll(() => Effect.fail(new RpcCrewNotFoundError({ crewId: env.payload.id })))
        ),
      [`${E}.Update`]: (env: { payload: { id: CrewId; updates: typeof UpdateCrewParams.Type } }) =>
        Effect.gen(function* () {
          const crew = yield* state.get(env.payload.id).pipe(
            Effect.catchAll(() => Effect.fail(new RpcCrewNotFoundError({ crewId: env.payload.id })))
          )
          const u = env.payload.updates
          const now = yield* DateTime.now
          const updated = new Crew({
            ...crew,
            name: u.name ?? crew.name,
            shiftPattern: u.shiftPattern ?? crew.shiftPattern,
            foremanId: u.foremanId ? Option.some(u.foremanId) : crew.foremanId,
            targetHeadcount: u.targetHeadcount ?? crew.targetHeadcount,
            isActive: u.isActive ?? crew.isActive,
            updatedAt: Option.some(now),
          })
          yield* state.set(updated)
          return updated
        }),
      [`${E}.List`]: (env: { payload: { projectId: ProjectId } }) =>
        state.listByProject(env.payload.projectId),
      [`${E}.Delete`]: (env: { payload: { id: CrewId } }) =>
        state.delete(env.payload.id),
    })
  })
)
