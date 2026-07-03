import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"

import {
  FrameProjectionSpec,
  ProjectionDurableStateStore,
  ProjectionFrameStreamPublisherService,
  ProjectionOutputOutbox,
  ProjectionOutputReceipt,
  ProjectionOutboxPublisher,
  ProjectionWorkerConfig,
  compileTimescaleProjectionUnsafe,
  projectionDurableRuntimeMemoryLayer,
  projectionOutboxPublisherLayer,
  sourceMessageToFramePart,
  type ProjectionOutboxRecordType,
  type ProjectionSourceMessageType,
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
    streamId: "frames.vitals.snapshot",
    mode: "hybrid-wide",
    columns: [
      { column: "patient_id", sqlType: "text", path: ["patientId"], role: "key", nullable: false },
    ],
  },
})

const plan = compileTimescaleProjectionUnsafe(vitalsSpec)

const config = ProjectionWorkerConfig.make({
  workerId: "worker-a",
  spec: vitalsSpec,
  plan,
  mode: "run-once",
  maxMessagesPerTick: 1,
  idlePollMs: 250,
})

const message = (offset: string): ProjectionSourceMessageType => ({
  projectionId: vitalsSpec.id,
  bindingAs: "heartRate",
  streamId: "vitals.heart_rate",
  offset,
  schemaId: "vitals.heart_rate@1.0.0",
  partKey: "heartRate",
  observedAt: "2026-05-18T12:00:01.000Z",
  entityKey: { patientId: "patient-1" },
  payload: {
    patientId: "patient-1",
    observedAt: "2026-05-18T12:00:01.000Z",
    bpm: 72,
  },
  receivedAt: 100,
})

const seedCompletedOutbox = (offset: string) =>
  Effect.gen(function* () {
    const state = yield* ProjectionDurableStateStore
    const part = yield* sourceMessageToFramePart(vitalsSpec, message(offset))
    const source = message(offset)
    const result = yield* state.ingestPart({ config, message: source, part, fenceToken: "fence-a", now: 100 })
    expect(result.outboxRecords.length).toBe(1)
    return result.outboxRecords[0]!
  })

describe("Projection outbox publisher lane", () => {
  it("publishes pending frame records and marks them published", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const publishedRef = yield* Ref.make<ReadonlyArray<string>>([])
        const publisherLayer = Layer.succeed(
          ProjectionFrameStreamPublisherService,
          ProjectionFrameStreamPublisherService.of({
            publish: (record: ProjectionOutboxRecordType) =>
              Effect.gen(function* () {
                yield* Ref.update(publishedRef, (ids) => [...ids, record.outboxId])
                return ProjectionOutputReceipt.make({
                  kind: record.kind,
                  projectionId: record.projectionId,
                  frameId: record.frameId,
                  target: record.target,
                  idempotencyKey: record.idempotencyKey,
                  writtenAt: 200,
                })
              }),
          }),
        )

        return yield* Effect.gen(function* () {
          const outbox = yield* ProjectionOutputOutbox
          const record = yield* seedCompletedOutbox("off-1")
          const lane = yield* ProjectionOutboxPublisher
          const summary = yield* lane.drain({ projectionId: vitalsSpec.id, limit: 10, now: 200 })
          const pending = yield* outbox.pending({ projectionId: vitalsSpec.id, limit: 10, now: 200 })
          const published = yield* Ref.get(publishedRef)
          return { record, summary, pending, published }
        }).pipe(
          Effect.provide(projectionOutboxPublisherLayer),
          Effect.provide(publisherLayer),
          Effect.provide(projectionDurableRuntimeMemoryLayer),
        )
      }),
    )

    expect(result.summary.attempted).toBe(1)
    expect(result.summary.published).toBe(1)
    expect(result.summary.failed).toBe(0)
    expect(result.published).toEqual([result.record.outboxId])
    expect(result.pending).toEqual([])
  })

  it("marks publish failures retryable without dropping the outbox record", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const publisherLayer = Layer.succeed(
          ProjectionFrameStreamPublisherService,
          ProjectionFrameStreamPublisherService.of({
            publish: () => Effect.fail(new Error("lnk unavailable")),
          }),
        )

        return yield* Effect.gen(function* () {
          const outbox = yield* ProjectionOutputOutbox
          const record = yield* seedCompletedOutbox("off-2")
          const lane = yield* ProjectionOutboxPublisher
          const summary = yield* lane.drain({ projectionId: vitalsSpec.id, limit: 10, now: 200, retryDelayMs: 50 })
          const hidden = yield* outbox.pending({ projectionId: vitalsSpec.id, limit: 10, now: 225 })
          const retryable = yield* outbox.pending({ projectionId: vitalsSpec.id, limit: 10, now: 250 })
          return { record, summary, hidden, retryable }
        }).pipe(
          Effect.provide(projectionOutboxPublisherLayer),
          Effect.provide(publisherLayer),
          Effect.provide(projectionDurableRuntimeMemoryLayer),
        )
      }),
    )

    expect(result.summary.attempted).toBe(1)
    expect(result.summary.published).toBe(0)
    expect(result.summary.failed).toBe(1)
    expect(result.summary.attempts[0]?.error).toContain("lnk unavailable")
    expect(result.hidden).toEqual([])
    expect(result.retryable.map((record) => record.outboxId)).toEqual([result.record.outboxId])
    expect(result.retryable[0]?.attempt).toBe(1)
  })
})
