/**
 * Projection scheduling contracts and memory admission controls.
 *
 * This file is the SEDA-shaped boundary layer for ProjectionWorker execution:
 * work becomes visible as `ProjectionWorkItem`, admission is an explicit
 * decision, and local pressure controls remain subordinate to durable
 * Timescale/LNK authority.
 *
 * @module @tmnl/pct/frames/ProjectionScheduling
 */

import * as Context from "effect-v4/Context"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Option from "effect-v4/Option"
import * as Ref from "effect-v4/Ref"
import * as Schema from "effect-v4/Schema"
import * as Semaphore from "effect-v4/Semaphore"

import {
  ProjectionRunMode,
  ProjectionWorkerRunSummary,
  type ProjectionRunMode as ProjectionRunModeType,
  type ProjectionWorkerConfig,
  type ProjectionWorkerRunSummary as ProjectionWorkerRunSummaryType,
} from "./ProjectionWorker.js"

// ─── Scheduling vocabulary ─────────────────────────────────────────────────

export const ProjectionWorkLane = Schema.Literals([
  "hot",
  "replay",
  "backfill",
])
export type ProjectionWorkLane = typeof ProjectionWorkLane.Type

export const ProjectionAdmissionStatus = Schema.Literals([
  "admitted",
  "duplicate-in-flight",
  "parked",
  "rejected",
])
export type ProjectionAdmissionStatus = typeof ProjectionAdmissionStatus.Type

export const ProjectionParkingReason = Schema.Literals([
  "duplicate-in-flight",
  "hot-key-busy",
  "global-budget-exhausted",
  "queue-full",
  "retry-delay",
  "stale-worker",
  "manual-pause",
  "runner-failed",
])
export type ProjectionParkingReason = typeof ProjectionParkingReason.Type

export const ProjectionRetryPolicy = Schema.Struct({
  maxAttempts: Schema.Int,
  baseDelayMs: Schema.Int,
})
export type ProjectionRetryPolicy = typeof ProjectionRetryPolicy.Type

export const ProjectionWorkLease = Schema.Struct({
  workId: Schema.String,
  workerId: Schema.String,
  leasedAt: Schema.Number,
  expiresAt: Schema.Number,
  fenceToken: Schema.String,
})
export type ProjectionWorkLease = typeof ProjectionWorkLease.Type

export const ProjectionWorkItem = Schema.Struct({
  workId: Schema.String,
  projectionId: Schema.String,
  workerId: Schema.String,
  mode: ProjectionRunMode,
  lane: ProjectionWorkLane,
  /** Stable key used to coalesce duplicate in-flight work. */
  duplicateKey: Schema.String,
  /** Stable key used to serialize hot targets such as one projection/table. */
  targetKey: Schema.String,
  attempt: Schema.Int,
  priority: Schema.Int,
  maxMessagesPerTick: Schema.Int,
  idlePollMs: Schema.Int,
  enqueuedAt: Schema.Number,
  availableAt: Schema.Number,
})
export type ProjectionWorkItem = typeof ProjectionWorkItem.Type

export const ProjectionAdmissionDecision = Schema.Struct({
  status: ProjectionAdmissionStatus,
  work: ProjectionWorkItem,
  reason: Schema.NullOr(ProjectionParkingReason),
  message: Schema.NullOr(Schema.String),
  decidedAt: Schema.Number,
})
export type ProjectionAdmissionDecision = typeof ProjectionAdmissionDecision.Type

export const ProjectionParkingRecord = Schema.Struct({
  work: ProjectionWorkItem,
  reason: ProjectionParkingReason,
  message: Schema.NullOr(Schema.String),
  parkedAt: Schema.Number,
  retryAt: Schema.NullOr(Schema.Number),
})
export type ProjectionParkingRecord = typeof ProjectionParkingRecord.Type

export const ProjectionLanePressure = Schema.Struct({
  lane: ProjectionWorkLane,
  enqueued: Schema.Number,
  admitted: Schema.Number,
  parked: Schema.Number,
  rejected: Schema.Number,
})
export type ProjectionLanePressure = typeof ProjectionLanePressure.Type

export const ProjectionSchedulerPressureSnapshot = Schema.Struct({
  inFlight: Schema.Number,
  parked: Schema.Number,
  completed: Schema.Number,
  failed: Schema.Number,
  duplicateInFlight: Schema.Number,
  rejected: Schema.Number,
  lanePressure: Schema.Array(ProjectionLanePressure),
  targetInFlight: Schema.Record(Schema.String, Schema.Number),
  reportedAt: Schema.Number,
})
export type ProjectionSchedulerPressureSnapshot = typeof ProjectionSchedulerPressureSnapshot.Type

export const ProjectionSchedulerLookSeverity = Schema.Literals([
  "info",
  "warn",
  "critical",
])
export type ProjectionSchedulerLookSeverity = typeof ProjectionSchedulerLookSeverity.Type

export const ProjectionSchedulerLaneLook = Schema.Struct({
  lane: ProjectionWorkLane,
  priority: Schema.Int,
  parked: Schema.Number,
  ready: Schema.Number,
  nextReadyAt: Schema.NullOr(Schema.Number),
  oldestParkedAt: Schema.NullOr(Schema.Number),
})
export type ProjectionSchedulerLaneLook = typeof ProjectionSchedulerLaneLook.Type

export const ProjectionSchedulerFinding = Schema.Struct({
  severity: ProjectionSchedulerLookSeverity,
  code: Schema.String,
  message: Schema.String,
  lane: Schema.NullOr(ProjectionWorkLane),
  targetKey: Schema.NullOr(Schema.String),
  count: Schema.Number,
})
export type ProjectionSchedulerFinding = typeof ProjectionSchedulerFinding.Type

export const ProjectionSchedulerLookout = Schema.Struct({
  pressure: ProjectionSchedulerPressureSnapshot,
  lanes: Schema.Array(ProjectionSchedulerLaneLook),
  nextReady: Schema.Array(ProjectionWorkItem),
  findings: Schema.Array(ProjectionSchedulerFinding),
  lookedAt: Schema.Number,
})
export type ProjectionSchedulerLookout = typeof ProjectionSchedulerLookout.Type

// ─── Helpers ────────────────────────────────────────────────────────────────

const lanePriority = (lane: ProjectionWorkLane): number => {
  switch (lane) {
    case "hot":
      return 100
    case "replay":
      return 50
    case "backfill":
      return 10
  }
}

export interface MakeProjectionWorkItemOptions {
  readonly lane?: ProjectionWorkLane
  readonly duplicateKey?: string
  readonly targetKey?: string
  readonly attempt?: number
  readonly priority?: number
  readonly now?: number
}

export const makeProjectionWorkItem = (
  config: ProjectionWorkerConfig,
  options: MakeProjectionWorkItemOptions = {},
): ProjectionWorkItem => {
  const lane = options.lane ?? (config.mode === "tail" ? "hot" : "replay")
  const at = options.now ?? Date.now()
  const targetKey = options.targetKey ?? config.spec.id
  const duplicateKey = options.duplicateKey ?? `${config.spec.id}:${config.mode}:${targetKey}`
  return ProjectionWorkItem.make({
    workId: `${config.workerId}:${config.mode}:${at}:${options.attempt ?? 0}`,
    projectionId: config.spec.id,
    workerId: config.workerId,
    mode: config.mode,
    lane,
    duplicateKey,
    targetKey,
    attempt: options.attempt ?? 0,
    priority: options.priority ?? lanePriority(lane),
    maxMessagesPerTick: config.maxMessagesPerTick,
    idlePollMs: config.idlePollMs,
    enqueuedAt: at,
    availableAt: at,
  })
}

const emptyLanePressure = (lane: ProjectionWorkLane): ProjectionLanePressure =>
  ProjectionLanePressure.make({
    lane,
    enqueued: 0,
    admitted: 0,
    parked: 0,
    rejected: 0,
  })

const lanes: ReadonlyArray<ProjectionWorkLane> = ["hot", "replay", "backfill"]

// ─── Settings ───────────────────────────────────────────────────────────────

export interface ProjectionSchedulerTuningShape {
  readonly maxConcurrentTicks: number
  readonly maxInFlightPerTarget: number
  readonly maxParked: number
  readonly defaultRetryDelayMs: number
  readonly maxRetryAttempts: number
}

export class ProjectionSchedulerTuning extends Context.Service<
  ProjectionSchedulerTuning,
  ProjectionSchedulerTuningShape
>()("@tmnl/pct/frames/ProjectionSchedulerTuning") {}

export const DEFAULT_PROJECTION_SCHEDULER_TUNING: ProjectionSchedulerTuningShape = {
  maxConcurrentTicks: 4,
  maxInFlightPerTarget: 1,
  maxParked: 1_000,
  defaultRetryDelayMs: 1_000,
  maxRetryAttempts: 3,
}

export const projectionSchedulerTuningLayer = (
  tuning: Partial<ProjectionSchedulerTuningShape> = {},
): Layer.Layer<ProjectionSchedulerTuning> =>
  Layer.succeed(
    ProjectionSchedulerTuning,
    ProjectionSchedulerTuning.of({
      ...DEFAULT_PROJECTION_SCHEDULER_TUNING,
      ...tuning,
    }),
  )

// ─── Ledger port ────────────────────────────────────────────────────────────

export interface ProjectionWorkLedgerShape {
  readonly recordEnqueued: (work: ProjectionWorkItem) => Effect.Effect<void>
  readonly recordDecision: (decision: ProjectionAdmissionDecision) => Effect.Effect<void>
  readonly recordCompleted: (
    work: ProjectionWorkItem,
    summary: ProjectionWorkerRunSummaryType,
  ) => Effect.Effect<void>
  readonly recordFailed: (work: ProjectionWorkItem, error: string) => Effect.Effect<void>
  readonly recordParked: (record: ProjectionParkingRecord) => Effect.Effect<void>
  readonly parked: Effect.Effect<ReadonlyArray<ProjectionParkingRecord>>
  readonly pressure: Effect.Effect<ProjectionSchedulerPressureSnapshot>
}

export class ProjectionWorkLedger extends Context.Service<
  ProjectionWorkLedger,
  ProjectionWorkLedgerShape
>()("@tmnl/pct/frames/ProjectionWorkLedger") {}

interface MemoryLedgerState {
  readonly enqueued: ReadonlyArray<ProjectionWorkItem>
  readonly decisions: ReadonlyArray<ProjectionAdmissionDecision>
  readonly parked: ReadonlyArray<ProjectionParkingRecord>
  readonly completed: number
  readonly failed: number
}

const pressureFromLedgerState = (
  state: MemoryLedgerState,
  targetInFlight: ReadonlyMap<string, number> = new Map(),
): ProjectionSchedulerPressureSnapshot => {
  const byLane = new Map<ProjectionWorkLane, ProjectionLanePressure>(
    lanes.map((lane) => [lane, emptyLanePressure(lane)]),
  )

  for (const work of state.enqueued) {
    const current = byLane.get(work.lane) ?? emptyLanePressure(work.lane)
    byLane.set(work.lane, ProjectionLanePressure.make({ ...current, enqueued: current.enqueued + 1 }))
  }
  for (const decision of state.decisions) {
    const current = byLane.get(decision.work.lane) ?? emptyLanePressure(decision.work.lane)
    if (decision.status === "admitted") {
      byLane.set(decision.work.lane, ProjectionLanePressure.make({ ...current, admitted: current.admitted + 1 }))
    } else if (decision.status === "parked" || decision.status === "duplicate-in-flight") {
      byLane.set(decision.work.lane, ProjectionLanePressure.make({ ...current, parked: current.parked + 1 }))
    } else if (decision.status === "rejected") {
      byLane.set(decision.work.lane, ProjectionLanePressure.make({ ...current, rejected: current.rejected + 1 }))
    }
  }

  const targetRecord: Record<string, number> = {}
  for (const [key, count] of targetInFlight) targetRecord[key] = count

  return ProjectionSchedulerPressureSnapshot.make({
    inFlight: Array.from(targetInFlight.values()).reduce((sum, count) => sum + count, 0),
    parked: state.parked.length,
    completed: state.completed,
    failed: state.failed,
    duplicateInFlight: state.decisions.filter((decision) => decision.status === "duplicate-in-flight").length,
    rejected: state.decisions.filter((decision) => decision.status === "rejected").length,
    lanePressure: Array.from(byLane.values()),
    targetInFlight: targetRecord,
    reportedAt: Date.now(),
  })
}

export const projectionWorkLedgerLayerMemory: Layer.Layer<ProjectionWorkLedger> = Layer.effect(
  ProjectionWorkLedger,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<MemoryLedgerState>({
      enqueued: [],
      decisions: [],
      parked: [],
      completed: 0,
      failed: 0,
    })

    return ProjectionWorkLedger.of({
      recordEnqueued: (work) =>
        Ref.update(stateRef, (state) => ({ ...state, enqueued: [...state.enqueued, work] })),
      recordDecision: (decision) =>
        Ref.update(stateRef, (state) => ({ ...state, decisions: [...state.decisions, decision] })),
      recordCompleted: () =>
        Ref.update(stateRef, (state) => ({ ...state, completed: state.completed + 1 })),
      recordFailed: () =>
        Ref.update(stateRef, (state) => ({ ...state, failed: state.failed + 1 })),
      recordParked: (record) =>
        Ref.update(stateRef, (state) => ({ ...state, parked: [...state.parked, record] })),
      parked: Effect.map(Ref.get(stateRef), (state) => state.parked),
      pressure: Effect.map(Ref.get(stateRef), (state) => pressureFromLedgerState(state)),
    })
  }),
)

// ─── Admission controller port ──────────────────────────────────────────────

export interface ProjectionAdmissionRunResult<A> {
  readonly decision: ProjectionAdmissionDecision
  readonly result: A | undefined
}

export interface DrainReadyProjectionWorkOptions {
  readonly projectionId?: string
  readonly workerId?: string
  readonly lane?: ProjectionWorkLane
  readonly limit?: number
  readonly now?: number
}

export interface ProjectionSchedulerLookOptions extends DrainReadyProjectionWorkOptions {}

export interface ProjectionAdmissionControllerShape {
  readonly runAdmitted: <A, E, R>(
    work: ProjectionWorkItem,
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<ProjectionAdmissionRunResult<A>, E, R>
  readonly drainReady: (
    options?: DrainReadyProjectionWorkOptions,
  ) => Effect.Effect<ReadonlyArray<ProjectionWorkItem>>
  /**
   * Internal diagnostic view used by tests/operator adapters before they choose a stable surface.
   * Do not expose directly over the ProjectionWorker control plane.
   */
  readonly debugLook: (
    options?: ProjectionSchedulerLookOptions,
  ) => Effect.Effect<ProjectionSchedulerLookout>
  readonly release: (work: ProjectionWorkItem) => Effect.Effect<void>
  readonly parked: Effect.Effect<ReadonlyArray<ProjectionParkingRecord>>
  readonly pressure: Effect.Effect<ProjectionSchedulerPressureSnapshot>
}

export class ProjectionAdmissionController extends Context.Service<
  ProjectionAdmissionController,
  ProjectionAdmissionControllerShape
>()("@tmnl/pct/frames/ProjectionAdmissionController") {}

interface MemoryAdmissionState {
  readonly inFlightDuplicateKeys: ReadonlySet<string>
  readonly targetInFlight: ReadonlyMap<string, number>
  readonly parked: ReadonlyArray<ProjectionParkingRecord>
  readonly decisions: ReadonlyArray<ProjectionAdmissionDecision>
  readonly completed: number
  readonly failed: number
}

const decision = (
  work: ProjectionWorkItem,
  status: ProjectionAdmissionStatus,
  reason: ProjectionParkingReason | null,
  message: string | null,
): ProjectionAdmissionDecision =>
  ProjectionAdmissionDecision.make({
    work,
    status,
    reason,
    message,
    decidedAt: Date.now(),
  })

const parkingRecord = (
  work: ProjectionWorkItem,
  reason: ProjectionParkingReason,
  message: string | null,
  retryDelayMs: number,
): ProjectionParkingRecord =>
  ProjectionParkingRecord.make({
    work,
    reason,
    message,
    parkedAt: Date.now(),
    retryAt: Date.now() + retryDelayMs,
  })

const releaseFromState = (
  state: MemoryAdmissionState,
  work: ProjectionWorkItem,
  completed: boolean,
): MemoryAdmissionState => {
  const duplicateKeys = new Set(state.inFlightDuplicateKeys)
  duplicateKeys.delete(work.duplicateKey)
  const targetInFlight = new Map(state.targetInFlight)
  const currentTargetCount = targetInFlight.get(work.targetKey) ?? 0
  if (currentTargetCount <= 1) targetInFlight.delete(work.targetKey)
  else targetInFlight.set(work.targetKey, currentTargetCount - 1)
  return {
    ...state,
    inFlightDuplicateKeys: duplicateKeys,
    targetInFlight,
    completed: completed ? state.completed + 1 : state.completed,
  }
}

const pressureFromAdmissionState = (state: MemoryAdmissionState): ProjectionSchedulerPressureSnapshot =>
  pressureFromLedgerState(
    {
      enqueued: state.decisions.map((entry) => entry.work),
      decisions: state.decisions,
      parked: state.parked,
      completed: state.completed,
      failed: state.failed,
    },
    state.targetInFlight,
  )

const parkedKey = (record: ProjectionParkingRecord): string =>
  `${record.work.workId}:${record.parkedAt}:${record.reason}`

const retryWork = (work: ProjectionWorkItem, at: number): ProjectionWorkItem =>
  ProjectionWorkItem.make({
    ...work,
    workId: `${work.workerId}:${work.mode}:retry:${at}:${work.attempt + 1}`,
    attempt: work.attempt + 1,
    enqueuedAt: at,
    availableAt: at,
  })

const readyRecords = (
  parked: ReadonlyArray<ProjectionParkingRecord>,
  options: DrainReadyProjectionWorkOptions,
): ReadonlyArray<ProjectionParkingRecord> => {
  const at = options.now ?? Date.now()
  return parked
    .filter((record) => record.retryAt === null || record.retryAt <= at)
    .filter((record) => options.projectionId === undefined || record.work.projectionId === options.projectionId)
    .filter((record) => options.workerId === undefined || record.work.workerId === options.workerId)
    .filter((record) => options.lane === undefined || record.work.lane === options.lane)
    .sort((a, b) =>
      b.work.priority - a.work.priority ||
      a.work.availableAt - b.work.availableAt ||
      a.parkedAt - b.parkedAt,
    )
}

const lookFromAdmissionState = (
  state: MemoryAdmissionState,
  tuning: ProjectionSchedulerTuningShape,
  options: ProjectionSchedulerLookOptions = {},
): ProjectionSchedulerLookout => {
  const lookedAt = options.now ?? Date.now()
  const limit = options.limit ?? 5
  const ready = readyRecords(state.parked, { ...options, now: lookedAt })
  const lanesLook = lanes.map((lane) => {
    const records = state.parked.filter((record) => record.work.lane === lane)
    const laneReady = readyRecords(records, { ...options, lane, now: lookedAt })
    const retryAts = records
      .map((record) => record.retryAt)
      .filter((retryAt): retryAt is number => retryAt !== null)
    const parkedAts = records.map((record) => record.parkedAt)
    return ProjectionSchedulerLaneLook.make({
      lane,
      priority: lanePriority(lane),
      parked: records.length,
      ready: laneReady.length,
      nextReadyAt: retryAts.length === 0 ? null : Math.min(...retryAts),
      oldestParkedAt: parkedAts.length === 0 ? null : Math.min(...parkedAts),
    })
  })

  const findings: Array<ProjectionSchedulerFinding> = []
  if (state.parked.length >= Math.floor(tuning.maxParked * 0.8)) {
    findings.push(ProjectionSchedulerFinding.make({
      severity: state.parked.length >= tuning.maxParked ? "critical" : "warn",
      code: "parking-capacity-pressure",
      message: "projection scheduler parking capacity is approaching its configured limit",
      lane: null,
      targetKey: null,
      count: state.parked.length,
    }))
  }
  if (state.decisions.some((entry) => entry.status === "duplicate-in-flight")) {
    findings.push(ProjectionSchedulerFinding.make({
      severity: "info",
      code: "duplicate-singleflight-active",
      message: "duplicate projection work has been coalesced behind an in-flight key",
      lane: null,
      targetKey: null,
      count: state.decisions.filter((entry) => entry.status === "duplicate-in-flight").length,
    }))
  }
  for (const [targetKey, count] of state.targetInFlight) {
    if (count >= tuning.maxInFlightPerTarget) {
      findings.push(ProjectionSchedulerFinding.make({
        severity: "warn",
        code: "target-key-saturated",
        message: "projection target key is at its local admission limit",
        lane: null,
        targetKey,
        count,
      }))
    }
  }
  for (const lane of lanesLook) {
    if (lane.ready > 0) {
      findings.push(ProjectionSchedulerFinding.make({
        severity: "info",
        code: "lane-ready",
        message: `${lane.lane} lane has parked work ready to drain`,
        lane: lane.lane,
        targetKey: null,
        count: lane.ready,
      }))
    }
  }

  return ProjectionSchedulerLookout.make({
    pressure: pressureFromAdmissionState(state),
    lanes: lanesLook,
    nextReady: ready.slice(0, limit).map((record) => retryWork(record.work, lookedAt)),
    findings,
    lookedAt,
  })
}

export const projectionAdmissionControllerLayerMemory: Layer.Layer<
  ProjectionAdmissionController,
  never,
  ProjectionSchedulerTuning
> = Layer.effect(
  ProjectionAdmissionController,
  Effect.gen(function* () {
    const tuning = yield* ProjectionSchedulerTuning
    const globalBudget = yield* Semaphore.make(tuning.maxConcurrentTicks)
    const stateRef = yield* Ref.make<MemoryAdmissionState>({
      inFlightDuplicateKeys: new Set(),
      targetInFlight: new Map(),
      parked: [],
      decisions: [],
      completed: 0,
      failed: 0,
    })

    const release = (work: ProjectionWorkItem, completed = false): Effect.Effect<void> =>
      Ref.update(stateRef, (state) => releaseFromState(state, work, completed))

    const park = (
      work: ProjectionWorkItem,
      reason: ProjectionParkingReason,
      message: string | null,
    ): Effect.Effect<ProjectionAdmissionDecision> =>
      Ref.modify(stateRef, (state) => {
        if (work.attempt >= tuning.maxRetryAttempts) {
          const rejected = decision(work, "rejected", reason, message ?? "projection scheduler retry budget exhausted")
          return [rejected, { ...state, decisions: [...state.decisions, rejected] }] as const
        }
        if (state.parked.length >= tuning.maxParked) {
          const rejected = decision(work, "rejected", "queue-full", "projection scheduler parking capacity exhausted")
          return [rejected, { ...state, decisions: [...state.decisions, rejected] }] as const
        }
        const parked = parkingRecord(work, reason, message, tuning.defaultRetryDelayMs)
        const parkedDecision = decision(work, reason === "duplicate-in-flight" ? "duplicate-in-flight" : "parked", reason, message)
        return [
          parkedDecision,
          {
            ...state,
            parked: [...state.parked, parked],
            decisions: [...state.decisions, parkedDecision],
          },
        ] as const
      })

    const admitLocal = (work: ProjectionWorkItem): Effect.Effect<ProjectionAdmissionDecision> =>
      Ref.modify(stateRef, (state) => {
        if (state.inFlightDuplicateKeys.has(work.duplicateKey)) {
          const duplicate = decision(work, "duplicate-in-flight", "duplicate-in-flight", "matching projection work is already in flight")
          return [duplicate, { ...state, decisions: [...state.decisions, duplicate] }] as const
        }
        const targetCount = state.targetInFlight.get(work.targetKey) ?? 0
        if (targetCount >= tuning.maxInFlightPerTarget) {
          if (work.attempt >= tuning.maxRetryAttempts) {
            const rejected = decision(work, "rejected", "hot-key-busy", "projection scheduler retry budget exhausted")
            return [rejected, { ...state, decisions: [...state.decisions, rejected] }] as const
          }
          const parked = parkingRecord(work, "hot-key-busy", "projection target key is saturated", tuning.defaultRetryDelayMs)
          const parkedDecision = decision(work, "parked", "hot-key-busy", "projection target key is saturated")
          return [
            parkedDecision,
            {
              ...state,
              parked: [...state.parked, parked],
              decisions: [...state.decisions, parkedDecision],
            },
          ] as const
        }
        const duplicateKeys = new Set(state.inFlightDuplicateKeys)
        duplicateKeys.add(work.duplicateKey)
        const targetInFlight = new Map(state.targetInFlight)
        targetInFlight.set(work.targetKey, targetCount + 1)
        const admitted = decision(work, "admitted", null, null)
        return [
          admitted,
          {
            ...state,
            inFlightDuplicateKeys: duplicateKeys,
            targetInFlight,
            decisions: [...state.decisions, admitted],
          },
        ] as const
      })

    const drainReady = (
      options: DrainReadyProjectionWorkOptions = {},
    ): Effect.Effect<ReadonlyArray<ProjectionWorkItem>> =>
      Ref.modify(stateRef, (state) => {
        const at = options.now ?? Date.now()
        const limit = options.limit ?? 1
        const ready = readyRecords(state.parked, { ...options, now: at }).slice(0, limit)
        const selected = new Set(ready.map(parkedKey))
        return [
          ready.map((record) => retryWork(record.work, at)),
          {
            ...state,
            parked: state.parked.filter((record) => !selected.has(parkedKey(record))),
          },
        ] as const
      })

    return ProjectionAdmissionController.of({
      runAdmitted: (work, effect) =>
        Effect.gen(function* () {
          const admitted = yield* admitLocal(work)
          if (admitted.status !== "admitted") return { decision: admitted, result: undefined }

          const maybeResult = yield* globalBudget.withPermitsIfAvailable(1)(effect).pipe(
            Effect.ensuring(release(work, false)),
          )
          if (Option.isNone(maybeResult)) {
            const parked = yield* park(work, "global-budget-exhausted", "projection worker pool budget exhausted")
            return { decision: parked, result: undefined }
          }
          yield* Ref.update(stateRef, (state) => ({ ...state, completed: state.completed + 1 }))
          return { decision: admitted, result: maybeResult.value }
        }),
      drainReady,
      debugLook: (options = {}) => Effect.map(Ref.get(stateRef), (state) => lookFromAdmissionState(state, tuning, options)),
      release: (work) => release(work, false),
      parked: Effect.map(Ref.get(stateRef), (state) => state.parked),
      pressure: Effect.map(Ref.get(stateRef), pressureFromAdmissionState),
    })
  }),
)

const defaultProjectionSchedulerTuningLayer = projectionSchedulerTuningLayer()

export const projectionSchedulingMemoryLayer: Layer.Layer<
  ProjectionWorkLedger | ProjectionAdmissionController | ProjectionSchedulerTuning
> = Layer.mergeAll(
  projectionWorkLedgerLayerMemory,
  defaultProjectionSchedulerTuningLayer,
  projectionAdmissionControllerLayerMemory.pipe(Layer.provide(defaultProjectionSchedulerTuningLayer)),
)
