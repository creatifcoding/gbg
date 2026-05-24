/**
 * ProjectionWorker scheduler/control plane.
 *
 * This is the generic lifecycle surface selected by the design deck: multiple
 * registered FrameProjectionSpec records, start/stop/status/runOnce/tail
 * operations, and a NATS-micro-compatible ProjectionWorkerControl provider.
 *
 * The scheduler is fundamentally an Effect fiber supervisor: `tail` and
 * long-running `start` operations fork scoped worker fibers, `Schedule` drives
 * recurring ticks, `Duration` owns timing, and a `Semaphore` serializes
 * lifecycle mutations. Actual frame assembly remains behind the
 * ProjectionWorkerRunner port so MSH never learns projection semantics.
 *
 * @module @tmnl/pct/frames/ProjectionScheduler
 */

import * as Context from "effect-v4/Context"
import * as Duration from "effect-v4/Duration"
import * as Effect from "effect-v4/Effect"
import * as Fiber from "effect-v4/Fiber"
import * as Layer from "effect-v4/Layer"
import * as Ref from "effect-v4/Ref"
import * as Schedule from "effect-v4/Schedule"
import * as Schema from "effect-v4/Schema"
import * as Scope from "effect-v4/Scope"
import * as Semaphore from "effect-v4/Semaphore"

import {
  ProjectionRunMode,
  ProjectionWorkerConfig,
  ProjectionWorkerRunSummary,
  ProjectionWorkerSnapshot,
  type ProjectionWorkerRunSummary as ProjectionWorkerRunSummaryType,
  type ProjectionWorkerSnapshot as ProjectionWorkerSnapshotType,
} from "./ProjectionWorker.js"
import {
  ProjectionWorkerControl,
  type ProjectionWorkerControlShape,
} from "./ProjectionWorkerNatsHost.js"
import {
  ProjectionNotFound,
  ProjectionRegistry,
  type ProjectionRegistryShape,
} from "./ProjectionRegistry.js"
import {
  ProjectionAdmissionController,
  ProjectionWorkLedger,
  makeProjectionWorkItem,
  projectionSchedulingMemoryLayer,
  type ProjectionAdmissionControllerShape,
  type ProjectionSchedulerLookOptions,
  type ProjectionSchedulerLookout,
  type ProjectionSchedulerPressureSnapshot,
  type ProjectionWorkLedgerShape,
} from "./ProjectionScheduling.js"

// ─── Errors ─────────────────────────────────────────────────────────────────

export class ProjectionWorkerAlreadyRunning extends Schema.TaggedErrorClass<ProjectionWorkerAlreadyRunning>()(
  "ProjectionWorkerAlreadyRunning",
  {
    projectionId: Schema.String,
    workerId: Schema.String,
  },
) {}

export class ProjectionWorkerNotFound extends Schema.TaggedErrorClass<ProjectionWorkerNotFound>()(
  "ProjectionWorkerNotFound",
  {
    workerId: Schema.String,
  },
) {}

// ─── Runner port ────────────────────────────────────────────────────────────

export interface ProjectionWorkerRunnerShape {
  readonly runOnce: (
    config: ProjectionWorkerConfig,
  ) => Effect.Effect<ProjectionWorkerRunSummary, unknown, never>
  /** Optional direct long-tail runner hook for future runtimes. Scheduler uses runOnce + Schedule today. */
  readonly tail: (
    config: ProjectionWorkerConfig,
  ) => Effect.Effect<ProjectionWorkerSnapshot, unknown, never>
}

export class ProjectionWorkerRunner extends Context.Service<
  ProjectionWorkerRunner,
  ProjectionWorkerRunnerShape
>()("@tmnl/pct/frames/ProjectionWorkerRunner") {}

export const noopProjectionWorkerRunnerLayer: Layer.Layer<ProjectionWorkerRunner> = Layer.succeed(
  ProjectionWorkerRunner,
  ProjectionWorkerRunner.of({
    runOnce: (config) =>
      Effect.succeed(
        ProjectionWorkerRunSummary.make({
          workerId: config.workerId,
          projectionId: config.spec.id,
          status: "stopped",
          ticks: [],
          processedMessages: 0,
          emittedFrames: 0,
          duplicateParts: 0,
          failedFrames: 0,
          startedAt: Date.now(),
          finishedAt: Date.now(),
        }),
      ),
    tail: (config) =>
      Effect.succeed(
        ProjectionWorkerSnapshot.make({
          workerId: config.workerId,
          projectionId: config.spec.id,
          status: "running",
          mode: "tail",
          startedAt: Date.now(),
          stoppedAt: null,
          lastTickAt: null,
          processedMessages: 0,
          emittedFrames: 0,
          duplicateParts: 0,
          failedFrames: 0,
          lastError: null,
        }),
      ),
  }),
)

// ─── Scheduler service ──────────────────────────────────────────────────────

export interface ProjectionWorkerSchedulerShape extends ProjectionWorkerControlShape {
  readonly snapshot: Effect.Effect<ReadonlyArray<ProjectionWorkerSnapshot>>
  readonly pressure: Effect.Effect<ProjectionSchedulerPressureSnapshot>
  readonly look: (options?: ProjectionSchedulerLookOptions) => Effect.Effect<ProjectionSchedulerLookout>
}

export class ProjectionWorkerScheduler extends Context.Service<
  ProjectionWorkerScheduler,
  ProjectionWorkerSchedulerShape
>()("@tmnl/pct/frames/ProjectionWorkerScheduler") {}

interface WorkerRecord {
  readonly snapshot: ProjectionWorkerSnapshotType
  readonly fiber?: Fiber.Fiber<void, never>
}

const defaultWorkerId = (projectionId: string): string =>
  `${projectionId.replace(/[^a-zA-Z0-9_-]/g, "_")}:default`

const now = (): number => Date.now()

const causeMessage = (cause: unknown): string => {
  if (typeof cause === "object" && cause !== null && "message" in cause) {
    return String((cause as { readonly message?: unknown }).message ?? cause)
  }
  return String(cause)
}

const makeSnapshot = (
  workerId: string,
  projectionId: string,
  mode: ProjectionRunMode,
  status: ProjectionWorkerSnapshotType["status"],
  at: number,
): ProjectionWorkerSnapshotType =>
  ProjectionWorkerSnapshot.make({
    workerId,
    projectionId,
    status,
    mode,
    startedAt: status === "running" || status === "starting" ? at : null,
    stoppedAt: status === "stopped" ? at : null,
    lastTickAt: null,
    processedMessages: 0,
    emittedFrames: 0,
    duplicateParts: 0,
    failedFrames: 0,
    lastError: null,
  })

const matchesSelector = (
  snapshot: ProjectionWorkerSnapshotType,
  selector: { readonly projectionId?: string | undefined; readonly workerId?: string | undefined },
): boolean => {
  if (selector.projectionId !== undefined && snapshot.projectionId !== selector.projectionId) return false
  if (selector.workerId !== undefined && snapshot.workerId !== selector.workerId) return false
  return true
}

const makeConfig = (
  entry: { readonly spec: ProjectionWorkerConfig["spec"]; readonly plan: ProjectionWorkerConfig["plan"] },
  workerId: string,
  mode: ProjectionRunMode,
  maxMessagesPerTick: number | undefined,
  idlePollMs: number | undefined,
): ProjectionWorkerConfig =>
  ProjectionWorkerConfig.make({
    workerId,
    spec: entry.spec,
    plan: entry.plan,
    mode,
    maxMessagesPerTick: maxMessagesPerTick ?? 500,
    idlePollMs: idlePollMs ?? 250,
  })

const aggregateSummary = (
  current: ProjectionWorkerSnapshotType | undefined,
  config: ProjectionWorkerConfig,
  summary: ProjectionWorkerRunSummaryType,
  status: ProjectionWorkerSnapshotType["status"],
): ProjectionWorkerSnapshotType =>
  ProjectionWorkerSnapshot.make({
    workerId: config.workerId,
    projectionId: config.spec.id,
    status,
    mode: config.mode,
    startedAt: current?.startedAt ?? summary.startedAt,
    stoppedAt: status === "stopped" ? summary.finishedAt : null,
    lastTickAt: summary.finishedAt,
    processedMessages: (current?.processedMessages ?? 0) + summary.processedMessages,
    emittedFrames: (current?.emittedFrames ?? 0) + summary.emittedFrames,
    duplicateParts: (current?.duplicateParts ?? 0) + summary.duplicateParts,
    failedFrames: (current?.failedFrames ?? 0) + summary.failedFrames,
    lastError: null,
  })

const failedSnapshot = (
  current: ProjectionWorkerSnapshotType | undefined,
  config: ProjectionWorkerConfig,
  error: string,
): ProjectionWorkerSnapshotType =>
  ProjectionWorkerSnapshot.make({
    workerId: config.workerId,
    projectionId: config.spec.id,
    status: "failed",
    mode: config.mode,
    startedAt: current?.startedAt ?? now(),
    stoppedAt: null,
    lastTickAt: now(),
    processedMessages: current?.processedMessages ?? 0,
    emittedFrames: current?.emittedFrames ?? 0,
    duplicateParts: current?.duplicateParts ?? 0,
    failedFrames: (current?.failedFrames ?? 0) + 1,
    lastError: error,
  })

const makeImpl = (
  registry: ProjectionRegistryShape,
  runner: ProjectionWorkerRunnerShape,
  ledger: ProjectionWorkLedgerShape,
  admission: ProjectionAdmissionControllerShape,
  workersRef: Ref.Ref<ReadonlyMap<string, WorkerRecord>>,
  lifecycle: Semaphore.Semaphore,
  serviceScope: Scope.Scope,
): ProjectionWorkerSchedulerShape => {
  const setSnapshot = (
    workerId: string,
    snapshot: ProjectionWorkerSnapshotType,
  ): Effect.Effect<void> =>
    Ref.update(workersRef, (state) => {
      const current = state.get(workerId)
      return new Map(state).set(workerId, { ...current, snapshot })
    })

  const configForWork = (
    config: ProjectionWorkerConfig,
    work: ReturnType<typeof makeProjectionWorkItem>,
  ): ProjectionWorkerConfig =>
    ProjectionWorkerConfig.make({
      ...config,
      workerId: work.workerId,
      mode: work.mode,
      maxMessagesPerTick: work.maxMessagesPerTick,
      idlePollMs: work.idlePollMs,
    })

  const nextWork = (config: ProjectionWorkerConfig): Effect.Effect<ReturnType<typeof makeProjectionWorkItem>> =>
    Effect.gen(function* () {
      const ready = yield* admission.drainReady({ projectionId: config.spec.id, workerId: config.workerId, limit: 1 })
      return ready[0] ?? makeProjectionWorkItem(config)
    })

  const runScheduledOnce = (
    config: ProjectionWorkerConfig,
  ): Effect.Effect<ProjectionWorkerRunSummaryType | undefined, unknown> =>
    Effect.gen(function* () {
      const work = yield* nextWork(config)
      const effectiveConfig = configForWork(config, work)
      yield* ledger.recordEnqueued(work)
      const outcome = yield* admission.runAdmitted(work, runner.runOnce(effectiveConfig)).pipe(
        Effect.tapCause((cause) => ledger.recordFailed(work, causeMessage(cause))),
      )
      yield* ledger.recordDecision(outcome.decision)
      if (outcome.result === undefined) return undefined
      yield* ledger.recordCompleted(work, outcome.result)
      return outcome.result
    })

  const runTick = (config: ProjectionWorkerConfig): Effect.Effect<void> =>
    Effect.gen(function* () {
      const summary = yield* runScheduledOnce(config)
      if (summary === undefined) return
      yield* Ref.update(workersRef, (state) => {
        const current = state.get(config.workerId)
        const snapshot = aggregateSummary(current?.snapshot, config, summary, "running")
        return new Map(state).set(config.workerId, { ...current, snapshot })
      })
    }).pipe(
      Effect.catchCause((cause) =>
        Ref.update(workersRef, (state) => {
          const current = state.get(config.workerId)
          const snapshot = failedSnapshot(current?.snapshot, config, causeMessage(cause))
          return new Map(state).set(config.workerId, { ...current, snapshot })
        }),
      ),
    )

  const workerProgram = (config: ProjectionWorkerConfig): Effect.Effect<void> => {
    if (config.mode === "run-once") {
      return Effect.gen(function* () {
        const summary = yield* runScheduledOnce(config)
        if (summary === undefined) return
        yield* Ref.update(workersRef, (state) => {
          const current = state.get(config.workerId)
          const snapshot = aggregateSummary(current?.snapshot, config, summary, "stopped")
          return new Map(state).set(config.workerId, { ...current, snapshot })
        })
      }).pipe(
        Effect.catchCause((cause) =>
          Ref.update(workersRef, (state) => {
            const current = state.get(config.workerId)
            const snapshot = failedSnapshot(current?.snapshot, config, causeMessage(cause))
            return new Map(state).set(config.workerId, { ...current, snapshot })
          }),
        ),
      )
    }

    const cadence = Schedule.spaced(Duration.millis(config.idlePollMs))
    return Effect.repeat(runTick(config), cadence).pipe(Effect.asVoid)
  }

  const spawnWorker = (
    config: ProjectionWorkerConfig,
    replaceExisting: boolean,
  ): Effect.Effect<ProjectionWorkerSnapshotType, ProjectionWorkerNotFound> =>
    lifecycle.withPermit(
      Effect.gen(function* () {
        const state = yield* Ref.get(workersRef)
        const existing = state.get(config.workerId)
        if (replaceExisting && existing?.fiber !== undefined) {
          yield* Fiber.interrupt(existing.fiber)
        }

        const initial = makeSnapshot(config.workerId, config.spec.id, config.mode, "running", now())
        yield* Ref.update(workersRef, (current) =>
          new Map(current).set(config.workerId, { snapshot: initial }),
        )

        const fiber = yield* Effect.forkIn(workerProgram(config), serviceScope)
        yield* Ref.update(workersRef, (current) => {
          const latest = current.get(config.workerId)
          return new Map(current).set(config.workerId, {
            snapshot: latest?.snapshot ?? initial,
            fiber,
          })
        })
        return initial
      }),
    )

  return {
    snapshot: Effect.map(Ref.get(workersRef), (state) =>
      Array.from(state.values())
        .map((record) => record.snapshot)
        .sort((a, b) => a.workerId.localeCompare(b.workerId)),
    ),

    pressure: admission.pressure,
    look: admission.look,

    plan: (request) =>
      Effect.gen(function* () {
        const entry = yield* registry.get(request.projectionId)
        return {
          projectionId: entry.projectionId,
          plan: entry.plan,
          generatedAt: now(),
        }
      }),

    start: (request) =>
      Effect.gen(function* () {
        const entry = yield* registry.get(request.projectionId)
        const workerId = request.workerId ?? defaultWorkerId(request.projectionId)
        const state = yield* Ref.get(workersRef)
        const existing = state.get(workerId)
        const startMode = request.startMode ?? "create-if-absent"
        if (existing?.snapshot.status === "running" && startMode === "fail-if-running") {
          return yield* Effect.fail(
            new ProjectionWorkerAlreadyRunning({ projectionId: request.projectionId, workerId }),
          )
        }
        if (existing?.snapshot.status === "running" && startMode === "create-if-absent") {
          return { worker: existing.snapshot, started: false }
        }

        const mode = request.mode ?? "tail"
        const config = makeConfig(entry, workerId, mode, request.maxMessagesPerTick, request.idlePollMs)
        const worker = yield* spawnWorker(config, startMode === "replace-existing")
        return { worker, started: true }
      }),

    stop: (request) =>
      lifecycle.withPermit(
        Effect.gen(function* () {
          const state = yield* Ref.get(workersRef)
          const existing = state.get(request.workerId)
          if (existing === undefined) {
            return yield* Effect.fail(new ProjectionWorkerNotFound({ workerId: request.workerId }))
          }
          if (existing.fiber !== undefined) {
            yield* Fiber.interrupt(existing.fiber)
          }
          const stoppedAt = now()
          const stopped = ProjectionWorkerSnapshot.make({
            ...existing.snapshot,
            status: "stopped",
            stoppedAt,
          })
          yield* Ref.update(workersRef, (current) =>
            new Map(current).set(request.workerId, { snapshot: stopped }),
          )
          return {
            workerId: request.workerId,
            projectionId: stopped.projectionId,
            status: stopped.status,
            stoppedAt,
          }
        }),
      ),

    status: (request) =>
      Effect.map(Ref.get(workersRef), (state) => ({
        workers: Array.from(state.values())
          .map((record) => record.snapshot)
          .filter((worker) => matchesSelector(worker, request))
          .sort((a, b) => a.workerId.localeCompare(b.workerId)),
        reportedAt: now(),
      })),

    runOnce: (request) =>
      Effect.gen(function* () {
        const entry = yield* registry.get(request.projectionId)
        const workerId = request.workerId ?? `${defaultWorkerId(request.projectionId)}:run_once`
        const config = makeConfig(entry, workerId, "run-once", request.maxMessages, undefined)
        const summary = yield* runScheduledOnce(config)
        if (summary === undefined) {
          const at = now()
          const parkedSummary = ProjectionWorkerRunSummary.make({
            workerId,
            projectionId: request.projectionId,
            status: "stopped",
            ticks: [],
            processedMessages: 0,
            emittedFrames: 0,
            duplicateParts: 0,
            failedFrames: 0,
            startedAt: at,
            finishedAt: at,
          })
          const snapshot = aggregateSummary(undefined, config, parkedSummary, parkedSummary.status)
          yield* setSnapshot(workerId, snapshot)
          return { summary: parkedSummary }
        }
        const snapshot = aggregateSummary(undefined, config, summary, summary.status)
        yield* setSnapshot(workerId, snapshot)
        return { summary }
      }),

    tail: (request) =>
      Effect.gen(function* () {
        const entry = yield* registry.get(request.projectionId)
        const workerId = request.workerId ?? defaultWorkerId(request.projectionId)
        const existing = (yield* Ref.get(workersRef)).get(workerId)
        if (existing?.snapshot.status === "running") {
          return { worker: existing.snapshot, status: existing.snapshot.status }
        }
        const config = makeConfig(entry, workerId, "tail", request.maxMessagesPerTick, request.idlePollMs)
        const worker = yield* spawnWorker(config, false)
        return { worker, status: worker.status }
      }),
  }
}

// ─── Layers ────────────────────────────────────────────────────────────────

export const projectionWorkerSchedulerLayerWithPorts: Layer.Layer<
  ProjectionWorkerScheduler | ProjectionWorkerControl,
  never,
  ProjectionRegistry | ProjectionWorkerRunner | ProjectionWorkLedger | ProjectionAdmissionController
> = Layer.unwrap(
  Effect.gen(function* () {
    const registry = yield* ProjectionRegistry
    const runner = yield* ProjectionWorkerRunner
    const ledger = yield* ProjectionWorkLedger
    const admission = yield* ProjectionAdmissionController
    const serviceScope = yield* Scope.Scope
    const workersRef = yield* Ref.make<ReadonlyMap<string, WorkerRecord>>(new Map())
    const lifecycle = yield* Semaphore.make(1)
    const impl = makeImpl(registry, runner, ledger, admission, workersRef, lifecycle, serviceScope)
    return Layer.mergeAll(
      Layer.succeed(ProjectionWorkerScheduler, ProjectionWorkerScheduler.of(impl)),
      Layer.succeed(ProjectionWorkerControl, ProjectionWorkerControl.of(impl)),
    )
  }),
)

export const projectionWorkerSchedulerLayer: Layer.Layer<
  ProjectionWorkerScheduler | ProjectionWorkerControl,
  never,
  ProjectionRegistry | ProjectionWorkerRunner
> = projectionWorkerSchedulerLayerWithPorts.pipe(Layer.provide(projectionSchedulingMemoryLayer))

export type ProjectionWorkerSchedulerError =
  | ProjectionNotFound
  | ProjectionWorkerAlreadyRunning
  | ProjectionWorkerNotFound
  | unknown
