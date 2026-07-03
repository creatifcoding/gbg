import { describe, expect, it } from "vitest"
import * as Effect from "effect/Effect"

import {
  FrameProjectionSpec,
  ProjectionCaggCompileError,
  compileProjectionCagg,
  compileTimescaleProjectionUnsafe,
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
      {
        column: "heart_rate",
        sqlType: "double precision",
        path: ["heartRate", "bpm"],
        role: "value",
      },
    ],
  },
})

describe("Projection CAGG compiler", () => {
  it("plans a continuous aggregate over completed frame rows only", async () => {
    const plan = compileTimescaleProjectionUnsafe(spec)
    const cagg = await Effect.runPromise(
      compileProjectionCagg(plan, {
        projectionId: spec.id,
        viewName: "vitals_snapshot_hourly",
        bucket: "1 hour",
        groupByColumns: ["projection_id", "patient_id"],
        aggregates: [
          { alias: "frame_count", kind: "count-frames" },
          { alias: "heart_rate_avg", kind: "avg", column: "heart_rate" },
          { alias: "heart_rate_max", kind: "max", column: "heart_rate" },
        ],
        refreshPolicy: {
          startOffset: "7 days",
          endOffset: "1 hour",
          scheduleInterval: "1 hour",
        },
      }),
    )

    expect(cagg.viewName).toBe("vitals_snapshot_hourly")
    expect(cagg.statements).toHaveLength(2)
    expect(cagg.statements[0]?.sql).toContain("WITH (timescaledb.continuous)")
    expect(cagg.statements[0]?.sql).toContain('WHERE "complete" = TRUE')
    expect(cagg.statements[0]?.sql).toContain('time_bucket(INTERVAL \'1 hour\', "frame_time") AS "bucket"')
    expect(cagg.statements[0]?.sql).toContain('AVG("heart_rate") AS "heart_rate_avg"')
    expect(cagg.statements[1]?.sql).toContain("add_continuous_aggregate_policy")
  })

  it("rejects unsafe identifiers and aggregates missing required columns", async () => {
    const plan = compileTimescaleProjectionUnsafe(spec)
    const unsafe = await Effect.runPromise(
      compileProjectionCagg(plan, {
        projectionId: spec.id,
        viewName: "BadView",
        bucket: "1 hour",
        groupByColumns: [],
        aggregates: [{ alias: "frame_count", kind: "count-frames" }],
      }).pipe(Effect.result),
    )
    const missingColumn = await Effect.runPromise(
      compileProjectionCagg(plan, {
        projectionId: spec.id,
        viewName: "vitals_snapshot_hourly",
        bucket: "1 hour",
        groupByColumns: [],
        aggregates: [{ alias: "heart_rate_avg", kind: "avg" }],
      }).pipe(Effect.result),
    )

    expect(unsafe._tag).toBe("Failure")
    if (unsafe._tag === "Failure") expect(unsafe.failure).toBeInstanceOf(ProjectionCaggCompileError)
    expect(missingColumn._tag).toBe("Failure")
    if (missingColumn._tag === "Failure") expect(missingColumn.failure).toBeInstanceOf(ProjectionCaggCompileError)
  })

  it("rejects CAGG specs for the wrong projection plan", async () => {
    const plan = compileTimescaleProjectionUnsafe(spec)
    const result = await Effect.runPromise(
      compileProjectionCagg(plan, {
        projectionId: "other.projection@1.0.0",
        viewName: "other_hourly",
        bucket: "1 hour",
        groupByColumns: [],
        aggregates: [{ alias: "frame_count", kind: "count-frames" }],
      }).pipe(Effect.result),
    )

    expect(result._tag).toBe("Failure")
    if (result._tag === "Failure") expect(result.failure.message).toContain("does not match")
  })
})
