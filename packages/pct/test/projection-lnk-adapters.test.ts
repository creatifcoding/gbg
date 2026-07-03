import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Stream from "effect/Stream"

import { ContentType, StreamId } from "@tmnl/lnk/contracts"
import { Wire } from "@tmnl/lnk/services/wire"
import { InMemoryWire } from "@tmnl/lnk/services/wire/in-memory"

import {
  FrameProjectionSpec,
  ProjectionDurableStateStore,
  ProjectionFrameStreamPublisherService,
  ProjectionOutputOutbox,
  ProjectionSourceReader,
  ProjectionWorkerConfig,
  compileTimescaleProjectionUnsafe,
  projectionDurableRuntimeMemoryLayer,
  projectionFrameStreamPublisherLayerLnkWire,
  projectionSourceReaderLayerLnkWire,
  sourceMessageToFramePart,
  type ProjectionSourceMessageType,
} from "../src/frames/index.js"

const jsonContentType = ContentType.trust("application/json")
const enc = new TextEncoder()
const dec = new TextDecoder()

const spec = FrameProjectionSpec.make({
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
    allowedLatenessMs: 60_000,
    onTimeout: "emit-partial",
  },
  output: {
    table: "vitals_snapshot_frames",
    schemaId: "frames.vitals.snapshot@1.0.0",
    streamId: "frames.vitals.snapshot",
    mode: "hybrid-wide",
    columns: [],
  },
})

const config = ProjectionWorkerConfig.make({
  workerId: "worker-a",
  spec,
  plan: compileTimescaleProjectionUnsafe(spec),
  mode: "run-once",
  maxMessagesPerTick: 10,
  idlePollMs: 10,
})

const sourcePayload = (partKey: "heartRate" | "spo2" | "temperature") => ({
  patientId: "patient-7",
  observedAt: "2026-05-24T12:00:04.250Z",
  value: partKey,
})

const seedSourceStreams = Effect.gen(function* () {
  const wire = yield* Wire
  for (const source of spec.sources) {
    yield* wire.put({
      streamId: StreamId.trust(source.streamId),
      contentType: jsonContentType,
      schemaId: source.schemaId,
    })
    yield* wire.post({
      streamId: StreamId.trust(source.streamId),
      contentType: jsonContentType,
      body: enc.encode(JSON.stringify(sourcePayload(source.as as "heartRate" | "spo2" | "temperature"))),
    })
  }
})

const collectJsonBody = (body: Stream.Stream<Uint8Array, unknown, never>) =>
  Stream.runCollect(body).pipe(
    Effect.map((chunks) => {
      const bytes = Array.from(chunks)
      const total = bytes.reduce((sum, chunk) => sum + chunk.length, 0)
      const combined = new Uint8Array(total)
      let offset = 0
      for (const chunk of bytes) {
        combined.set(chunk, offset)
        offset += chunk.length
      }
      return total === 0 ? [] : JSON.parse(dec.decode(combined))
    }),
  )

describe("Projection LNK adapters", () => {
  it("reads LNK source streams through limit=1 messages with durable offsets", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        yield* seedSourceStreams
        const reader = yield* ProjectionSourceReader
        return yield* reader.read(config)
      }).pipe(
        Effect.provide(projectionSourceReaderLayerLnkWire({ now: () => 123 })),
        Effect.provide(InMemoryWire.layer),
      ),
    )

    expect(result).toHaveLength(3)
    expect(result.map((message) => message.partKey).sort()).toEqual(["heartRate", "spo2", "temperature"])
    expect(result.every((message) => message.offset.length > 0)).toBe(true)
    expect(result[0]?.receivedAt).toBe(123)
    expect(result[0]?.entityKey).toEqual({ patientId: "patient-7" })
  })

  it("publishes frame outbox records to LNK with producer idempotency", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ProjectionDurableStateStore
        const outbox = yield* ProjectionOutputOutbox
        for (const message of [
          { partKey: "heartRate", offset: "1" },
          { partKey: "spo2", offset: "2" },
          { partKey: "temperature", offset: "3" },
        ] as const) {
          const source: ProjectionSourceMessageType = {
            projectionId: spec.id,
            streamId: message.partKey === "heartRate" ? "vitals.heart_rate" : message.partKey === "spo2" ? "vitals.spo2" : "vitals.temperature",
            offset: message.offset,
            schemaId: `vitals.${message.partKey}@1.0.0`,
            partKey: message.partKey,
            observedAt: "2026-05-24T12:00:04.250Z",
            entityKey: { patientId: "patient-7" },
            payload: sourcePayload(message.partKey),
            receivedAt: 100,
          }
          const part = yield* sourceMessageToFramePart(spec, source)
          yield* store.ingestPart({ config, message: source, part, fenceToken: "worker-a:100:fence", now: 100 })
        }
        const pending = yield* outbox.pending({ projectionId: spec.id, limit: 10, now: 101 })
        const publisher = yield* ProjectionFrameStreamPublisherService
        const first = yield* publisher.publish(pending[0]!)
        const duplicate = yield* publisher.publish(pending[0]!)
        const wire = yield* Wire
        const read = yield* Effect.scoped(wire.get({
          streamId: StreamId.trust("frames.vitals.snapshot"),
          position: "-1",
          limit: 10,
        }))
        const body = yield* collectJsonBody(read.body)
        return { first, duplicate, body }
      }).pipe(
        Effect.provide(Layer.mergeAll(
          projectionDurableRuntimeMemoryLayer,
          projectionFrameStreamPublisherLayerLnkWire,
        )),
        Effect.provide(InMemoryWire.layer),
      ),
    )

    expect(result.first.kind).toBe("lnk-frame-stream")
    expect(result.duplicate.idempotencyKey).toBe(result.first.idempotencyKey)
    expect(result.body).toHaveLength(1)
    expect(result.body[0].frameId).toBe(result.first.frameId)
  })
})
