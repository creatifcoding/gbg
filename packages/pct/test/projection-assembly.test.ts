import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"

import {
  FrameProjectionSpec,
  ProjectionAssemblyError,
  calculateFrameBucket,
  deterministicFrameId,
  emptyProjectionPartLedgerState,
  frameTimeoutOutcome,
  ledgerDecisionForPart,
  mergeFramePart,
  recordLedgerDecision,
  sourceMessageToFramePart,
  type ProjectionSourceMessageType,
} from "../src/frames/index.js"

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
    allowedLatenessMs: 1_000,
    onTimeout: "emit-partial",
  },
  output: {
    table: "vitals_snapshot_frames",
    schemaId: "frames.vitals.snapshot@1.0.0",
    mode: "hybrid-wide",
    columns: [],
  },
})

const message = (
  partKey: "heartRate" | "spo2" | "temperature",
  offset: string,
  observedAt = "2026-05-24T12:00:04.250Z",
): ProjectionSourceMessageType => ({
  projectionId: spec.id,
  streamId: partKey === "heartRate" ? "vitals.heart_rate" : partKey === "spo2" ? "vitals.spo2" : "vitals.temperature",
  offset,
  schemaId: partKey === "heartRate" ? "vitals.heart_rate@1.0.0" : partKey === "spo2" ? "vitals.spo2@1.0.0" : "vitals.temperature@1.0.0",
  partKey,
  observedAt,
  entityKey: { patientId: "patient-7", ward: "icu" },
  payload: { value: offset },
  receivedAt: Date.parse(observedAt) + 100,
})

describe("Projection assembly kernel", () => {
  it("calculates deterministic buckets and frame ids from observation time + entity key", async () => {
    const bucket = await Effect.runPromise(calculateFrameBucket(spec, "2026-05-24T12:00:04.250Z"))
    const idA = deterministicFrameId(spec, bucket.bucketStart, { ward: "icu", patientId: "patient-7" })
    const idB = deterministicFrameId(spec, bucket.bucketStart, { patientId: "patient-7", ward: "icu" })

    expect(bucket.bucketStart).toBe("2026-05-24T12:00:00.000Z")
    expect(bucket.bucketEnd).toBe("2026-05-24T12:00:05.000Z")
    expect(bucket.deadlineAt).toBe("2026-05-24T12:00:06.000Z")
    expect(idA).toBe(idB)
    expect(idA).toContain(`${spec.id}#2026-05-24T12:00:00.000Z#`)
  })

  it("turns declared source messages into parts and rejects undeclared bindings", async () => {
    const part = await Effect.runPromise(sourceMessageToFramePart(spec, message("heartRate", "1")))
    const rejected = await Effect.runPromise(
      sourceMessageToFramePart(spec, { ...message("heartRate", "1"), streamId: "vitals.unknown" }).pipe(Effect.result),
    )

    expect(part.frameTime).toBe("2026-05-24T12:00:00.000Z")
    expect(part.deadlineAt).toBe("2026-05-24T12:00:06.000Z")
    expect(part.provenance.sourceOffset).toBe("1")
    expect(rejected._tag).toBe("Failure")
    if (rejected._tag === "Failure") expect(rejected.failure).toBeInstanceOf(ProjectionAssemblyError)
  })

  it("merges parts, tracks completeness, and ignores duplicate source offsets", async () => {
    const heart = await Effect.runPromise(sourceMessageToFramePart(spec, message("heartRate", "1")))
    const spo2 = await Effect.runPromise(sourceMessageToFramePart(spec, message("spo2", "2")))
    const temp = await Effect.runPromise(sourceMessageToFramePart(spec, message("temperature", "3")))

    const first = await Effect.runPromise(mergeFramePart(spec, undefined, heart, 100))
    const duplicate = await Effect.runPromise(mergeFramePart(spec, first.state, heart, 101))
    const second = await Effect.runPromise(mergeFramePart(spec, duplicate.state, spo2, 102))
    const complete = await Effect.runPromise(mergeFramePart(spec, second.state, temp, 103))

    expect(first.state.completeness).toMatchObject({ complete: false, missingParts: ["spo2", "temperature"] })
    expect(duplicate.duplicate).toBe(true)
    expect(duplicate.state.parts).toHaveLength(1)
    expect(second.state.completeness.missingParts).toEqual(["temperature"])
    expect(complete.state.completeness.complete).toBe(true)
    expect(complete.state.parts.map((part) => part.partKey)).toEqual(["heartRate", "spo2", "temperature"])
  })

  it("models timeout outcomes from projection policy without mutating state", async () => {
    const heart = await Effect.runPromise(sourceMessageToFramePart(spec, message("heartRate", "1")))
    const { state } = await Effect.runPromise(mergeFramePart(spec, undefined, heart, 100))
    const before = await Effect.runPromise(frameTimeoutOutcome(spec, state, Date.parse("2026-05-24T12:00:05.999Z")))
    const after = await Effect.runPromise(frameTimeoutOutcome(spec, state, Date.parse("2026-05-24T12:00:06.000Z")))

    expect(before).toBe("none")
    expect(after).toBe("emitted-partial")
  })

  it("models source-offset idempotency ledger decisions", async () => {
    const heart = await Effect.runPromise(sourceMessageToFramePart(spec, message("heartRate", "1")))
    const initial = emptyProjectionPartLedgerState()
    const accepted = ledgerDecisionForPart(initial, heart, 100)
    const recorded = recordLedgerDecision(initial, accepted)
    const duplicate = ledgerDecisionForPart(recorded, heart, 101)

    expect(accepted.accepted).toBe(true)
    expect(accepted.duplicate).toBe(false)
    expect(recorded.entries).toHaveLength(1)
    expect(duplicate.accepted).toBe(false)
    expect(duplicate.duplicate).toBe(true)
    expect(recordLedgerDecision(recorded, duplicate)).toBe(recorded)
  })
})
