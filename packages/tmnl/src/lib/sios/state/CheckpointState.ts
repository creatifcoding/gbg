/**
 * CheckpointState Service — Context.Tag + in-memory
 * @module sios/state/CheckpointState
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import { Checkpoint, CreateCheckpointParams, type CheckpointStatus } from '../schemas/checkpoint'
import type { CheckpointId, WorkPackageId, ZoneId } from '../schemas/identifiers'

let cpCounter = 0
const genCheckpointId = (): CheckpointId => `CP-${Date.now().toString(36)}-${++cpCounter}` as CheckpointId

export interface CheckpointFilter {
  readonly workPackageId?: WorkPackageId
  readonly zoneId?: ZoneId
  readonly status?: CheckpointStatus
  readonly limit?: number
  readonly offset?: number
}

export class CheckpointStateNotFoundError {
  readonly _tag = 'CheckpointStateNotFoundError'
  constructor(readonly checkpointId: CheckpointId) {}
}

export interface CheckpointStateShape {
  readonly create: (params: CreateCheckpointParams) => Effect.Effect<Checkpoint>
  readonly get: (id: CheckpointId) => Effect.Effect<Checkpoint, CheckpointStateNotFoundError>
  readonly set: (cp: Checkpoint) => Effect.Effect<void>
  readonly list: (filter: CheckpointFilter) => Effect.Effect<readonly Checkpoint[]>
  readonly listByWorkPackage: (wpId: WorkPackageId) => Effect.Effect<readonly Checkpoint[]>
  readonly delete: (id: CheckpointId) => Effect.Effect<boolean>
  readonly exists: (id: CheckpointId) => Effect.Effect<boolean>
  readonly count: (filter: CheckpointFilter) => Effect.Effect<number>
}

export class CheckpointState extends Context.Tag('sios/CheckpointState')<CheckpointState, CheckpointStateShape>() {}

export const CheckpointStateInMemory: Layer.Layer<CheckpointState> = Layer.effect(
  CheckpointState,
  Ref.make(new Map<CheckpointId, Checkpoint>()).pipe(
    Effect.map((store) => {
      const matchesFilter = (cp: Checkpoint, f: CheckpointFilter): boolean => {
        if (f.workPackageId && cp.workPackageId !== f.workPackageId) return false
        if (f.zoneId && (!Option.isSome(cp.zoneId) || cp.zoneId.value !== f.zoneId)) return false
        if (f.status && cp.status !== f.status) return false
        return true
      }
      return {
        create: (params: CreateCheckpointParams) =>
          Effect.gen(function* () {
            const id = genCheckpointId()
            const now = yield* DateTime.now
            const cp = new Checkpoint({
              id, workPackageId: params.workPackageId,
              zoneId: params.zoneId ? Option.some(params.zoneId) : Option.none(),
              name: params.name, status: 'pending',
              description: params.description ? Option.some(params.description) : Option.none(),
              category: params.category,
              checklistItems: params.checklistItems ?? [],
              requiredEvidence: params.requiredEvidence ?? [],
              collectedEvidence: [],
              inspectorId: params.inspectorId ? Option.some(params.inspectorId) : Option.none(),
              scheduledDate: params.scheduledDate ? Option.some(params.scheduledDate) : Option.none(),
              completedDate: Option.none(),
              failureReason: Option.none(),
              waiverReason: Option.none(), waiverApprovedBy: Option.none(),
              createdAt: now, updatedAt: Option.none(), metadata: {},
            })
            yield* Ref.update(store, (m) => { const n = new Map(m); n.set(id, cp); return n })
            return cp
          }),
        get: (id: CheckpointId) =>
          Ref.get(store).pipe(Effect.flatMap((m) => {
            const cp = m.get(id)
            return cp ? Effect.succeed(cp) : Effect.fail(new CheckpointStateNotFoundError(id))
          })),
        set: (cp: Checkpoint) =>
          Ref.update(store, (m) => { const n = new Map(m); n.set(cp.id, cp); return n }),
        list: (filter: CheckpointFilter) =>
          Ref.get(store).pipe(Effect.map((m) => {
            let r = Array.from(m.values()).filter((cp) => matchesFilter(cp, filter))
            if (filter.offset) r = r.slice(filter.offset)
            if (filter.limit) r = r.slice(0, filter.limit)
            return r
          })),
        listByWorkPackage: (wpId: WorkPackageId) =>
          Ref.get(store).pipe(Effect.map((m) =>
            Array.from(m.values()).filter((cp) => cp.workPackageId === wpId)
          )),
        delete: (id: CheckpointId) =>
          Ref.modify(store, (m) => {
            if (m.has(id)) { const n = new Map(m); n.delete(id); return [true, n] as const }
            return [false, m] as const
          }),
        exists: (id: CheckpointId) => Ref.get(store).pipe(Effect.map((m) => m.has(id))),
        count: (filter: CheckpointFilter) =>
          Ref.get(store).pipe(Effect.map((m) =>
            Array.from(m.values()).filter((cp) => matchesFilter(cp, filter)).length
          )),
      } satisfies CheckpointStateShape
    })
  )
)
