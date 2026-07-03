import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"

import {
  FrameProjectionSpec,
  ProjectionDurableStateError,
  ProjectionDurableStateStore,
  ProjectionOutputOutbox,
  ProjectionWorkerConfig,
  compileTimescaleProjectionUnsafe,
  projectionDurableRuntimeMemoryLayer,
  projectionDurableRuntimeMemoryLayerWithFaults,
  sourceMessageToFramePart,
  type ProjectionDurableStateStoreShape,
  type ProjectionSourceMessageType,
} from "../src/frames/index.js"

const makeSpec = (onTimeout: "emit-partial" | "drop-partial" | "dead-letter" = "emit-partial") =>
  FrameProjectionSpec.make({
    id: `vitals.snapshot.${onTimeout.replace("-", "_")}@1.0.0`,
    sources: [
      {
        streamId: "vitals.heart_rate",
        schemaId: "vitals.heart_rate@1.0.0",
        as: "heartRate",
        timeField: ["observedAt"],
        keyFields: [["patientId"]],
      },
      {
        streamId: "vitals.spo2",
        schemaId: "vitals.spo2@1.0.0",
        as: "spo2",
        timeField: ["observedAt"],
        keyFields: [["patientId"]],
      },
      {
        streamId: "vitals.temperature",
        schemaId: "vitals.temperature@1.0.0",
        as: "temperature",
        timeField: ["observedAt"],
        keyFields: [["patientId"]],
      },
    ],
    frame: {
      timeBucket: "5 seconds",
      required: ["heartRate", "spo2", "temperature"],
      allowedLatenessMs: 0,
      onTimeout,
    },
    output: {
      table: "vitals_snapshot_frames",
      schemaId: "frames.vitals.snapshot@1.0.0",
      streamId: "frames.vitals.snapshot",
      mode: "hybrid-wide",
      columns: [],
    },
  })

const message = (
  spec: ReturnType<typeof makeSpec>,
  partKey: "heartRate" | "spo2" | "temperature",
  offset: string,
): ProjectionSourceMessageType => ({
  projectionId: spec.id,
  streamId: partKey === "heartRate" ? "vitals.heart_rate" : partKey === "spo2" ? "vitals.spo2" : "vitals.temperature",
  offset,
  schemaId: partKey === "heartRate" ? "vitals.heart_rate@1.0.0" : partKey === "spo2" ? "vitals.spo2@1.0.0" : "vitals.temperature@1.0.0",
  partKey,
  observedAt: "2026-05-24T12:00:04.250Z",
  entityKey: { patientId: "patient-7" },
  payload: { value: partKey },
  receivedAt: Date.parse("2026-05-24T12:00:04.300Z"),
})

const config = (spec: ReturnType<typeof makeSpec>) => ProjectionWorkerConfig.make({
  workerId: "worker-a",
  spec,
  plan: compileTimescaleProjectionUnsafe(spec),
  mode: "run-once",
  maxMessagesPerTick: 10,
  idlePollMs: 10,
})

const ingest = (
  store: ProjectionDurableStateStoreShape,
  spec: ReturnType<typeof makeSpec>,
  partKey: "heartRate" | "spo2" | "temperature",
  offset: string,
  now: number,
) =>
  Effect.gen(function* () {
    const source = message(spec, partKey, offset)
    const part = yield* sourceMessageToFramePart(spec, source)
    return yield* store.ingestPart({
      config: config(spec),
      message: source,
      part,
      fenceToken: "worker-a:100:fence",
      now,
    })
  })

describe("Projection durable runtime memory semantics", () => {
  it("rolls back injected ingest failures before ledger/state commit", async () => {
    const spec = makeSpec()
    let shouldFail = true
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ProjectionDurableStateStore
        const outbox = yield* ProjectionOutputOutbox
        const failed = yield* Effect.flip(ingest(store, spec, "heartRate", "1", 100))
        const retry = yield* ingest(store, spec, "heartRate", "1", 101)
        const duplicateAfterCommit = yield* ingest(store, spec, "heartRate", "1", 102)
        const pending = yield* outbox.pending({ projectionId: spec.id, limit: 10, now: 103 })
        return { failed, retry, duplicateAfterCommit, pending }
      }).pipe(Effect.provide(projectionDurableRuntimeMemoryLayerWithFaults({
        failIngestBeforeCommit: () => {
          if (!shouldFail) return false
          shouldFail = false
          return true
        },
      }))),
    )

    expect(result.failed).toBeInstanceOf(ProjectionDurableStateError)
    expect(result.retry.outcome).toBe("accepted-part")
    expect(result.retry.duplicate).toBe(false)
    expect(result.duplicateAfterCommit.outcome).toBe("duplicate-source-offset")
    expect(result.pending).toHaveLength(0)
  })

  it("uses explicit revision policy for partial timeout then late completion", async () => {
    const spec = makeSpec("emit-partial")
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ProjectionDurableStateStore
        const outbox = yield* ProjectionOutputOutbox
        yield* ingest(store, spec, "heartRate", "1", 100)
        yield* ingest(store, spec, "spo2", "2", 101)
        const afterDeadline = Date.parse("2026-05-24T12:00:06.000Z")
        const firstSweep = yield* store.sweepExpired({
          config: config(spec),
          limit: 10,
          fenceToken: "worker-a:100:fence",
          now: afterDeadline,
        })
        const secondSweep = yield* store.sweepExpired({
          config: config(spec),
          limit: 10,
          fenceToken: "worker-a:100:fence",
          now: afterDeadline + 1_000,
        })
        const lateComplete = yield* ingest(store, spec, "temperature", "3", afterDeadline + 2_000)
        const pending = yield* outbox.pending({ projectionId: spec.id, limit: 10, now: afterDeadline + 3_000 })
        return { firstSweep, secondSweep, lateComplete, pending }
      }).pipe(Effect.provide(projectionDurableRuntimeMemoryLayer)),
    )

    expect(result.firstSweep).toHaveLength(1)
    expect(result.firstSweep[0]?.outcome).toBe("emitted-partial")
    expect(result.firstSweep[0]?.materializedFrame?.complete).toBe(false)
    expect(result.firstSweep[0]?.materializedFrame?.frameRevision).toBe(1)
    expect(result.secondSweep).toHaveLength(0)
    expect(result.lateComplete.outcome).toBe("completed-frame")
    expect(result.lateComplete.materializedFrame?.complete).toBe(true)
    expect(result.lateComplete.materializedFrame?.frameRevision).toBe(2)
    expect(result.pending.map((record) => record.frameRevision)).toEqual([1, 2])
  })

  it("does not create new output for duplicate source-offset replay after completion", async () => {
    const spec = makeSpec()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ProjectionDurableStateStore
        const outbox = yield* ProjectionOutputOutbox
        yield* ingest(store, spec, "heartRate", "1", 100)
        yield* ingest(store, spec, "spo2", "2", 101)
        const completed = yield* ingest(store, spec, "temperature", "3", 102)
        const replay = yield* ingest(store, spec, "temperature", "3", 103)
        const pending = yield* outbox.pending({ projectionId: spec.id, limit: 10, now: 104 })
        return { completed, replay, pending }
      }).pipe(Effect.provide(projectionDurableRuntimeMemoryLayer)),
    )

    expect(result.completed.materializedFrame?.frameRevision).toBe(1)
    expect(result.replay.outcome).toBe("duplicate-source-offset")
    expect(result.replay.outboxRecords).toHaveLength(0)
    expect(result.pending).toHaveLength(1)
  })

  it("sweeps quiet incomplete frames according to timeout policy", async () => {
    const droppedSpec = makeSpec("drop-partial")
    const deadLetterSpec = makeSpec("dead-letter")
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ProjectionDurableStateStore
        yield* ingest(store, droppedSpec, "heartRate", "1", 100)
        yield* ingest(store, deadLetterSpec, "heartRate", "1", 100)
        const dropped = yield* store.sweepExpired({
          config: config(droppedSpec),
          limit: 10,
          fenceToken: "worker-a:100:fence",
          now: Date.parse("2026-05-24T12:00:06.000Z"),
        })
        const deadLettered = yield* store.sweepExpired({
          config: config(deadLetterSpec),
          limit: 10,
          fenceToken: "worker-a:100:fence",
          now: Date.parse("2026-05-24T12:00:06.000Z"),
        })
        return { dropped, deadLettered }
      }).pipe(Effect.provide(projectionDurableRuntimeMemoryLayer)),
    )

    expect(result.dropped[0]?.outcome).toBe("dropped-partial")
    expect(result.dropped[0]?.materializedFrame).toBeNull()
    expect(result.deadLettered[0]?.outcome).toBe("dead-lettered")
    expect(result.deadLettered[0]?.materializedFrame).toBeNull()
  })
})
