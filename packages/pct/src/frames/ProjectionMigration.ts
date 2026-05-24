/**
 * Operator-controlled projection migration preview/apply hooks.
 *
 * This is deliberately a control-plane seam, not a database client hidden inside
 * the scheduler. Operators preview compiled ProjectionPlan DDL, receive a stable
 * approval token, and only an explicit apply request may call the injected
 * applier port.
 *
 * @module @tmnl/pct/frames/ProjectionMigration
 */

import * as Context from "effect-v4/Context"
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Ref from "effect-v4/Ref"
import * as Schema from "effect-v4/Schema"

import { ProjectionPlan, type ProjectionDdlStatement } from "./FrameProjectionSpec.js"
import {
  ProjectionNotFound,
  ProjectionRegistry,
  type ProjectionRegistryShape,
} from "./ProjectionRegistry.js"

// ─── Schemas ────────────────────────────────────────────────────────────────

export const ProjectionMigrationRisk = Schema.Literals([
  "safe-idempotent",
  "operator-review",
])
export type ProjectionMigrationRisk = typeof ProjectionMigrationRisk.Type

export const ProjectionMigrationStatement = Schema.Struct({
  ordinal: Schema.Int,
  label: Schema.String,
  sql: Schema.String,
  checksum: Schema.String,
  risk: ProjectionMigrationRisk,
})
export type ProjectionMigrationStatement = typeof ProjectionMigrationStatement.Type

export const ProjectionMigrationWarning = Schema.Struct({
  code: Schema.String,
  message: Schema.String,
  statementLabel: Schema.NullOr(Schema.String),
})
export type ProjectionMigrationWarning = typeof ProjectionMigrationWarning.Type

export const ProjectionMigrationPreviewRequest = Schema.Struct({
  projectionId: Schema.String,
  operatorId: Schema.optional(Schema.String),
  includeSql: Schema.optional(Schema.Boolean),
})
export type ProjectionMigrationPreviewRequest = typeof ProjectionMigrationPreviewRequest.Type

export const ProjectionMigrationPreview = Schema.Struct({
  migrationId: Schema.String,
  projectionId: Schema.String,
  frameTable: Schema.String,
  statementCount: Schema.Int,
  statements: Schema.Array(ProjectionMigrationStatement),
  warnings: Schema.Array(ProjectionMigrationWarning),
  approvalToken: Schema.String,
  generatedAt: Schema.Number,
  operatorId: Schema.NullOr(Schema.String),
})
export type ProjectionMigrationPreview = typeof ProjectionMigrationPreview.Type

export const ProjectionMigrationApplyRequest = Schema.Struct({
  projectionId: Schema.String,
  migrationId: Schema.String,
  approvalToken: Schema.String,
  operatorId: Schema.String,
  dryRun: Schema.optional(Schema.Boolean),
})
export type ProjectionMigrationApplyRequest = typeof ProjectionMigrationApplyRequest.Type

export const ProjectionMigrationApplyResult = Schema.Struct({
  migrationId: Schema.String,
  projectionId: Schema.String,
  applied: Schema.Boolean,
  dryRun: Schema.Boolean,
  statementCount: Schema.Int,
  statements: Schema.Array(ProjectionMigrationStatement),
  appliedAt: Schema.Number,
  operatorId: Schema.String,
})
export type ProjectionMigrationApplyResult = typeof ProjectionMigrationApplyResult.Type

// ─── Errors ─────────────────────────────────────────────────────────────────

export class ProjectionMigrationPreviewNotFound extends Schema.TaggedErrorClass<ProjectionMigrationPreviewNotFound>()(
  "ProjectionMigrationPreviewNotFound",
  {
    projectionId: Schema.String,
    migrationId: Schema.String,
  },
) {}

export class ProjectionMigrationApprovalMismatch extends Schema.TaggedErrorClass<ProjectionMigrationApprovalMismatch>()(
  "ProjectionMigrationApprovalMismatch",
  {
    projectionId: Schema.String,
    migrationId: Schema.String,
  },
) {}

export class ProjectionMigrationApplyFailed extends Schema.TaggedErrorClass<ProjectionMigrationApplyFailed>()(
  "ProjectionMigrationApplyFailed",
  {
    projectionId: Schema.String,
    migrationId: Schema.String,
    statementLabel: Schema.String,
    message: Schema.String,
  },
) {}

// ─── Applier port ───────────────────────────────────────────────────────────

export interface ProjectionMigrationApplierShape {
  readonly applyStatement: (
    statement: ProjectionMigrationStatement,
  ) => Effect.Effect<void, unknown>
}

export class ProjectionMigrationApplier extends Context.Service<
  ProjectionMigrationApplier,
  ProjectionMigrationApplierShape
>()("@tmnl/pct/frames/ProjectionMigrationApplier") {}

export interface ProjectionMigrationControllerShape {
  readonly preview: (
    request: ProjectionMigrationPreviewRequest,
  ) => Effect.Effect<ProjectionMigrationPreview, ProjectionNotFound>
  readonly apply: (
    request: ProjectionMigrationApplyRequest,
  ) => Effect.Effect<
    ProjectionMigrationApplyResult,
    | ProjectionNotFound
    | ProjectionMigrationPreviewNotFound
    | ProjectionMigrationApprovalMismatch
    | ProjectionMigrationApplyFailed
  >
}

export class ProjectionMigrationController extends Context.Service<
  ProjectionMigrationController,
  ProjectionMigrationControllerShape
>()("@tmnl/pct/frames/ProjectionMigrationController") {}

// ─── Implementation ─────────────────────────────────────────────────────────

const hash = (value: string): string => {
  let h = 5381
  for (let i = 0; i < value.length; i += 1) {
    h = ((h << 5) + h) ^ value.charCodeAt(i)
  }
  return (h >>> 0).toString(16).padStart(8, "0")
}

const statementRisk = (statement: ProjectionDdlStatement): ProjectionMigrationRisk => {
  if (statement.label.startsWith("policy-") || statement.sql.includes("ALTER TABLE")) {
    return "operator-review"
  }
  return "safe-idempotent"
}

const statementWarnings = (
  statements: ReadonlyArray<ProjectionMigrationStatement>,
): ReadonlyArray<ProjectionMigrationWarning> =>
  statements
    .filter((statement) => statement.risk === "operator-review")
    .map((statement) => ProjectionMigrationWarning.make({
      code: "operator-review-statement",
      message: "statement changes Timescale policy/table settings and should be reviewed before apply",
      statementLabel: statement.label,
    }))

const migrationStatements = (
  plan: ProjectionPlan,
  includeSql: boolean,
): ReadonlyArray<ProjectionMigrationStatement> =>
  plan.statements.map((statement, index) => {
    const checksum = hash(`${statement.label}\n${statement.sql}`)
    return ProjectionMigrationStatement.make({
      ordinal: index + 1,
      label: statement.label,
      sql: includeSql ? statement.sql : "",
      checksum,
      risk: statementRisk(statement),
    })
  })

const migrationId = (
  projectionId: string,
  statements: ReadonlyArray<ProjectionMigrationStatement>,
): string => `${projectionId}:${hash(statements.map((statement) => statement.checksum).join("|"))}`

const approvalToken = (
  migrationIdValue: string,
  statements: ReadonlyArray<ProjectionMigrationStatement>,
): string => `approve:${migrationIdValue}:${hash(statements.map((statement) => `${statement.ordinal}:${statement.checksum}`).join("|"))}`

const makePreview = (
  plan: ProjectionPlan,
  request: ProjectionMigrationPreviewRequest,
): ProjectionMigrationPreview => {
  const statements = migrationStatements(plan, request.includeSql ?? true)
  const id = migrationId(plan.projectionId, statements)
  return ProjectionMigrationPreview.make({
    migrationId: id,
    projectionId: plan.projectionId,
    frameTable: plan.frameTable,
    statementCount: statements.length,
    statements,
    warnings: statementWarnings(statements),
    approvalToken: approvalToken(id, statements),
    generatedAt: Date.now(),
    operatorId: request.operatorId ?? null,
  })
}

const makeImpl = (
  registry: ProjectionRegistryShape,
  applier: ProjectionMigrationApplierShape,
  previewsRef: Ref.Ref<ReadonlyMap<string, ProjectionMigrationPreview>>,
): ProjectionMigrationControllerShape => {
  const previewKey = (projectionId: string, id: string): string => `${projectionId}\n${id}`

  return {
    preview: (request) =>
      Effect.gen(function* () {
        const entry = yield* registry.get(request.projectionId)
        const preview = makePreview(entry.plan, request)
        yield* Ref.update(previewsRef, (state) => new Map(state).set(previewKey(preview.projectionId, preview.migrationId), preview))
        return preview
      }),

    apply: (request) =>
      Effect.gen(function* () {
        const entry = yield* registry.get(request.projectionId)
        const state = yield* Ref.get(previewsRef)
        const preview = state.get(previewKey(request.projectionId, request.migrationId))
        if (preview === undefined) {
          return yield* Effect.fail(
            new ProjectionMigrationPreviewNotFound({
              projectionId: request.projectionId,
              migrationId: request.migrationId,
            }),
          )
        }
        if (preview.approvalToken !== request.approvalToken) {
          return yield* Effect.fail(
            new ProjectionMigrationApprovalMismatch({
              projectionId: request.projectionId,
              migrationId: request.migrationId,
            }),
          )
        }

        const statements = migrationStatements(entry.plan, true)
        const at = Date.now()
        if (request.dryRun !== true) {
          for (const statement of statements) {
            yield* applier.applyStatement(statement).pipe(
              Effect.mapError((error) =>
                new ProjectionMigrationApplyFailed({
                  projectionId: request.projectionId,
                  migrationId: request.migrationId,
                  statementLabel: statement.label,
                  message: error instanceof Error ? error.message : String(error),
                }),
              ),
            )
          }
        }

        return ProjectionMigrationApplyResult.make({
          migrationId: request.migrationId,
          projectionId: request.projectionId,
          applied: request.dryRun !== true,
          dryRun: request.dryRun === true,
          statementCount: statements.length,
          statements,
          appliedAt: at,
          operatorId: request.operatorId,
        })
      }),
  }
}

export const projectionMigrationControllerLayer: Layer.Layer<
  ProjectionMigrationController,
  never,
  ProjectionRegistry | ProjectionMigrationApplier
> = Layer.effect(
  ProjectionMigrationController,
  Effect.gen(function* () {
    const registry = yield* ProjectionRegistry
    const applier = yield* ProjectionMigrationApplier
    const previewsRef = yield* Ref.make<ReadonlyMap<string, ProjectionMigrationPreview>>(new Map())
    return ProjectionMigrationController.of(makeImpl(registry, applier, previewsRef))
  }),
)

export interface MemoryProjectionMigrationApplierState {
  readonly applied: ReadonlyArray<ProjectionMigrationStatement>
}

export const projectionMigrationApplierLayerMemory: Layer.Layer<ProjectionMigrationApplier> = Layer.effect(
  ProjectionMigrationApplier,
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<MemoryProjectionMigrationApplierState>({ applied: [] })
    return ProjectionMigrationApplier.of({
      applyStatement: (statement) =>
        Ref.update(stateRef, (state) => ({ ...state, applied: [...state.applied, statement] })),
    })
  }),
)
