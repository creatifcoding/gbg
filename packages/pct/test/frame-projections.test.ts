import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"

import {
  FrameProjectionCompileError,
  FrameProjectionSpec,
  compileTimescaleProjection,
} from "../src/frames/index.js"

const vitalsSpec = FrameProjectionSpec.make({
  id: "vitals.snapshot@1.0.0",
  description: "Coherent vitals frame assembled from pure metric streams.",
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
    allowedLatenessMs: 2_000,
    onTimeout: "emit-partial",
  },
  output: {
    table: "vitals_snapshot_frames",
    streamId: "frames.vitals.snapshot",
    schemaId: "frames.vitals.snapshot@1.0.0",
    mode: "hybrid-wide",
    columns: [
      {
        column: "patient_id",
        sqlType: "text",
        path: ["patientId"],
        nullable: false,
        role: "key",
      },
      {
        column: "heart_rate_bpm",
        sqlType: "double precision",
        path: ["heartRate", "bpm"],
        role: "value",
      },
      {
        column: "spo2_percent",
        sqlType: "double precision",
        path: ["spo2", "percent"],
        role: "value",
      },
      {
        column: "temperature_celsius",
        sqlType: "double precision",
        path: ["temperature", "celsius"],
        role: "value",
      },
    ],
  },
  timescale: {
    compressAfter: "7 days",
    retainFor: "180 days",
  },
})

describe("Frame projections — Timescale compiler", () => {
  it("compiles a vitals frame spec into deterministic support + frame DDL", async () => {
    const plan = await Effect.runPromise(compileTimescaleProjection(vitalsSpec))

    expect(plan.projectionId).toBe("vitals.snapshot@1.0.0")
    expect(plan.frameTable).toBe("vitals_snapshot_frames")
    expect(plan.sourceFactTable).toBe("metric_observations")
    expect(plan.stateTable).toBe("frame_projection_state")
    expect(plan.ledgerTable).toBe("frame_part_ledger")
    expect(plan.leaseTable).toBe("projection_worker_leases")
    expect(plan.checkpointTable).toBe("projection_source_checkpoints")
    expect(plan.outboxTable).toBe("projection_output_outbox")
    expect(plan.emissionTable).toBe("projection_frame_emissions")
    expect(plan.statements.map((statement) => statement.label)).toEqual([
      "create-source-fact-table",
      "hypertable-source-facts",
      "index-source-facts-stream-offset",
      "index-source-facts-entity-time",
      "create-frame-state-table",
      "index-frame-state-deadline",
      "create-frame-ledger-table",
      "index-frame-ledger-frame",
      "create-worker-lease-table",
      "index-worker-leases-expiry",
      "create-source-checkpoint-table",
      "create-output-outbox-table",
      "index-output-outbox-pending",
      "create-frame-emission-table",
      "create-frame-table",
      "hypertable-frame-table",
      "index-frame-key-patient_id",
      "index-frame-complete-time",
      "index-frame-projection-time",
      "configure-frame-compression",
      "policy-frame-compression",
      "policy-frame-retention",
    ])

    const createFrame = plan.statements.find((statement) => statement.label === "create-frame-table")
    expect(createFrame?.sql).toContain("CREATE TABLE IF NOT EXISTS \"vitals_snapshot_frames\"")
    expect(createFrame?.sql).toContain("\"patient_id\" text NOT NULL")
    expect(createFrame?.sql).toContain("\"heart_rate_bpm\" double precision")
    expect(createFrame?.sql).toContain("\"payload\" JSONB NOT NULL")
    expect(createFrame?.sql).toContain("\"provenance\" JSONB NOT NULL")

    const outbox = plan.statements.find((statement) => statement.label === "create-output-outbox-table")
    expect(outbox?.sql).toContain("\"producer_id\" TEXT NOT NULL")
    expect(outbox?.sql).toContain("\"idempotency_key\" TEXT NOT NULL UNIQUE")

    const compression = plan.statements.find((statement) => statement.label === "configure-frame-compression")
    expect(compression?.sql).toContain("timescaledb.compress_segmentby = 'patient_id, projection_id'")
  })

  it("can omit shared support tables for migrations that manage them globally", async () => {
    const plan = await Effect.runPromise(
      compileTimescaleProjection({
        ...vitalsSpec,
        timescale: {
          ...vitalsSpec.timescale,
          includeSupportTables: false,
        },
      }),
    )

    expect(plan.statements[0]?.label).toBe("create-frame-table")
    expect(plan.statements.some((statement) => statement.label === "create-frame-state-table")).toBe(false)
  })

  it("rejects unsafe SQL identifiers before producing DDL", async () => {
    const result = await Effect.runPromise(
      compileTimescaleProjection({
        ...vitalsSpec,
        output: { ...vitalsSpec.output, table: "Vitals; DROP TABLE readings;" },
      }).pipe(Effect.result),
    )

    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") {
      expect(result.failure).toBeInstanceOf(FrameProjectionCompileError)
      expect(result.failure.message).toMatch(/lowercase SQL identifier/)
    }
  })

  it("rejects duplicate promoted columns", async () => {
    const result = await Effect.runPromise(
      compileTimescaleProjection({
        ...vitalsSpec,
        output: {
          ...vitalsSpec.output,
          columns: [
            ...vitalsSpec.output.columns,
            {
              column: "patient_id",
              sqlType: "text",
              path: ["alternatePatientId"],
              role: "key",
            },
          ],
        },
      }).pipe(Effect.result),
    )

    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") {
      expect(result.failure).toBeInstanceOf(FrameProjectionCompileError)
      expect(result.failure.message).toMatch(/duplicate values: patient_id/)
    }
  })
})
