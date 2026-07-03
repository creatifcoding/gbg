/**
 * ZoneState Service — Context.Tag + in-memory
 * @module sios/state/ZoneState
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import { Zone, CreateZoneParams, type ZoneStatus } from '../schemas/zone'
import type { ZoneId, ProjectId } from '../schemas/identifiers'

let zoneCounter = 0
const genZoneId = (): ZoneId => `ZN-${Date.now().toString(36)}-${++zoneCounter}` as ZoneId

export interface ZoneFilter {
  readonly projectId?: ProjectId
  readonly status?: ZoneStatus
  readonly phaseNumber?: number
  readonly limit?: number
  readonly offset?: number
}

export class ZoneStateNotFoundError {
  readonly _tag = 'ZoneStateNotFoundError'
  constructor(readonly zoneId: ZoneId) {}
}

export interface ZoneStateShape {
  readonly create: (params: CreateZoneParams) => Effect.Effect<Zone>
  readonly get: (id: ZoneId) => Effect.Effect<Zone, ZoneStateNotFoundError>
  readonly set: (zone: Zone) => Effect.Effect<void>
  readonly list: (filter: ZoneFilter) => Effect.Effect<readonly Zone[]>
  readonly listByProject: (projectId: ProjectId) => Effect.Effect<readonly Zone[]>
  readonly delete: (id: ZoneId) => Effect.Effect<boolean>
  readonly exists: (id: ZoneId) => Effect.Effect<boolean>
  readonly count: (filter: ZoneFilter) => Effect.Effect<number>
}

export class ZoneState extends Context.Tag('sios/ZoneState')<ZoneState, ZoneStateShape>() {}

export const ZoneStateInMemory: Layer.Layer<ZoneState> = Layer.effect(
  ZoneState,
  Ref.make(new Map<ZoneId, Zone>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (z: Zone, f: ZoneFilter): boolean => {
        if (f.projectId && z.projectId !== f.projectId) return false
        if (f.status && z.status !== f.status) return false
        if (f.phaseNumber !== undefined && (!Option.isSome(z.phaseNumber) || z.phaseNumber.value !== f.phaseNumber)) return false
        return true
      }

      return {
        create: (params: CreateZoneParams) =>
          Effect.gen(function* () {
            const id = genZoneId()
            const now = yield* DateTime.now
            const zone = new Zone({
              id, projectId: params.projectId, name: params.name, code: params.code, status: 'defined',
              description: params.description ? Option.some(params.description) : Option.none(),
              phaseNumber: params.phaseNumber ? Option.some(params.phaseNumber) : Option.none(),
              accessConstraints: params.accessConstraints ? Option.some(params.accessConstraints) : Option.none(),
              areaSquareFeet: params.areaSquareFeet ? Option.some(params.areaSquareFeet) : Option.none(),
              location: params.location ? Option.some(params.location) : Option.none(),
              holdReason: Option.none(),
              createdAt: now, updatedAt: Option.none(), metadata: {},
            })
            yield* Ref.update(store, (m) => { const n = new Map(m); n.set(id, zone); return n })
            return zone
          }),
        get: (id: ZoneId) =>
          Ref.get(store).pipe(Effect.flatMap((m) => {
            const z = m.get(id)
            return z ? Effect.succeed(z) : Effect.fail(new ZoneStateNotFoundError(id))
          })),
        set: (zone: Zone) =>
          Ref.update(store, (m) => { const n = new Map(m); n.set(zone.id, zone); return n }),
        list: (filter: ZoneFilter) =>
          Ref.get(store).pipe(Effect.map((m) => {
            let r = Array.from(m.values()).filter((z) => matchesFilter(z, filter))
            if (filter.offset) r = r.slice(filter.offset)
            if (filter.limit) r = r.slice(0, filter.limit)
            return r
          })),
        listByProject: (projectId: ProjectId) =>
          Ref.get(store).pipe(Effect.map((m) =>
            Array.from(m.values()).filter((z) => z.projectId === projectId)
          )),
        delete: (id: ZoneId) =>
          Ref.modify(store, (m) => {
            if (m.has(id)) { const n = new Map(m); n.delete(id); return [true, n] as const }
            return [false, m] as const
          }),
        exists: (id: ZoneId) => Ref.get(store).pipe(Effect.map((m) => m.has(id))),
        count: (filter: ZoneFilter) =>
          Ref.get(store).pipe(Effect.map((m) =>
            Array.from(m.values()).filter((z) => matchesFilter(z, filter)).length
          )),
      } satisfies ZoneStateShape
    })
  )
)
