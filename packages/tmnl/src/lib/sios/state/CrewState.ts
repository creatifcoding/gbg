/**
 * CrewState Service — Context.Tag + in-memory (no graph/machine)
 * @module sios/state/CrewState
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import { Crew, CreateCrewParams, type CrewDiscipline } from '../schemas/crew'
import type { CrewId, ProjectId } from '../schemas/identifiers'

let crewCounter = 0
const genCrewId = (): CrewId => `CRW-${Date.now().toString(36)}-${++crewCounter}` as CrewId

export interface CrewFilter {
  readonly projectId?: ProjectId
  readonly discipline?: CrewDiscipline
  readonly isActive?: boolean
  readonly limit?: number
  readonly offset?: number
}

export class CrewStateNotFoundError {
  readonly _tag = 'CrewStateNotFoundError'
  constructor(readonly crewId: CrewId) {}
}

export interface CrewStateShape {
  readonly create: (params: CreateCrewParams) => Effect.Effect<Crew>
  readonly get: (id: CrewId) => Effect.Effect<Crew, CrewStateNotFoundError>
  readonly set: (crew: Crew) => Effect.Effect<void>
  readonly list: (filter: CrewFilter) => Effect.Effect<readonly Crew[]>
  readonly listByProject: (projectId: ProjectId) => Effect.Effect<readonly Crew[]>
  readonly delete: (id: CrewId) => Effect.Effect<boolean>
  readonly exists: (id: CrewId) => Effect.Effect<boolean>
}

export class CrewState extends Context.Tag('sios/CrewState')<CrewState, CrewStateShape>() {}

export const CrewStateInMemory: Layer.Layer<CrewState> = Layer.effect(
  CrewState,
  Ref.make(new Map<CrewId, Crew>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (c: Crew, f: CrewFilter): boolean => {
        if (f.projectId && c.projectId !== f.projectId) return false
        if (f.discipline && c.discipline !== f.discipline) return false
        if (f.isActive !== undefined && c.isActive !== f.isActive) return false
        return true
      }
      return {
        create: (params: CreateCrewParams) =>
          Effect.gen(function* () {
            const id = genCrewId()
            const now = yield* DateTime.now
            const crew = new Crew({
              id, projectId: params.projectId, name: params.name,
              discipline: params.discipline, shiftPattern: params.shiftPattern,
              foremanId: params.foremanId ? Option.some(params.foremanId) : Option.none(),
              targetHeadcount: params.targetHeadcount, isActive: true,
              createdAt: now, updatedAt: Option.none(), metadata: {},
            })
            yield* Ref.update(store, (m) => { const n = new Map(m); n.set(id, crew); return n })
            return crew
          }),
        get: (id: CrewId) =>
          Ref.get(store).pipe(Effect.flatMap((m) => {
            const c = m.get(id)
            return c ? Effect.succeed(c) : Effect.fail(new CrewStateNotFoundError(id))
          })),
        set: (crew: Crew) =>
          Ref.update(store, (m) => { const n = new Map(m); n.set(crew.id, crew); return n }),
        list: (filter: CrewFilter) =>
          Ref.get(store).pipe(Effect.map((m) => {
            let r = Array.from(m.values()).filter((c) => matchesFilter(c, filter))
            if (filter.offset) r = r.slice(filter.offset)
            if (filter.limit) r = r.slice(0, filter.limit)
            return r
          })),
        listByProject: (projectId: ProjectId) =>
          Ref.get(store).pipe(Effect.map((m) =>
            Array.from(m.values()).filter((c) => c.projectId === projectId)
          )),
        delete: (id: CrewId) =>
          Ref.modify(store, (m) => {
            if (m.has(id)) { const n = new Map(m); n.delete(id); return [true, n] as const }
            return [false, m] as const
          }),
        exists: (id: CrewId) => Ref.get(store).pipe(Effect.map((m) => m.has(id))),
      } satisfies CrewStateShape
    })
  )
)
