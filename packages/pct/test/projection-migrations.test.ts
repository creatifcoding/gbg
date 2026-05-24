import { describe, expect, it } from "vitest"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Ref from "effect-v4/Ref"

import {
  FrameProjectionSpec,
  ProjectionMigrationApplier,
  ProjectionMigrationApprovalMismatch,
  ProjectionMigrationController,
  ProjectionMigrationPreviewNotFound,
  ProjectionRegistry,
  projectionMigrationControllerLayer,
  projectionRegistryLayerMemory,
  type ProjectionMigrationStatementType,
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
    ],
  },
  timescale: {
    compressAfter: "7 days",
    retainFor: "180 days",
  },
})

const makeRecordingApplierLayer = (
  appliedRef: Ref.Ref<ReadonlyArray<ProjectionMigrationStatementType>>,
): Layer.Layer<ProjectionMigrationApplier> =>
  Layer.succeed(
    ProjectionMigrationApplier,
    ProjectionMigrationApplier.of({
      applyStatement: (statement) => Ref.update(appliedRef, (state) => [...state, statement]),
    }),
  )

describe("Projection migration preview/apply", () => {
  it("previews compiled DDL with an explicit approval token", async () => {
    const preview = await Effect.runPromise(
      Effect.gen(function* () {
        const appliedRef = yield* Ref.make<ReadonlyArray<ProjectionMigrationStatementType>>([])
        const applierLayer = makeRecordingApplierLayer(appliedRef)
        return yield* Effect.gen(function* () {
          const registry = yield* ProjectionRegistry
          yield* registry.register(spec, { status: "active", now: 100 })
          const migrations = yield* ProjectionMigrationController
          return yield* migrations.preview({ projectionId: spec.id, operatorId: "prime" })
        }).pipe(
          Effect.provide(projectionMigrationControllerLayer),
          Effect.provide(applierLayer),
          Effect.provide(projectionRegistryLayerMemory),
        )
      }),
    )

    expect(preview.projectionId).toBe(spec.id)
    expect(preview.statementCount).toBeGreaterThan(0)
    expect(preview.approvalToken).toContain(`approve:${preview.migrationId}:`)
    expect(preview.statements[0]?.ordinal).toBe(1)
    expect(preview.statements.every((statement) => statement.checksum.length > 0)).toBe(true)
    expect(preview.warnings.some((warning) => warning.code === "operator-review-statement")).toBe(true)
  })

  it("applies only after preview approval and supports dry-run without executing statements", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const appliedRef = yield* Ref.make<ReadonlyArray<ProjectionMigrationStatementType>>([])
        const applierLayer = makeRecordingApplierLayer(appliedRef)
        return yield* Effect.gen(function* () {
          const registry = yield* ProjectionRegistry
          yield* registry.register(spec, { status: "active", now: 100 })
          const migrations = yield* ProjectionMigrationController
          const preview = yield* migrations.preview({ projectionId: spec.id, operatorId: "prime" })
          const dryRun = yield* migrations.apply({
            projectionId: spec.id,
            migrationId: preview.migrationId,
            approvalToken: preview.approvalToken,
            operatorId: "prime",
            dryRun: true,
          })
          const afterDryRun = yield* Ref.get(appliedRef)
          const applied = yield* migrations.apply({
            projectionId: spec.id,
            migrationId: preview.migrationId,
            approvalToken: preview.approvalToken,
            operatorId: "prime",
          })
          const afterApply = yield* Ref.get(appliedRef)
          return { preview, dryRun, afterDryRun, applied, afterApply }
        }).pipe(
          Effect.provide(projectionMigrationControllerLayer),
          Effect.provide(applierLayer),
          Effect.provide(projectionRegistryLayerMemory),
        )
      }),
    )

    expect(result.dryRun.dryRun).toBe(true)
    expect(result.dryRun.applied).toBe(false)
    expect(result.afterDryRun).toHaveLength(0)
    expect(result.applied.applied).toBe(true)
    expect(result.afterApply).toHaveLength(result.preview.statementCount)
  })

  it("rejects apply without matching preview approval", async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const appliedRef = yield* Ref.make<ReadonlyArray<ProjectionMigrationStatementType>>([])
        const applierLayer = makeRecordingApplierLayer(appliedRef)
        return yield* Effect.gen(function* () {
          const registry = yield* ProjectionRegistry
          yield* registry.register(spec, { status: "active", now: 100 })
          const migrations = yield* ProjectionMigrationController
          const missingPreview = yield* migrations.apply({
            projectionId: spec.id,
            migrationId: "missing",
            approvalToken: "approve:missing:nope",
            operatorId: "prime",
          }).pipe(Effect.result)
          const preview = yield* migrations.preview({ projectionId: spec.id, operatorId: "prime" })
          const mismatch = yield* migrations.apply({
            projectionId: spec.id,
            migrationId: preview.migrationId,
            approvalToken: "approve:wrong",
            operatorId: "prime",
          }).pipe(Effect.result)
          return { missingPreview, mismatch }
        }).pipe(
          Effect.provide(projectionMigrationControllerLayer),
          Effect.provide(applierLayer),
          Effect.provide(projectionRegistryLayerMemory),
        )
      }),
    )

    expect(result.missingPreview._tag).toBe("Failure")
    if (result.missingPreview._tag === "Failure") {
      expect(result.missingPreview.failure).toBeInstanceOf(ProjectionMigrationPreviewNotFound)
    }
    expect(result.mismatch._tag).toBe("Failure")
    if (result.mismatch._tag === "Failure") {
      expect(result.mismatch.failure).toBeInstanceOf(ProjectionMigrationApprovalMismatch)
    }
  })
})
