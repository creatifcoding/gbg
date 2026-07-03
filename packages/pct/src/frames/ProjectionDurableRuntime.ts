/**
 * ProjectionWorker durable runtime contracts.
 *
 * These ports name the production authority seams behind the memory runtime:
 * durable source/state transactions, leases/fences, source checkpoints, and the
 * output outbox used to bridge Timescale frame rows to optional LNK frame
 * streams. No concrete database client lives here.
 *
 * @module @tmnl/pct/frames/ProjectionDurableRuntime
 */

import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Schema from "effect/Schema"

import {
  emptyProjectionPartLedgerState,
  frameTimeoutOutcome,
  ledgerDecisionForPart,
  mergeFramePart,
  recordLedgerDecision,
  type ProjectionPartLedgerState,
} from "./ProjectionAssembly.js"
import {
  FrameAssemblyState,
  FramePart,
  MaterializedFrame,
  ProjectionOutputKind,
  ProjectionOutputReceipt,
  ProjectionSourceMessage,
  ProjectionWorkerConfig,
  type FrameAssemblyState as FrameAssemblyStateType,
  type FramePart as FramePartType,
  type MaterializedFrame as MaterializedFrameType,
  type ProjectionOutputReceipt as ProjectionOutputReceiptType,
  type ProjectionSourceMessage as ProjectionSourceMessageType,
  type ProjectionWorkerConfig as ProjectionWorkerConfigType,
} from "./ProjectionWorker.js"

// ─── Durable vocabulary ────────────────────────────────────────────────────

export const ProjectionDurableWorkLane = Schema.Literals([
  "hot",
  "replay",
  "backfill",
  "timeout",
  "outbox",
])
export type ProjectionDurableWorkLane = typeof ProjectionDurableWorkLane.Type

export const ProjectionDurableIngestOutcome = Schema.Literals([
  "duplicate-source-offset",
  "accepted-part",
  "completed-frame",
])
export type ProjectionDurableIngestOutcome = typeof ProjectionDurableIngestOutcome.Type

export const ProjectionTimeoutSweepOutcome = Schema.Literals([
  "emitted-partial",
  "dropped-partial",
  "dead-lettered",
])
export type ProjectionTimeoutSweepOutcome = typeof ProjectionTimeoutSweepOutcome.Type

export const ProjectionOutboxStatus = Schema.Literals([
  "pending",
  "published",
  "failed",
  "poison",
])
export type ProjectionOutboxStatus = typeof ProjectionOutboxStatus.Type

export const ProjectionFrameEmissionState = Schema.Struct({
  frameId: Schema.String,
  latestRevision: Schema.Int,
  latestComplete: Schema.Boolean,
  emittedAt: Schema.Number,
})
export type ProjectionFrameEmissionState = typeof ProjectionFrameEmissionState.Type

export const ProjectionSourceBindingKey = Schema.Struct({
  projectionId: Schema.String,
  sourceStreamId: Schema.String,
  partKey: Schema.String,
})
export type ProjectionSourceBindingKey = typeof ProjectionSourceBindingKey.Type

export const ProjectionLeaseAcquire = Schema.Struct({
  projectionId: Schema.String,
  workerId: Schema.String,
  lane: ProjectionDurableWorkLane,
  targetKey: Schema.String,
  ttlMs: Schema.Int,
  now: Schema.optional(Schema.Number),
})
export type ProjectionLeaseAcquire = typeof ProjectionLeaseAcquire.Type

export const ProjectionLeaseRenew = Schema.Struct({
  leaseId: Schema.String,
  workerId: Schema.String,
  fenceToken: Schema.String,
  ttlMs: Schema.Int,
  now: Schema.optional(Schema.Number),
})
export type ProjectionLeaseRenew = typeof ProjectionLeaseRenew.Type

export const ProjectionLeaseRelease = Schema.Struct({
  leaseId: Schema.String,
  workerId: Schema.String,
  fenceToken: Schema.String,
  now: Schema.optional(Schema.Number),
})
export type ProjectionLeaseRelease = typeof ProjectionLeaseRelease.Type

export const ProjectionLease = Schema.Struct({
  leaseId: Schema.String,
  projectionId: Schema.String,
  workerId: Schema.String,
  lane: ProjectionDurableWorkLane,
  targetKey: Schema.String,
  fenceToken: Schema.String,
  leasedAt: Schema.Number,
  expiresAt: Schema.Number,
})
export type ProjectionLease = typeof ProjectionLease.Type

export const ProjectionCheckpointRecord = Schema.Struct({
  key: ProjectionSourceBindingKey,
  offset: Schema.String,
  fenceToken: Schema.String,
  updatedAt: Schema.Number,
})
export type ProjectionCheckpointRecord = typeof ProjectionCheckpointRecord.Type

export const ProjectionCheckpointCommit = Schema.Struct({
  key: ProjectionSourceBindingKey,
  offset: Schema.String,
  fenceToken: Schema.String,
  now: Schema.optional(Schema.Number),
})
export type ProjectionCheckpointCommit = typeof ProjectionCheckpointCommit.Type

export const ProjectionOutboxRecord = Schema.Struct({
  outboxId: Schema.String,
  projectionId: Schema.String,
  frameId: Schema.String,
  frameRevision: Schema.Int,
  kind: ProjectionOutputKind,
  target: Schema.String,
  idempotencyKey: Schema.String,
  producerId: Schema.String,
  producerEpoch: Schema.Int,
  producerSeq: Schema.Int,
  frame: MaterializedFrame,
  status: ProjectionOutboxStatus,
  attempt: Schema.Int,
  createdAt: Schema.Number,
  availableAt: Schema.Number,
  publishedAt: Schema.NullOr(Schema.Number),
  lastError: Schema.NullOr(Schema.String),
})
export type ProjectionOutboxRecord = typeof ProjectionOutboxRecord.Type

export const ProjectionOutboxPendingRequest = Schema.Struct({
  projectionId: Schema.optional(Schema.String),
  limit: Schema.Int,
  now: Schema.optional(Schema.Number),
})
export type ProjectionOutboxPendingRequest = typeof ProjectionOutboxPendingRequest.Type

export const ProjectionOutboxPublished = Schema.Struct({
  outboxId: Schema.String,
  receipt: ProjectionOutputReceipt,
  now: Schema.optional(Schema.Number),
})
export type ProjectionOutboxPublished = typeof ProjectionOutboxPublished.Type

export const ProjectionOutboxFailed = Schema.Struct({
  outboxId: Schema.String,
  error: Schema.String,
  retryAt: Schema.Number,
  poison: Schema.optional(Schema.Boolean),
  now: Schema.optional(Schema.Number),
})
export type ProjectionOutboxFailed = typeof ProjectionOutboxFailed.Type

export const ProjectionIngestPartInput = Schema.Struct({
  config: ProjectionWorkerConfig,
  message: ProjectionSourceMessage,
  part: FramePart,
  fenceToken: Schema.String,
  now: Schema.optional(Schema.Number),
})
export type ProjectionIngestPartInput = typeof ProjectionIngestPartInput.Type

export const ProjectionIngestPartResult = Schema.Struct({
  projectionId: Schema.String,
  frameId: Schema.String,
  outcome: ProjectionDurableIngestOutcome,
  duplicate: Schema.Boolean,
  state: FrameAssemblyState,
  materializedFrame: Schema.NullOr(MaterializedFrame),
  outboxRecords: Schema.Array(ProjectionOutboxRecord),
})
export type ProjectionIngestPartResult = typeof ProjectionIngestPartResult.Type

export const ProjectionTimeoutSweepInput = Schema.Struct({
  config: ProjectionWorkerConfig,
  limit: Schema.Int,
  fenceToken: Schema.String,
  now: Schema.Number,
})
export type ProjectionTimeoutSweepInput = typeof ProjectionTimeoutSweepInput.Type

export const ProjectionTimeoutSweepResult = Schema.Struct({
  projectionId: Schema.String,
  frameId: Schema.String,
  outcome: ProjectionTimeoutSweepOutcome,
  state: FrameAssemblyState,
  materializedFrame: Schema.NullOr(MaterializedFrame),
  outboxRecords: Schema.Array(ProjectionOutboxRecord),
})
export type ProjectionTimeoutSweepResult = typeof ProjectionTimeoutSweepResult.Type

// ─── Errors ─────────────────────────────────────────────────────────────────

export class ProjectionDurableStateError extends Schema.TaggedErrorClass<ProjectionDurableStateError>()(
  "ProjectionDurableStateError",
  {
    projectionId: Schema.String,
    message: Schema.String,
  },
) {}

export class ProjectionLeaseDenied extends Schema.TaggedErrorClass<ProjectionLeaseDenied>()(
  "ProjectionLeaseDenied",
  {
    projectionId: Schema.String,
    targetKey: Schema.String,
    message: Schema.String,
  },
) {}

export class ProjectionLeaseLost extends Schema.TaggedErrorClass<ProjectionLeaseLost>()(
  "ProjectionLeaseLost",
  {
    leaseId: Schema.String,
    workerId: Schema.String,
    message: Schema.String,
  },
) {}

export class ProjectionCheckpointError extends Schema.TaggedErrorClass<ProjectionCheckpointError>()(
  "ProjectionCheckpointError",
  {
    projectionId: Schema.String,
    sourceStreamId: Schema.String,
    partKey: Schema.String,
    message: Schema.String,
  },
) {}

export class ProjectionOutboxError extends Schema.TaggedErrorClass<ProjectionOutboxError>()(
  "ProjectionOutboxError",
  {
    outboxId: Schema.String,
    message: Schema.String,
  },
) {}

// ─── Ports ──────────────────────────────────────────────────────────────────

export interface ProjectionDurableStateStoreShape {
  readonly ingestPart: (
    input: ProjectionIngestPartInput,
  ) => Effect.Effect<ProjectionIngestPartResult, ProjectionDurableStateError>
  readonly sweepExpired: (
    input: ProjectionTimeoutSweepInput,
  ) => Effect.Effect<ReadonlyArray<ProjectionTimeoutSweepResult>, ProjectionDurableStateError>
}

export class ProjectionDurableStateStore extends Context.Service<
  ProjectionDurableStateStore,
  ProjectionDurableStateStoreShape
>()("@tmnl/pct/frames/ProjectionDurableStateStore") {}

export interface ProjectionLeaseStoreShape {
  readonly acquire: (input: ProjectionLeaseAcquire) => Effect.Effect<ProjectionLease, ProjectionLeaseDenied>
  readonly renew: (input: ProjectionLeaseRenew) => Effect.Effect<ProjectionLease, ProjectionLeaseLost>
  readonly release: (input: ProjectionLeaseRelease) => Effect.Effect<void, ProjectionLeaseLost>
}

export class ProjectionLeaseStore extends Context.Service<
  ProjectionLeaseStore,
  ProjectionLeaseStoreShape
>()("@tmnl/pct/frames/ProjectionLeaseStore") {}

export interface ProjectionCheckpointStoreShape {
  readonly get: (key: ProjectionSourceBindingKey) => Effect.Effect<string>
  readonly commit: (input: ProjectionCheckpointCommit) => Effect.Effect<ProjectionCheckpointRecord, ProjectionCheckpointError>
}

export class ProjectionCheckpointStore extends Context.Service<
  ProjectionCheckpointStore,
  ProjectionCheckpointStoreShape
>()("@tmnl/pct/frames/ProjectionCheckpointStore") {}

export interface ProjectionOutputOutboxShape {
  readonly pending: (request: ProjectionOutboxPendingRequest) => Effect.Effect<ReadonlyArray<ProjectionOutboxRecord>>
  readonly markPublished: (input: ProjectionOutboxPublished) => Effect.Effect<ProjectionOutboxRecord, ProjectionOutboxError>
  readonly markFailed: (input: ProjectionOutboxFailed) => Effect.Effect<ProjectionOutboxRecord, ProjectionOutboxError>
}

export class ProjectionOutputOutbox extends Context.Service<
  ProjectionOutputOutbox,
  ProjectionOutputOutboxShape
>()("@tmnl/pct/frames/ProjectionOutputOutbox") {}

// ─── Memory implementation for contract tests ──────────────────────────────

interface DurableMemoryState {
  readonly frames: ReadonlyMap<string, FrameAssemblyStateType>
  readonly ledger: ProjectionPartLedgerState
  readonly leases: ReadonlyMap<string, ProjectionLease>
  readonly checkpoints: ReadonlyMap<string, ProjectionCheckpointRecord>
  readonly outbox: ReadonlyMap<string, ProjectionOutboxRecord>
  readonly emissions: ReadonlyMap<string, ProjectionFrameEmissionState>
  readonly nextOutboxSeq: number
}

export interface ProjectionDurableRuntimeMemoryOptions {
  readonly failIngestBeforeCommit?: (input: ProjectionIngestPartInput) => boolean
  readonly failSweepBeforeCommit?: (input: ProjectionTimeoutSweepInput) => boolean
}

const emptyMemoryState = (): DurableMemoryState => ({
  frames: new Map(),
  ledger: emptyProjectionPartLedgerState(),
  leases: new Map(),
  checkpoints: new Map(),
  outbox: new Map(),
  emissions: new Map(),
  nextOutboxSeq: 0,
})

const checkpointKey = (key: ProjectionSourceBindingKey): string =>
  `${key.projectionId}\n${key.sourceStreamId}\n${key.partKey}`

const leaseKey = (input: { readonly projectionId: string; readonly lane: string; readonly targetKey: string }): string =>
  `${input.projectionId}\n${input.lane}\n${input.targetKey}`

const payloadFromState = (state: FrameAssemblyStateType): Record<string, unknown> => {
  const payload: Record<string, unknown> = {}
  for (const part of state.parts) payload[part.partKey] = part.payload
  return payload
}

const materializeFrame = (
  config: ProjectionWorkerConfigType,
  state: FrameAssemblyStateType,
  complete: boolean,
  frameRevision: number,
  emittedAt: number,
): MaterializedFrameType =>
  MaterializedFrame.make({
    projectionId: config.spec.id,
    projectionVersion: config.spec.id,
    outputSchemaId: config.spec.output.schemaId,
    frameId: state.frameId,
    frameTime: state.frameTime,
    entityKey: state.entityKey,
    complete,
    missingParts: state.completeness.missingParts,
    imputedParts: state.completeness.imputedParts,
    payload: payloadFromState(state),
    provenance: state.provenance,
    frameRevision,
    emittedAt,
  })

const makeOutboxRecord = (
  config: ProjectionWorkerConfigType,
  frame: MaterializedFrameType,
  producerSeq: number,
  now: number,
): ProjectionOutboxRecord | undefined => {
  const target = config.spec.output.streamId
  if (target === undefined) return undefined
  return ProjectionOutboxRecord.make({
    outboxId: `${frame.projectionId}:${frame.frameId}:${frame.frameRevision}:lnk-frame-stream`,
    projectionId: frame.projectionId,
    frameId: frame.frameId,
    frameRevision: frame.frameRevision,
    kind: "lnk-frame-stream",
    target,
    idempotencyKey: `${frame.projectionId}:${frame.frameId}:lnk:${frame.frameRevision}`,
    producerId: `projection-worker:${frame.projectionId}`,
    producerEpoch: 0,
    producerSeq,
    frame,
    status: "pending",
    attempt: 0,
    createdAt: now,
    availableAt: now,
    publishedAt: null,
    lastError: null,
  })
}

const requireOutbox = (
  state: DurableMemoryState,
  outboxId: string,
): Effect.Effect<ProjectionOutboxRecord, ProjectionOutboxError> => {
  const record = state.outbox.get(outboxId)
  return record === undefined
    ? Effect.fail(new ProjectionOutboxError({ outboxId, message: "projection outbox record not found" }))
    : Effect.succeed(record)
}

const nextFrameRevision = (
  state: DurableMemoryState,
  frameId: string,
): number => (state.emissions.get(frameId)?.latestRevision ?? 0) + 1

const markEmitted = (
  state: DurableMemoryState,
  frame: MaterializedFrameType,
): DurableMemoryState => ({
  ...state,
  emissions: new Map(state.emissions).set(frame.frameId, ProjectionFrameEmissionState.make({
    frameId: frame.frameId,
    latestRevision: frame.frameRevision,
    latestComplete: frame.complete,
    emittedAt: frame.emittedAt,
  })),
})

const alreadyEmittedPartial = (
  state: DurableMemoryState,
  frameId: string,
): boolean => state.emissions.get(frameId)?.latestComplete === false

export const projectionDurableRuntimeMemoryLayerWithFaults = (
  options: ProjectionDurableRuntimeMemoryOptions = {},
): Layer.Layer<
  ProjectionDurableStateStore | ProjectionLeaseStore | ProjectionCheckpointStore | ProjectionOutputOutbox
> => Layer.unwrap(
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<DurableMemoryState>(emptyMemoryState())

    const durableState = ProjectionDurableStateStore.of({
      ingestPart: (input) =>
        Effect.gen(function* () {
          const at = input.now ?? Date.now()
          const result = yield* mergeFramePart(
            input.config.spec,
            (yield* Ref.get(stateRef)).frames.get(input.part.frameId),
            input.part,
            at,
          ).pipe(
            Effect.mapError((error) => new ProjectionDurableStateError({ projectionId: input.config.spec.id, message: error.message })),
          )

          if (options.failIngestBeforeCommit?.(input) === true) {
            return yield* Effect.fail(new ProjectionDurableStateError({
              projectionId: input.config.spec.id,
              message: "injected ingest failure before durable commit",
            }))
          }

          return yield* Ref.modify(stateRef, (state) => {
            const decision = ledgerDecisionForPart(state.ledger, input.part, at)
            const existing = state.frames.get(input.part.frameId)
            if (decision.duplicate && existing !== undefined) {
              const duplicateResult = ProjectionIngestPartResult.make({
                projectionId: input.config.spec.id,
                frameId: input.part.frameId,
                outcome: "duplicate-source-offset",
                duplicate: true,
                state: existing,
                materializedFrame: null,
                outboxRecords: [],
              })
              return [duplicateResult, state] as const
            }

            const frameState = result.state
            const materialized = frameState.completeness.complete
              ? materializeFrame(input.config, frameState, true, nextFrameRevision(state, frameState.frameId), at)
              : null
            const outbox = materialized === null ? undefined : makeOutboxRecord(input.config, materialized, state.nextOutboxSeq, at)
            const nextOutbox = new Map(state.outbox)
            if (outbox !== undefined) nextOutbox.set(outbox.outboxId, outbox)
            const nextFrames = new Map(state.frames).set(frameState.frameId, frameState)
            const committed = materialized === null ? state : markEmitted(state, materialized)
            const next = {
              ...committed,
              frames: nextFrames,
              ledger: recordLedgerDecision(state.ledger, decision),
              outbox: nextOutbox,
              nextOutboxSeq: outbox === undefined ? state.nextOutboxSeq : state.nextOutboxSeq + 1,
            }
            return [
              ProjectionIngestPartResult.make({
                projectionId: input.config.spec.id,
                frameId: frameState.frameId,
                outcome: materialized === null ? "accepted-part" : "completed-frame",
                duplicate: false,
                state: frameState,
                materializedFrame: materialized,
                outboxRecords: outbox === undefined ? [] : [outbox],
              }),
              next,
            ] as const
          })
        }),

      sweepExpired: (input) =>
        Effect.gen(function* () {
          const at = input.now
          const current = yield* Ref.get(stateRef)
          const candidates = Array.from(current.frames.values())
            .filter((state) =>
              state.projectionId === input.config.spec.id &&
              !state.completeness.complete &&
              !alreadyEmittedPartial(current, state.frameId)
            )
            .sort((a, b) => a.deadlineAt.localeCompare(b.deadlineAt))
            .slice(0, input.limit)
          const results: ProjectionTimeoutSweepResult[] = []
          let nextState = current
          for (const frameState of candidates) {
            const outcome = yield* frameTimeoutOutcome(input.config.spec, frameState, at).pipe(
              Effect.mapError((error) => new ProjectionDurableStateError({ projectionId: input.config.spec.id, message: error.message })),
            )
            if (outcome === "none") continue
            const nextFrames = new Map(nextState.frames)
            let materialized: MaterializedFrameType | null = null
            let outboxRecords: ProjectionOutboxRecord[] = []
            let sweepOutcome: ProjectionTimeoutSweepOutcome
            if (outcome === "emitted-partial") {
              materialized = materializeFrame(input.config, frameState, false, nextFrameRevision(nextState, frameState.frameId), at)
              const outbox = makeOutboxRecord(input.config, materialized, nextState.nextOutboxSeq, at)
              const nextOutbox = new Map(nextState.outbox)
              if (outbox !== undefined) {
                nextOutbox.set(outbox.outboxId, outbox)
                outboxRecords = [outbox]
              }
              nextState = markEmitted({
                ...nextState,
                outbox: nextOutbox,
                nextOutboxSeq: outbox === undefined ? nextState.nextOutboxSeq : nextState.nextOutboxSeq + 1,
              }, materialized)
              sweepOutcome = "emitted-partial"
            } else if (outcome === "dropped-partial") {
              nextFrames.delete(frameState.frameId)
              sweepOutcome = "dropped-partial"
            } else {
              nextFrames.delete(frameState.frameId)
              sweepOutcome = "dead-lettered"
            }
            nextState = { ...nextState, frames: nextFrames }
            results.push(ProjectionTimeoutSweepResult.make({
              projectionId: input.config.spec.id,
              frameId: frameState.frameId,
              outcome: sweepOutcome,
              state: frameState,
              materializedFrame: materialized,
              outboxRecords,
            }))
          }
          if (options.failSweepBeforeCommit?.(input) === true) {
            return yield* Effect.fail(new ProjectionDurableStateError({
              projectionId: input.config.spec.id,
              message: "injected sweep failure before durable commit",
            }))
          }
          yield* Ref.set(stateRef, nextState)
          return results
        }),
    })

    const leases = ProjectionLeaseStore.of({
      acquire: (input) =>
        Effect.gen(function* () {
          const at = input.now ?? Date.now()
          const key = leaseKey(input)
          const state = yield* Ref.get(stateRef)
          const existing = state.leases.get(key)
          if (existing !== undefined && existing.expiresAt > at && existing.workerId !== input.workerId) {
            return yield* Effect.fail(new ProjectionLeaseDenied({
              projectionId: input.projectionId,
              targetKey: input.targetKey,
              message: `target is leased by ${existing.workerId}`,
            }))
          }
          const lease = ProjectionLease.make({
            leaseId: key,
            projectionId: input.projectionId,
            workerId: input.workerId,
            lane: input.lane,
            targetKey: input.targetKey,
            fenceToken: `${input.workerId}:${at}:${Math.random().toString(16).slice(2)}`,
            leasedAt: at,
            expiresAt: at + input.ttlMs,
          })
          yield* Ref.update(stateRef, (current) => ({
            ...current,
            leases: new Map(current.leases).set(key, lease),
          }))
          return lease
        }),

      renew: (input) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const existing = state.leases.get(input.leaseId)
          if (existing === undefined || existing.workerId !== input.workerId || existing.fenceToken !== input.fenceToken) {
            return yield* Effect.fail(new ProjectionLeaseLost({
              leaseId: input.leaseId,
              workerId: input.workerId,
              message: "lease is missing or fence token does not match",
            }))
          }
          const at = input.now ?? Date.now()
          const renewed = ProjectionLease.make({ ...existing, expiresAt: at + input.ttlMs })
          yield* Ref.update(stateRef, (current) => ({
            ...current,
            leases: new Map(current.leases).set(input.leaseId, renewed),
          }))
          return renewed
        }),

      release: (input) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const existing = state.leases.get(input.leaseId)
          if (existing === undefined || existing.workerId !== input.workerId || existing.fenceToken !== input.fenceToken) {
            return yield* Effect.fail(new ProjectionLeaseLost({
              leaseId: input.leaseId,
              workerId: input.workerId,
              message: "lease is missing or fence token does not match",
            }))
          }
          yield* Ref.update(stateRef, (current) => {
            const next = new Map(current.leases)
            next.delete(input.leaseId)
            return { ...current, leases: next }
          })
        }),
    })

    const checkpoints = ProjectionCheckpointStore.of({
      get: (key) => Effect.map(Ref.get(stateRef), (state) => state.checkpoints.get(checkpointKey(key))?.offset ?? "-1"),
      commit: (input) =>
        Effect.gen(function* () {
          const at = input.now ?? Date.now()
          const record = ProjectionCheckpointRecord.make({
            key: input.key,
            offset: input.offset,
            fenceToken: input.fenceToken,
            updatedAt: at,
          })
          yield* Ref.update(stateRef, (state) => ({
            ...state,
            checkpoints: new Map(state.checkpoints).set(checkpointKey(input.key), record),
          }))
          return record
        }),
    })

    const outbox = ProjectionOutputOutbox.of({
      pending: (request) =>
        Effect.map(Ref.get(stateRef), (state) => {
          const at = request.now ?? Date.now()
          return Array.from(state.outbox.values())
            .filter((record) => record.status === "pending" || record.status === "failed")
            .filter((record) => record.availableAt <= at)
            .filter((record) => request.projectionId === undefined || record.projectionId === request.projectionId)
            .sort((a, b) => a.createdAt - b.createdAt || a.outboxId.localeCompare(b.outboxId))
            .slice(0, request.limit)
        }),

      markPublished: (input) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const current = yield* requireOutbox(state, input.outboxId)
          const at = input.now ?? Date.now()
          const published = ProjectionOutboxRecord.make({
            ...current,
            status: "published",
            publishedAt: at,
            lastError: null,
          })
          yield* Ref.update(stateRef, (latest) => ({
            ...latest,
            outbox: new Map(latest.outbox).set(input.outboxId, published),
          }))
          return published
        }),

      markFailed: (input) =>
        Effect.gen(function* () {
          const state = yield* Ref.get(stateRef)
          const current = yield* requireOutbox(state, input.outboxId)
          const failed = ProjectionOutboxRecord.make({
            ...current,
            status: input.poison === true ? "poison" : "failed",
            attempt: current.attempt + 1,
            availableAt: input.retryAt,
            publishedAt: null,
            lastError: input.error,
          })
          yield* Ref.update(stateRef, (latest) => ({
            ...latest,
            outbox: new Map(latest.outbox).set(input.outboxId, failed),
          }))
          return failed
        }),
    })

    return Layer.mergeAll(
      Layer.succeed(ProjectionDurableStateStore, durableState),
      Layer.succeed(ProjectionLeaseStore, leases),
      Layer.succeed(ProjectionCheckpointStore, checkpoints),
      Layer.succeed(ProjectionOutputOutbox, outbox),
    )
  }),
)

export const projectionDurableRuntimeMemoryLayer: Layer.Layer<
  ProjectionDurableStateStore | ProjectionLeaseStore | ProjectionCheckpointStore | ProjectionOutputOutbox
> = projectionDurableRuntimeMemoryLayerWithFaults()
