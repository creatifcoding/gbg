import { describe, expect, it } from "vitest"
import * as Schema from "effect/Schema"

import {
  SoakArtifactSchemaVersion,
  SoakEvent,
  SoakRunConfig,
  SoakRunSummary,
  VitalsSoakWorkload,
} from "../src/hardening/index.js"

describe("soak artifact schemas", () => {
  it("defines the deterministic vitals workload contract", () => {
    expect(VitalsSoakWorkload.streams.map((stream) => stream.streamId)).toEqual([
      "vitals.heart_rate",
      "vitals.spo2",
      "vitals.temperature",
    ])
    expect(VitalsSoakWorkload.frames[0]?.streamId).toBe("frames.vitals.snapshot")
    expect(VitalsSoakWorkload.frames[0]?.table).toBe("vitals_snapshot_frames")
  })

  it("round-trips a soak run config", () => {
    const config = SoakRunConfig.make({
      schemaVersion: SoakArtifactSchemaVersion,
      runId: "soak-2026-05-26T00-00-00Z",
      tier: "local-process",
      startedAt: "2026-05-26T00:00:00.000Z",
      status: "planned",
      workload: VitalsSoakWorkload,
      nodes: [
        { nodeId: "producer-1", role: "producer", processId: 101, host: "localhost" },
        { nodeId: "worker-1", role: "worker", processId: 102, host: "localhost" },
        { nodeId: "verifier-1", role: "verifier", processId: 103, host: "localhost" },
      ],
      artifactDir: "packages/pct/.soak-runs/soak-2026-05-26T00-00-00Z",
    })

    const encoded = Schema.encodeUnknownSync(SoakRunConfig)(config)
    const decoded = Schema.decodeUnknownSync(SoakRunConfig)(encoded)

    expect(decoded).toEqual(config)
  })

  it("validates JSONL-compatible soak events", () => {
    const event = SoakEvent.make({
      schemaVersion: SoakArtifactSchemaVersion,
      runId: "soak-1",
      eventId: "event-1",
      kind: "message.produced",
      at: "2026-05-26T00:00:01.000Z",
      nodeId: "producer-1",
      streamId: "vitals.heart_rate",
      sequence: 1,
      metrics: [{ name: "messagesProduced", value: 1, unit: "count" }],
    })

    expect(Schema.decodeUnknownSync(SoakEvent)(Schema.encodeUnknownSync(SoakEvent)(event))).toEqual(event)
  })

  it("validates summary artifacts for pass/fail gates", () => {
    const summary = SoakRunSummary.make({
      schemaVersion: SoakArtifactSchemaVersion,
      runId: "soak-1",
      tier: "local-process",
      status: "passed",
      startedAt: "2026-05-26T00:00:00.000Z",
      completedAt: "2026-05-26T00:01:00.000Z",
      durationMs: 60_000,
      workload: VitalsSoakWorkload,
      metrics: [
        { name: "messagesProduced", value: 180, unit: "count" },
        { name: "framesEmitted", value: 60, unit: "count" },
        { name: "duplicatesDetected", value: 0, unit: "count" },
        { name: "gapsDetected", value: 0, unit: "count" },
      ],
      verifier: {
        checkedMessages: 180,
        checkedFrames: 60,
        duplicatesDetected: 0,
        gapsDetected: 0,
        schemaFailures: 0,
      },
      eventLogPath: "packages/pct/.soak-runs/soak-1/events.jsonl",
    })

    expect(summary.verifier.duplicatesDetected).toBe(0)
    expect(Schema.decodeUnknownSync(SoakRunSummary)(Schema.encodeUnknownSync(SoakRunSummary)(summary))).toEqual(summary)
  })

  it("rejects unsupported artifact schema versions", () => {
    expect(() =>
      Schema.decodeUnknownSync(SoakEvent)({
        schemaVersion: "pct.soak@999",
        runId: "soak-1",
        eventId: "event-1",
        kind: "run.started",
        at: "2026-05-26T00:00:00.000Z",
      }),
    ).toThrow(/pct\.soak@1/)
  })
})
