import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"

import {
  FrameProjectionSpec,
  FrameStreamWriter,
  ProjectionWorkerConfig,
  ProjectionWorkerRunner,
  compileTimescaleProjectionUnsafe,
  frameStreamWriterLayerMemory,
  noopFrameStreamWriterLayer,
  projectionRuntimeRunnerLayer,
  projectionSourceReaderLayerMemory,
  timescaleFrameWriterLayerMemory,
  type MaterializedFrameType,
  type ProjectionSourceMessageType,
} from "../src/frames/index.js"

const makeSpec = (streamId?: string) => FrameProjectionSpec.make({
  id: "vitals.snapshot@1.0.0",
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
    allowedLatenessMs: 86_400_000,
    onTimeout: "emit-partial",
  },
  output: {
    table: "vitals_snapshot_frames",
    schemaId: "frames.vitals.snapshot@1.0.0",
    streamId,
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

// Anchored to "now" (bucket-aligned) rather than a hardcoded historical
// timestamp: the runtime's timeout sweep compares frame deadlines against
// the real `Date.now()`, so a fixed past date eventually falls outside
// `allowedLatenessMs` (24h) as real time marches on, tripping an
// unintended early partial-emission in the idempotency test below.
const BUCKET_MS = 5_000
const BUCKET_START_MS = Math.floor((Date.now() - 60_000) / BUCKET_MS) * BUCKET_MS
const OBSERVED_AT = new Date(BUCKET_START_MS + 4_250).toISOString()
const RECEIVED_AT_MS = BUCKET_START_MS + 4_300
const EXPECTED_FRAME_TIME = new Date(BUCKET_START_MS).toISOString()

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
  observedAt: OBSERVED_AT,
  entityKey: { patientId: "patient-7" },
  payload: { value: partKey },
  receivedAt: RECEIVED_AT_MS,
})

const makeConfig = (spec: ReturnType<typeof makeSpec>, maxMessagesPerTick = 10) => ProjectionWorkerConfig.make({
  workerId: "worker-a",
  spec,
  plan: compileTimescaleProjectionUnsafe(spec),
  mode: "run-once",
  maxMessagesPerTick,
  idlePollMs: 10,
})

describe("Projection runtime vertical slice", () => {
  it("runs one worker tick over test LNK source messages and writes a golden Timescale frame", async () => {
    const spec = makeSpec()
    const frames = await Effect.runPromise(
      Effect.gen(function* () {
        const timescaleFramesRef = yield* Ref.make<ReadonlyArray<MaterializedFrameType>>([])
        const runnerLayer = projectionRuntimeRunnerLayer.pipe(
          Layer.provide(projectionSourceReaderLayerMemory([
            message(spec, "heartRate", "1"),
            message(spec, "spo2", "2"),
            message(spec, "temperature", "3"),
          ])),
          Layer.provide(timescaleFrameWriterLayerMemory(timescaleFramesRef)),
          Layer.provide(noopFrameStreamWriterLayer),
        )

        return yield* Effect.gen(function* () {
          const runner = yield* ProjectionWorkerRunner
          const summary = yield* runner.runOnce(makeConfig(spec))
          const written = yield* Ref.get(timescaleFramesRef)
          return { summary, written }
        }).pipe(Effect.provide(runnerLayer))
      }),
    )

    expect(frames.summary.processedMessages).toBe(3)
    expect(frames.summary.emittedFrames).toBe(1)
    expect(frames.summary.duplicateParts).toBe(0)
    expect(frames.summary.ticks[0]?.completedFrames).toHaveLength(1)
    expect(frames.summary.ticks[0]?.outputReceipts).toHaveLength(1)
    expect(frames.written).toHaveLength(1)
    expect(frames.written[0]).toMatchObject({
      projectionId: spec.id,
      outputSchemaId: "frames.vitals.snapshot@1.0.0",
      frameTime: EXPECTED_FRAME_TIME,
      complete: true,
      missingParts: [],
    })
    expect(frames.written[0]?.payload).toEqual({
      heartRate: { value: "heartRate" },
      spo2: { value: "spo2" },
      temperature: { value: "temperature" },
    })
  })

  it("keeps source-offset idempotency across ticks", async () => {
    const spec = makeSpec()
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const timescaleFramesRef = yield* Ref.make<ReadonlyArray<MaterializedFrameType>>([])
        const runnerLayer = projectionRuntimeRunnerLayer.pipe(
          Layer.provide(projectionSourceReaderLayerMemory([
            message(spec, "heartRate", "1"),
            message(spec, "spo2", "2"),
            message(spec, "heartRate", "1"),
            message(spec, "temperature", "3"),
          ])),
          Layer.provide(timescaleFrameWriterLayerMemory(timescaleFramesRef)),
          Layer.provide(noopFrameStreamWriterLayer),
        )

        return yield* Effect.gen(function* () {
          const runner = yield* ProjectionWorkerRunner
          const first = yield* runner.runOnce(makeConfig(spec, 2))
          const second = yield* runner.runOnce(makeConfig(spec, 10))
          const written = yield* Ref.get(timescaleFramesRef)
          return { first, second, written }
        }).pipe(Effect.provide(runnerLayer))
      }),
    )

    expect(result.first.processedMessages).toBe(2)
    expect(result.first.duplicateParts).toBe(0)
    expect(result.second.processedMessages).toBe(2)
    expect(result.second.duplicateParts).toBe(1)
    expect(result.second.emittedFrames).toBe(1)
    expect(result.written).toHaveLength(1)
  })

  it("optionally writes completed frames to an LNK frame stream", async () => {
    const spec = makeSpec("frames.vitals.snapshot")
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const timescaleFramesRef = yield* Ref.make<ReadonlyArray<MaterializedFrameType>>([])
        const frameStreamRef = yield* Ref.make<ReadonlyArray<MaterializedFrameType>>([])
        const runnerLayer = projectionRuntimeRunnerLayer.pipe(
          Layer.provide(projectionSourceReaderLayerMemory([
            message(spec, "heartRate", "1"),
            message(spec, "spo2", "2"),
            message(spec, "temperature", "3"),
          ])),
          Layer.provide(timescaleFrameWriterLayerMemory(timescaleFramesRef)),
          Layer.provide(frameStreamWriterLayerMemory(frameStreamRef)),
        )

        return yield* Effect.gen(function* () {
          const runner = yield* ProjectionWorkerRunner
          const summary = yield* runner.runOnce(makeConfig(spec))
          const timescaleFrames = yield* Ref.get(timescaleFramesRef)
          const streamFrames = yield* Ref.get(frameStreamRef)
          return { summary, timescaleFrames, streamFrames }
        }).pipe(Effect.provide(runnerLayer))
      }),
    )

    expect(result.timescaleFrames).toHaveLength(1)
    expect(result.streamFrames).toHaveLength(1)
    expect(result.summary.ticks[0]?.outputReceipts.map((receipt) => receipt.kind)).toEqual([
      "timescale-frame-row",
      "lnk-frame-stream",
    ])
    expect(result.summary.ticks[0]?.outputReceipts[1]?.target).toBe("frames.vitals.snapshot")
  })
})
