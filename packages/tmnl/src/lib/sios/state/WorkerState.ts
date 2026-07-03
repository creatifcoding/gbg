/**
 * WorkerState Service — Context.Tag + in-memory
 * @module sios/state/WorkerState
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import { Worker, CreateWorkerParams, type WorkerStatus, type TradeRole } from '../schemas/worker'
import type { WorkerId, CrewId } from '../schemas/identifiers'

let wkrCounter = 0
const genWorkerId = (): WorkerId => `WKR-${Date.now().toString(36)}-${++wkrCounter}` as WorkerId

export interface WorkerFilter {
  readonly crewId?: CrewId
  readonly status?: WorkerStatus
  readonly tradeRole?: TradeRole
  readonly limit?: number
  readonly offset?: number
}

export class WorkerStateNotFoundError {
  readonly _tag = 'WorkerStateNotFoundError'
  constructor(readonly workerId: WorkerId) {}
}

export interface WorkerStateShape {
  readonly create: (params: CreateWorkerParams) => Effect.Effect<Worker>
  readonly get: (id: WorkerId) => Effect.Effect<Worker, WorkerStateNotFoundError>
  readonly set: (worker: Worker) => Effect.Effect<void>
  readonly list: (filter: WorkerFilter) => Effect.Effect<readonly Worker[]>
  readonly listByCrew: (crewId: CrewId) => Effect.Effect<readonly Worker[]>
  readonly delete: (id: WorkerId) => Effect.Effect<boolean>
  readonly exists: (id: WorkerId) => Effect.Effect<boolean>
  readonly count: (filter: WorkerFilter) => Effect.Effect<number>
}

export class WorkerState extends Context.Tag('sios/WorkerState')<WorkerState, WorkerStateShape>() {}

export const WorkerStateInMemory: Layer.Layer<WorkerState> = Layer.effect(
  WorkerState,
  Ref.make(new Map<WorkerId, Worker>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (w: Worker, f: WorkerFilter): boolean => {
        if (f.crewId && (!Option.isSome(w.crewId) || w.crewId.value !== f.crewId)) return false
        if (f.status && w.status !== f.status) return false
        if (f.tradeRole && w.tradeRole !== f.tradeRole) return false
        return true
      }
      return {
        create: (params: CreateWorkerParams) =>
          Effect.gen(function* () {
            const id = genWorkerId()
            const now = yield* DateTime.now
            const worker = new Worker({
              id, name: params.name, status: 'active', tradeRole: params.tradeRole,
              crewId: params.crewId ? Option.some(params.crewId) : Option.none(),
              hourlyRate: params.hourlyRate,
              certifications: params.certifications ?? [],
              badgeNumber: params.badgeNumber ? Option.some(params.badgeNumber) : Option.none(),
              badgeExpiry: params.badgeExpiry ? Option.some(params.badgeExpiry) : Option.none(),
              email: params.email ? Option.some(params.email) : Option.none(),
              phone: params.phone ? Option.some(params.phone) : Option.none(),
              emergencyContact: params.emergencyContact ? Option.some(params.emergencyContact) : Option.none(),
              createdAt: now, updatedAt: Option.none(), metadata: {},
            })
            yield* Ref.update(store, (m) => { const n = new Map(m); n.set(id, worker); return n })
            return worker
          }),
        get: (id: WorkerId) =>
          Ref.get(store).pipe(Effect.flatMap((m) => {
            const w = m.get(id)
            return w ? Effect.succeed(w) : Effect.fail(new WorkerStateNotFoundError(id))
          })),
        set: (worker: Worker) =>
          Ref.update(store, (m) => { const n = new Map(m); n.set(worker.id, worker); return n }),
        list: (filter: WorkerFilter) =>
          Ref.get(store).pipe(Effect.map((m) => {
            let r = Array.from(m.values()).filter((w) => matchesFilter(w, filter))
            if (filter.offset) r = r.slice(filter.offset)
            if (filter.limit) r = r.slice(0, filter.limit)
            return r
          })),
        listByCrew: (crewId: CrewId) =>
          Ref.get(store).pipe(Effect.map((m) =>
            Array.from(m.values()).filter((w) =>
              Option.isSome(w.crewId) && w.crewId.value === crewId
            )
          )),
        delete: (id: WorkerId) =>
          Ref.modify(store, (m) => {
            if (m.has(id)) { const n = new Map(m); n.delete(id); return [true, n] as const }
            return [false, m] as const
          }),
        exists: (id: WorkerId) => Ref.get(store).pipe(Effect.map((m) => m.has(id))),
        count: (filter: WorkerFilter) =>
          Ref.get(store).pipe(Effect.map((m) =>
            Array.from(m.values()).filter((w) => matchesFilter(w, filter)).length
          )),
      } satisfies WorkerStateShape
    })
  )
)
