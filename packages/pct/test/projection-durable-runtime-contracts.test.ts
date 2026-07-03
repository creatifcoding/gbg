import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"

import {
  FrameProjectionSpec,
  ProjectionCheckpointStore,
  ProjectionDurableStateStore,
  ProjectionLeaseDenied,
  ProjectionLeaseLost,
  ProjectionLeaseStore,
  ProjectionOutputOutbox,
  ProjectionOutputReceipt,
  ProjectionWorkerConfig,
  compileTimescaleProjectionUnsafe,
  projectionDurableRuntimeMemoryLayer,
  sourceMessageToFramePart,
  type ProjectionSourceMessageType,
} from "../src/frames/index.js"

const makeSpec = () => FrameProjectionSpec.make({
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

const makeConfig = (spec: ReturnType<typeof makeSpec>) => ProjectionWorkerConfig.make({
  workerId: "worker-a",
  spec,
  plan: compileTimescaleProjectionUnsafe(spec),
  mode: "run-once",
  maxMessagesPerTick: 10,
  idlePollMs: 10,
})

describe("Projection durable runtime contracts", () => {
  it("acquires, rejects conflicting, renews, and releases durable leases", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const leases = yield* ProjectionLeaseStore
        const first = yield* leases.acquire({
          projectionId: "vitals.snapshot@1.0.0",
          workerId: "worker-a",
          lane: "hot",
          targetKey: "vitals.snapshot@1.0.0",
          ttlMs: 1_000,
          now: 100,
        })
        const denied = yield* Effect.flip(leases.acquire({
          projectionId: "vitals.snapshot@1.0.0",
          workerId: "worker-b",
          lane: "hot",
          targetKey: "vitals.snapshot@1.0.0",
          ttlMs: 1_000,
          now: 200,
        }))
        const renewed = yield* leases.renew({
          leaseId: first.leaseId,
          workerId: first.workerId,
          fenceToken: first.fenceToken,
          ttlMs: 2_000,
          now: 300,
        })
        yield* leases.release({
          leaseId: renewed.leaseId,
          workerId: renewed.workerId,
          fenceToken: renewed.fenceToken,
          now: 400,
        })
        const afterRelease = yield* leases.acquire({
          projectionId: "vitals.snapshot@1.0.0",
          workerId: "worker-b",
          lane: "hot",
          targetKey: "vitals.snapshot@1.0.0",
          ttlMs: 1_000,
          now: 500,
        })
        const lost = yield* Effect.flip(leases.renew({
          leaseId: renewed.leaseId,
          workerId: renewed.workerId,
          fenceToken: renewed.fenceToken,
          ttlMs: 1_000,
          now: 600,
        }))
        return { first, denied, renewed, afterRelease, lost }
      }).pipe(Effect.provide(projectionDurableRuntimeMemoryLayer)),
    )

    expect(result.first.workerId).toBe("worker-a")
    expect(result.denied).toBeInstanceOf(ProjectionLeaseDenied)
    expect(result.renewed.expiresAt).toBe(2_300)
    expect(result.afterRelease.workerId).toBe("worker-b")
    expect(result.lost).toBeInstanceOf(ProjectionLeaseLost)
  })

  it("stores source checkpoints only when explicitly committed", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const checkpoints = yield* ProjectionCheckpointStore
        const key = {
          projectionId: "vitals.snapshot@1.0.0",
          sourceStreamId: "vitals.heart_rate",
          partKey: "heartRate",
        }
        const before = yield* checkpoints.get(key)
        const committed = yield* checkpoints.commit({
          key,
          offset: "msh:00000000000000000001_00000000000000000000",
          fenceToken: "worker-a:100:fence",
          now: 123,
        })
        const after = yield* checkpoints.get(key)
        return { before, committed, after }
      }).pipe(Effect.provide(projectionDurableRuntimeMemoryLayer)),
    )

    expect(result.before).toBe("-1")
    expect(result.committed.updatedAt).toBe(123)
    expect(result.after).toBe("msh:00000000000000000001_00000000000000000000")
  })

  it("atomically accepts parts, suppresses duplicate source offsets, and exposes frame outbox records", async () => {
    const spec = makeSpec()
    const config = makeConfig(spec)
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const store = yield* ProjectionDurableStateStore
        const outbox = yield* ProjectionOutputOutbox
        const heart = message(spec, "heartRate", "1")
        const spo2 = message(spec, "spo2", "2")
        const temp = message(spec, "temperature", "3")
        const heartPart = yield* sourceMessageToFramePart(spec, heart)
        const accepted = yield* store.ingestPart({
          config,
          message: heart,
          part: heartPart,
          fenceToken: "worker-a:100:fence",
          now: 100,
        })
        const duplicate = yield* store.ingestPart({
          config,
          message: heart,
          part: heartPart,
          fenceToken: "worker-a:100:fence",
          now: 101,
        })
        const spo2Part = yield* sourceMessageToFramePart(spec, spo2)
        yield* store.ingestPart({ config, message: spo2, part: spo2Part, fenceToken: "worker-a:100:fence", now: 102 })
        const tempPart = yield* sourceMessageToFramePart(spec, temp)
        const completed = yield* store.ingestPart({ config, message: temp, part: tempPart, fenceToken: "worker-a:100:fence", now: 103 })
        const pending = yield* outbox.pending({ projectionId: spec.id, limit: 10, now: 104 })
        const failed = yield* outbox.markFailed({
          outboxId: pending[0]!.outboxId,
          error: "temporary LNK publish failure",
          retryAt: 200,
          now: 105,
        })
        const retryReadyBefore = yield* outbox.pending({ projectionId: spec.id, limit: 10, now: 150 })
        const retryReadyAfter = yield* outbox.pending({ projectionId: spec.id, limit: 10, now: 250 })
        const receipt = ProjectionOutputReceipt.make({
          kind: "lnk-frame-stream",
          projectionId: spec.id,
          frameId: completed.frameId,
          target: "frames.vitals.snapshot",
          idempotencyKey: pending[0]!.idempotencyKey,
          writtenAt: 260,
        })
        const published = yield* outbox.markPublished({ outboxId: pending[0]!.outboxId, receipt, now: 260 })
        const afterPublish = yield* outbox.pending({ projectionId: spec.id, limit: 10, now: 300 })
        return { accepted, duplicate, completed, pending, failed, retryReadyBefore, retryReadyAfter, published, afterPublish }
      }).pipe(Effect.provide(projectionDurableRuntimeMemoryLayer)),
    )

    expect(result.accepted.outcome).toBe("accepted-part")
    expect(result.duplicate.outcome).toBe("duplicate-source-offset")
    expect(result.completed.outcome).toBe("completed-frame")
    expect(result.completed.materializedFrame?.complete).toBe(true)
    expect(result.completed.outboxRecords).toHaveLength(1)
    expect(result.pending).toHaveLength(1)
    expect(result.failed.status).toBe("failed")
    expect(result.failed.attempt).toBe(1)
    expect(result.retryReadyBefore).toHaveLength(0)
    expect(result.retryReadyAfter).toHaveLength(1)
    expect(result.published.status).toBe("published")
    expect(result.afterPublish).toHaveLength(0)
  })
})
