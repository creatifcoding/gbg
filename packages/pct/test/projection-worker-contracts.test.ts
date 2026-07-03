import { describe, expect, it } from "vitest"
import * as Schema from "effect/Schema"

import {
  MaterializedFrame,
  ProjectionRunOnceRequest,
  ProjectionRunOnceResponse,
  ProjectionWorkerNatsOperation,
  ProjectionWorkerSnapshot,
  ProjectionWorkerStatus,
  projectionWorkerNatsOperations,
  resolveProjectionWorkerNatsOptions,
} from "../src/frames/index.js"

const decode = <A, I>(schema: Schema.Schema<A, I, never>, value: unknown): A =>
  Schema.decodeUnknownSync(schema)(value)

describe("ProjectionWorker contracts", () => {
  it("defines materialized frames with required completeness and provenance metadata", () => {
    const frame = decode(MaterializedFrame, {
      projectionId: "vitals.snapshot@1.0.0",
      projectionVersion: "1.0.0",
      outputSchemaId: "frames.vitals.snapshot@1.0.0",
      frameId: "vitals.snapshot@1.0.0:watch-001:2026-05-20T00:00:00.000Z",
      frameTime: "2026-05-20T00:00:00.000Z",
      entityKey: { patientId: "patient-001" },
      complete: false,
      missingParts: ["temperature"],
      imputedParts: ["spo2"],
      payload: {
        patientId: "patient-001",
        heartRate: { bpm: 72 },
        spo2: { percent: 98, imputed: true },
      },
      provenance: [
        {
          partKey: "heartRate",
          sourceStreamId: "vitals.heart_rate",
          sourceOffset: "msh:1:42",
          sourceSchemaId: "vitals.heart_rate@1.0.0",
          observedAt: "2026-05-20T00:00:00.000Z",
          receivedAt: 1_771_459_200_000,
        },
      ],
      frameRevision: 1,
      emittedAt: 1_771_459_201_000,
    })

    expect(frame.projectionId).toBe("vitals.snapshot@1.0.0")
    expect(frame.complete).toBe(false)
    expect(frame.missingParts).toEqual(["temperature"])
    expect(frame.imputedParts).toEqual(["spo2"])
    expect(frame.provenance[0]?.sourceStreamId).toBe("vitals.heart_rate")
  })

  it("rejects invalid worker lifecycle states", () => {
    expect(() => decode(ProjectionWorkerStatus, "wandering-off-script")).toThrow()
  })

  it("resolves NATS micro subjects without leaking projection semantics into MSH", () => {
    const resolved = resolveProjectionWorkerNatsOptions({
      subjectRoot: "pct.v2.projection",
      queue: "projection-workers",
      metadata: { deployment: "edge-a" },
    })

    expect(resolved.subjects).toEqual({
      plan: "pct.v2.projection.plan",
      start: "pct.v2.projection.start",
      stop: "pct.v2.projection.stop",
      status: "pct.v2.projection.status",
      runOnce: "pct.v2.projection.run_once",
      tail: "pct.v2.projection.tail",
    })
    expect(resolved.queue).toBe("projection-workers")
    expect(resolved.metadata).toMatchObject({
      domain: "pct",
      role: "projection-worker",
      boundary: "semantic-worker-over-msh-micro-substrate",
      deployment: "edge-a",
    })
  })

  it("declares the complete NATS operation manifest", () => {
    const operations = projectionWorkerNatsOperations({ subjectRoot: "pct.v1.projection" })
      .map((operation) => decode(ProjectionWorkerNatsOperation, operation))

    expect(operations.map((operation) => operation.operation)).toEqual([
      "projection.plan",
      "projection.start",
      "projection.stop",
      "projection.status",
      "projection.run_once",
      "projection.tail",
    ])
    expect(operations.map((operation) => operation.subject)).toEqual([
      "pct.v1.projection.plan",
      "pct.v1.projection.start",
      "pct.v1.projection.stop",
      "pct.v1.projection.status",
      "pct.v1.projection.run_once",
      "pct.v1.projection.tail",
    ])
  })

  it("round-trips run_once request/response contracts", () => {
    const request = decode(ProjectionRunOnceRequest, {
      projectionId: "vitals.snapshot@1.0.0",
      workerId: "worker-a",
      maxMessages: 500,
      dryRun: true,
    })
    expect(request.dryRun).toBe(true)

    const worker = decode(ProjectionWorkerSnapshot, {
      workerId: "worker-a",
      projectionId: "vitals.snapshot@1.0.0",
      status: "running",
      mode: "run-once",
      startedAt: 1,
      stoppedAt: null,
      lastTickAt: 2,
      processedMessages: 3,
      emittedFrames: 1,
      duplicateParts: 0,
      failedFrames: 0,
      lastError: null,
    })

    const response = decode(ProjectionRunOnceResponse, {
      summary: {
        workerId: worker.workerId,
        projectionId: worker.projectionId,
        status: worker.status,
        ticks: [],
        processedMessages: worker.processedMessages,
        emittedFrames: worker.emittedFrames,
        duplicateParts: worker.duplicateParts,
        failedFrames: worker.failedFrames,
        startedAt: 1,
        finishedAt: 3,
      },
    })

    expect(response.summary.status).toBe("running")
    expect(response.summary.emittedFrames).toBe(1)
  })
})
