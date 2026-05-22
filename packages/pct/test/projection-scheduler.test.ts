import { describe, expect, it } from "vitest"
import * as Duration from "effect-v4/Duration"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Ref from "effect-v4/Ref"

import {
  FrameProjectionSpec,
  ProjectionAdmissionController,
  ProjectionRegistry,
  ProjectionWorkerAlreadyRunning,
  ProjectionWorkerConfig,
  ProjectionWorkerRunner,
  ProjectionWorkerRunSummary,
  ProjectionWorkerScheduler,
  ProjectionWorkerSnapshot,
  compileTimescaleProjectionUnsafe,
  makeProjectionWorkItem,
  projectionAdmissionControllerLayerMemory,
  projectionRegistryLayerMemory,
  projectionSchedulerTuningLayer,
  projectionWorkerSchedulerLayer,
} from "../src/frames/index.js"

const vitalsSpec = FrameProjectionSpec.make({
  id: "vitals.snapshot@1.0.0",
  sources: [
    {
      streamId: "vitals.heart_rate",
      schemaId: "vitals.heart_rate@1.0.0",
      as: "heartRate",
      timeField: ["observedAt"],
      keyFields: [["patientId"]],
    },
  ],
  frame: {
    timeBucket: "5 seconds",
    required: ["heartRate"],
    allowedLatenessMs: 1_000,
    onTimeout: "emit-partial",
  },
  output: {
    table: "vitals_snapshot_frames",
    schemaId: "frames.vitals.snapshot@1.0.0",
    mode: "hybrid-wide",
    columns: [
      {
        column: "patient_id",
        sqlType: "text",
        path: ["patientId"],
        role: "key",
        nullable: false,
      },
    ],
  },
})

describe("ProjectionWorkerScheduler", () => {
  it("forks a scoped tail worker fiber and drives ticks with Schedule + Duration", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const ticksRef = yield* Ref.make(0)
        const runnerLayer = Layer.succeed(
          ProjectionWorkerRunner,
          ProjectionWorkerRunner.of({
            runOnce: (config) =>
              Effect.gen(function* () {
                const tick = yield* Ref.updateAndGet(ticksRef, (n) => n + 1)
                const at = Date.now()
                return ProjectionWorkerRunSummary.make({
                  workerId: config.workerId,
                  projectionId: config.spec.id,
                  status: "running",
                  ticks: [],
                  processedMessages: 1,
                  emittedFrames: tick % 2,
                  duplicateParts: 0,
                  failedFrames: 0,
                  startedAt: at,
                  finishedAt: at,
                })
              }),
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

        return yield* Effect.gen(function* () {
          const registry = yield* ProjectionRegistry
          yield* registry.register(vitalsSpec, { status: "active", now: 100 })
          const scheduler = yield* ProjectionWorkerScheduler
          const start = yield* scheduler.tail({
            projectionId: vitalsSpec.id,
            workerId: "worker-a",
            idlePollMs: 5,
            maxMessagesPerTick: 1,
          })
          yield* Effect.sleep(Duration.millis(35))
          const during = yield* scheduler.status({ workerId: "worker-a" })
          const stopped = yield* scheduler.stop({ workerId: "worker-a" })
          const after = yield* scheduler.status({ workerId: "worker-a" })
          const ticks = yield* Ref.get(ticksRef)
          return { start, during, stopped, after, ticks }
        }).pipe(
          Effect.provide(projectionWorkerSchedulerLayer),
          Effect.provide(runnerLayer),
          Effect.provide(projectionRegistryLayerMemory),
        )
      }),
    )

    expect(result.start.status).toBe("running")
    expect(result.ticks).toBeGreaterThan(1)
    expect(result.during.workers[0]?.processedMessages).toBeGreaterThan(1)
    expect(result.stopped.status).toBe("stopped")
    expect(result.after.workers[0]?.status).toBe("stopped")
  })

  it("guards duplicate running workers with fail-if-running", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const runnerLayer = Layer.succeed(
          ProjectionWorkerRunner,
          ProjectionWorkerRunner.of({
            runOnce: (config) =>
              Effect.succeed(
                ProjectionWorkerRunSummary.make({
                  workerId: config.workerId,
                  projectionId: config.spec.id,
                  status: "running",
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

        return yield* Effect.gen(function* () {
          const registry = yield* ProjectionRegistry
          yield* registry.register(vitalsSpec, { status: "active", now: 100 })
          const scheduler = yield* ProjectionWorkerScheduler
          yield* scheduler.start({
            projectionId: vitalsSpec.id,
            workerId: "worker-a",
            mode: "tail",
            idlePollMs: 100,
          })
          return yield* scheduler.start({
            projectionId: vitalsSpec.id,
            workerId: "worker-a",
            mode: "tail",
            startMode: "fail-if-running",
          }).pipe(Effect.result)
        }).pipe(
          Effect.provide(projectionWorkerSchedulerLayer),
          Effect.provide(runnerLayer),
          Effect.provide(projectionRegistryLayerMemory),
        )
      }),
    )

    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") {
      expect(result.failure).toBeInstanceOf(ProjectionWorkerAlreadyRunning)
      expect(result.failure.workerId).toBe("worker-a")
    }
  })

  it("exposes duplicate in-flight admission pressure for overlapping projection workers", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const runnerLayer = Layer.succeed(
          ProjectionWorkerRunner,
          ProjectionWorkerRunner.of({
            runOnce: (config) =>
              Effect.gen(function* () {
                yield* Effect.sleep(Duration.millis(50))
                const at = Date.now()
                return ProjectionWorkerRunSummary.make({
                  workerId: config.workerId,
                  projectionId: config.spec.id,
                  status: "running",
                  ticks: [],
                  processedMessages: 1,
                  emittedFrames: 0,
                  duplicateParts: 0,
                  failedFrames: 0,
                  startedAt: at,
                  finishedAt: at,
                })
              }),
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

        return yield* Effect.gen(function* () {
          const registry = yield* ProjectionRegistry
          yield* registry.register(vitalsSpec, { status: "active", now: 100 })
          const scheduler = yield* ProjectionWorkerScheduler
          yield* scheduler.tail({ projectionId: vitalsSpec.id, workerId: "worker-a", idlePollMs: 25 })
          yield* scheduler.tail({ projectionId: vitalsSpec.id, workerId: "worker-b", idlePollMs: 25 })
          yield* Effect.sleep(Duration.millis(15))
          const pressure = yield* scheduler.pressure
          yield* scheduler.stop({ workerId: "worker-a" })
          yield* scheduler.stop({ workerId: "worker-b" })
          return pressure
        }).pipe(
          Effect.provide(projectionWorkerSchedulerLayer),
          Effect.provide(runnerLayer),
          Effect.provide(projectionRegistryLayerMemory),
        )
      }),
    )

    expect(result.duplicateInFlight).toBeGreaterThan(0)
    expect(result.inFlight).toBeGreaterThan(0)
  })

  it("parks distinct work when the target key gate is saturated", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const admission = yield* ProjectionAdmissionController
        const plan = compileTimescaleProjectionUnsafe(vitalsSpec)
        const baseConfig = ProjectionWorkerConfig.make({
          workerId: "worker-a",
          spec: vitalsSpec,
          plan,
          mode: "tail",
          maxMessagesPerTick: 1,
          idlePollMs: 10,
        })
        const workA = makeProjectionWorkItem(baseConfig, {
          duplicateKey: "distinct-a",
          targetKey: "shared-frame-target",
          now: 1,
        })
        const workB = makeProjectionWorkItem({ ...baseConfig, workerId: "worker-b" }, {
          duplicateKey: "distinct-b",
          targetKey: "shared-frame-target",
          now: 2,
        })

        const [firstResult, second] = yield* Effect.all(
          [
            admission.runAdmitted(workA, Effect.sleep(Duration.millis(40)).pipe(Effect.as("a"))),
            Effect.gen(function* () {
              yield* Effect.sleep(Duration.millis(5))
              return yield* admission.runAdmitted(workB, Effect.succeed("b"))
            }),
          ],
          { concurrency: "unbounded" },
        )
        const pressure = yield* admission.pressure
        return { firstResult, second, pressure }
      }).pipe(
        Effect.provide(
          projectionAdmissionControllerLayerMemory.pipe(
            Layer.provide(projectionSchedulerTuningLayer({ maxConcurrentTicks: 2, maxInFlightPerTarget: 1 })),
          ),
        ),
      ),
    )

    expect(result.firstResult.decision.status).toBe("admitted")
    expect(result.firstResult.result).toBe("a")
    expect(result.second.decision.status).toBe("parked")
    expect(result.second.decision.reason).toBe("hot-key-busy")
    expect(result.pressure.parked).toBeGreaterThan(0)
  })

  it("parks admitted-looking work when the global execution budget is exhausted", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const admission = yield* ProjectionAdmissionController
        const plan = compileTimescaleProjectionUnsafe(vitalsSpec)
        const baseConfig = ProjectionWorkerConfig.make({
          workerId: "worker-a",
          spec: vitalsSpec,
          plan,
          mode: "tail",
          maxMessagesPerTick: 1,
          idlePollMs: 10,
        })
        const workA = makeProjectionWorkItem(baseConfig, {
          duplicateKey: "budget-a",
          targetKey: "target-a",
          now: 1,
        })
        const workB = makeProjectionWorkItem({ ...baseConfig, workerId: "worker-b" }, {
          duplicateKey: "budget-b",
          targetKey: "target-b",
          now: 2,
        })

        const [firstResult, second] = yield* Effect.all(
          [
            admission.runAdmitted(workA, Effect.sleep(Duration.millis(40)).pipe(Effect.as("a"))),
            Effect.gen(function* () {
              yield* Effect.sleep(Duration.millis(5))
              return yield* admission.runAdmitted(workB, Effect.succeed("b"))
            }),
          ],
          { concurrency: "unbounded" },
        )
        const pressure = yield* admission.pressure
        return { firstResult, second, pressure }
      }).pipe(
        Effect.provide(
          projectionAdmissionControllerLayerMemory.pipe(
            Layer.provide(projectionSchedulerTuningLayer({ maxConcurrentTicks: 1, maxInFlightPerTarget: 2 })),
          ),
        ),
      ),
    )

    expect(result.firstResult.decision.status).toBe("admitted")
    expect(result.second.decision.status).toBe("parked")
    expect(result.second.decision.reason).toBe("global-budget-exhausted")
    expect(result.pressure.completed).toBe(1)
    expect(result.pressure.parked).toBeGreaterThan(0)
  })

  it("drains parked replay/backfill work by lane priority", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const admission = yield* ProjectionAdmissionController
        const plan = compileTimescaleProjectionUnsafe(vitalsSpec)
        const baseConfig = ProjectionWorkerConfig.make({
          workerId: "worker-a",
          spec: vitalsSpec,
          plan,
          mode: "tail",
          maxMessagesPerTick: 1,
          idlePollMs: 10,
        })
        const holder = makeProjectionWorkItem(baseConfig, {
          duplicateKey: "priority-holder",
          targetKey: "priority-holder-target",
          lane: "hot",
          now: 1,
        })
        const hot = makeProjectionWorkItem(baseConfig, {
          duplicateKey: "priority-hot",
          targetKey: "priority-hot-target",
          lane: "hot",
          now: 2,
        })
        const replay = makeProjectionWorkItem(baseConfig, {
          duplicateKey: "priority-replay",
          targetKey: "priority-replay-target",
          lane: "replay",
          now: 3,
        })
        const backfill = makeProjectionWorkItem(baseConfig, {
          duplicateKey: "priority-backfill",
          targetKey: "priority-backfill-target",
          lane: "backfill",
          now: 4,
        })

        const [, parked] = yield* Effect.all(
          [
            admission.runAdmitted(holder, Effect.sleep(Duration.millis(40)).pipe(Effect.as("holder"))),
            Effect.gen(function* () {
              yield* Effect.sleep(Duration.millis(5))
              const parkedHot = yield* admission.runAdmitted(hot, Effect.succeed("hot"))
              const parkedReplay = yield* admission.runAdmitted(replay, Effect.succeed("replay"))
              const parkedBackfill = yield* admission.runAdmitted(backfill, Effect.succeed("backfill"))
              return [parkedHot, parkedReplay, parkedBackfill]
            }),
          ],
          { concurrency: "unbounded" },
        )
        const ready = yield* admission.drainReady({ limit: 3, now: Date.now() + 1_000 })
        return { parked, ready }
      }).pipe(
        Effect.provide(
          projectionAdmissionControllerLayerMemory.pipe(
            Layer.provide(
              projectionSchedulerTuningLayer({
                maxConcurrentTicks: 1,
                maxInFlightPerTarget: 10,
                defaultRetryDelayMs: 0,
              }),
            ),
          ),
        ),
      ),
    )

    expect(result.parked.map((entry) => entry.decision.status)).toEqual(["parked", "parked", "parked"])
    expect(result.ready.map((work) => work.lane)).toEqual(["hot", "replay", "backfill"])
    expect(result.ready.map((work) => work.attempt)).toEqual([1, 1, 1])
  })

  it("rejects parked work when retry budget is exhausted", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const admission = yield* ProjectionAdmissionController
        const plan = compileTimescaleProjectionUnsafe(vitalsSpec)
        const baseConfig = ProjectionWorkerConfig.make({
          workerId: "worker-a",
          spec: vitalsSpec,
          plan,
          mode: "tail",
          maxMessagesPerTick: 1,
          idlePollMs: 10,
        })
        const holder = makeProjectionWorkItem(baseConfig, {
          duplicateKey: "retry-holder",
          targetKey: "retry-target",
          now: 1,
        })
        const retry = makeProjectionWorkItem(baseConfig, {
          duplicateKey: "retry-candidate",
          targetKey: "retry-target",
          attempt: 1,
          now: 2,
        })

        const [, exhausted] = yield* Effect.all(
          [
            admission.runAdmitted(holder, Effect.sleep(Duration.millis(40)).pipe(Effect.as("holder"))),
            Effect.gen(function* () {
              yield* Effect.sleep(Duration.millis(5))
              return yield* admission.runAdmitted(retry, Effect.succeed("retry"))
            }),
          ],
          { concurrency: "unbounded" },
        )
        const pressure = yield* admission.pressure
        return { exhausted, pressure }
      }).pipe(
        Effect.provide(
          projectionAdmissionControllerLayerMemory.pipe(
            Layer.provide(projectionSchedulerTuningLayer({ maxConcurrentTicks: 2, maxInFlightPerTarget: 1, maxRetryAttempts: 1 })),
          ),
        ),
      ),
    )

    expect(result.exhausted.decision.status).toBe("rejected")
    expect(result.exhausted.decision.reason).toBe("hot-key-busy")
    expect(result.exhausted.result).toBeUndefined()
    expect(result.pressure.rejected).toBe(1)
  })
})
