/**
 * Continuous aggregate planning over completed frame tables.
 *
 * CAGGs summarize already-coherent frame rows. They do not assemble frames and
 * they always filter `complete = TRUE` so incomplete/imputed operational state
 * cannot masquerade as observed aggregate truth.
 *
 * @module @tmnl/pct/frames/ProjectionCagg
 */

import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"

import {
  ProjectionDdlStatement,
  ProjectionPlan,
  type ProjectionPlan as ProjectionPlanType,
} from "./FrameProjectionSpec.js"

// ─── Schemas ────────────────────────────────────────────────────────────────

export const ProjectionCaggAggregateKind = Schema.Literals([
  "count-frames",
  "avg",
  "min",
  "max",
  "sum",
])
export type ProjectionCaggAggregateKind = typeof ProjectionCaggAggregateKind.Type

export const ProjectionCaggAggregate = Schema.Struct({
  alias: Schema.String,
  kind: ProjectionCaggAggregateKind,
  /** Promoted frame-table column. Required for avg/min/max/sum; ignored for count-frames. */
  column: Schema.optional(Schema.String),
})
export type ProjectionCaggAggregate = typeof ProjectionCaggAggregate.Type

export const ProjectionCaggRefreshPolicy = Schema.Struct({
  startOffset: Schema.String,
  endOffset: Schema.String,
  scheduleInterval: Schema.String,
})
export type ProjectionCaggRefreshPolicy = typeof ProjectionCaggRefreshPolicy.Type

export const ProjectionCaggSpec = Schema.Struct({
  projectionId: Schema.String,
  viewName: Schema.String,
  bucket: Schema.String,
  groupByColumns: Schema.Array(Schema.String),
  aggregates: Schema.Array(ProjectionCaggAggregate),
  refreshPolicy: Schema.optional(ProjectionCaggRefreshPolicy),
})
export type ProjectionCaggSpec = typeof ProjectionCaggSpec.Type

export const ProjectionCaggPlan = Schema.Struct({
  projectionId: Schema.String,
  viewName: Schema.String,
  frameTable: Schema.String,
  statements: Schema.Array(ProjectionDdlStatement),
})
export type ProjectionCaggPlan = typeof ProjectionCaggPlan.Type

export class ProjectionCaggCompileError extends Schema.TaggedErrorClass<ProjectionCaggCompileError>()(
  "ProjectionCaggCompileError",
  {
    projectionId: Schema.String,
    message: Schema.String,
  },
) {}

// ─── SQL helpers ────────────────────────────────────────────────────────────

const IDENTIFIER = /^[a-z][a-z0-9_]*$/
const INTERVAL = /^[0-9]+\s+(millisecond|milliseconds|second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months)$/

const q = (identifier: string): string => `"${identifier}"`
const lit = (value: string): string => `'${value.replace(/'/g, "''")}'`

const assertIdentifier = (
  projectionId: string,
  value: string,
  label: string,
): Effect.Effect<string, ProjectionCaggCompileError> =>
  IDENTIFIER.test(value)
    ? Effect.succeed(value)
    : Effect.fail(new ProjectionCaggCompileError({
        projectionId,
        message: `${label} must be a lowercase SQL identifier: ${value}`,
      }))

const assertInterval = (
  projectionId: string,
  value: string,
  label: string,
): Effect.Effect<string, ProjectionCaggCompileError> =>
  INTERVAL.test(value)
    ? Effect.succeed(value)
    : Effect.fail(new ProjectionCaggCompileError({
        projectionId,
        message: `${label} must be a simple interval literal, got: ${value}`,
      }))

const uniqueOrFail = (
  projectionId: string,
  values: ReadonlyArray<string>,
  label: string,
): Effect.Effect<void, ProjectionCaggCompileError> => {
  const duplicates = Array.from(new Set(values.filter((value, index) => values.indexOf(value) !== index)))
  return duplicates.length === 0
    ? Effect.void
    : Effect.fail(new ProjectionCaggCompileError({
        projectionId,
        message: `${label} contains duplicate values: ${duplicates.join(", ")}`,
      }))
}

const aggregateSql = (
  projectionId: string,
  aggregate: ProjectionCaggAggregate,
): Effect.Effect<string, ProjectionCaggCompileError> =>
  Effect.gen(function* () {
    const alias = yield* assertIdentifier(projectionId, aggregate.alias, `aggregates.${aggregate.alias}.alias`)
    if (aggregate.kind === "count-frames") {
      return `COUNT(*)::BIGINT AS ${q(alias)}`
    }
    if (aggregate.column === undefined) {
      return yield* Effect.fail(new ProjectionCaggCompileError({
        projectionId,
        message: `aggregate ${aggregate.alias} requires a column`,
      }))
    }
    const column = yield* assertIdentifier(projectionId, aggregate.column, `aggregates.${aggregate.alias}.column`)
    const fn = aggregate.kind.toUpperCase()
    return `${fn}(${q(column)}) AS ${q(alias)}`
  })

// ─── Compiler ───────────────────────────────────────────────────────────────

export const compileProjectionCagg = (
  plan: ProjectionPlanType,
  spec: ProjectionCaggSpec,
): Effect.Effect<ProjectionCaggPlan, ProjectionCaggCompileError> =>
  Effect.gen(function* () {
    if (plan.projectionId !== spec.projectionId) {
      return yield* Effect.fail(new ProjectionCaggCompileError({
        projectionId: spec.projectionId,
        message: `CAGG spec projectionId does not match plan projectionId ${plan.projectionId}`,
      }))
    }

    const viewName = yield* assertIdentifier(spec.projectionId, spec.viewName, "viewName")
    const frameTable = yield* assertIdentifier(spec.projectionId, plan.frameTable, "frameTable")
    const bucket = yield* assertInterval(spec.projectionId, spec.bucket, "bucket")
    for (const column of spec.groupByColumns) {
      yield* assertIdentifier(spec.projectionId, column, `groupByColumns.${column}`)
    }
    yield* uniqueOrFail(spec.projectionId, spec.groupByColumns, "groupByColumns")
    yield* uniqueOrFail(spec.projectionId, spec.aggregates.map((aggregate) => aggregate.alias), "aggregates.alias")
    if (spec.aggregates.length === 0) {
      return yield* Effect.fail(new ProjectionCaggCompileError({
        projectionId: spec.projectionId,
        message: "at least one aggregate is required",
      }))
    }

    if (spec.refreshPolicy !== undefined) {
      yield* assertInterval(spec.projectionId, spec.refreshPolicy.startOffset, "refreshPolicy.startOffset")
      yield* assertInterval(spec.projectionId, spec.refreshPolicy.endOffset, "refreshPolicy.endOffset")
      yield* assertInterval(spec.projectionId, spec.refreshPolicy.scheduleInterval, "refreshPolicy.scheduleInterval")
    }

    const aggregateSelects = yield* Effect.forEach(spec.aggregates, (aggregate) => aggregateSql(spec.projectionId, aggregate))
    const groupColumns = spec.groupByColumns.map(q)
    const selectColumns = [
      `time_bucket(INTERVAL ${lit(bucket)}, "frame_time") AS "bucket"`,
      ...groupColumns,
      ...aggregateSelects,
    ]
    const groupBy = ["bucket", ...groupColumns]
    const statements: ProjectionDdlStatement[] = [
      ProjectionDdlStatement.make({
        label: "create-frame-cagg",
        sql: `CREATE MATERIALIZED VIEW IF NOT EXISTS ${q(viewName)}
WITH (timescaledb.continuous) AS
SELECT
  ${selectColumns.join(",\n  ")}
FROM ${q(frameTable)}
WHERE "complete" = TRUE
GROUP BY ${groupBy.join(", ")}
WITH NO DATA;`,
      }),
    ]

    if (spec.refreshPolicy !== undefined) {
      statements.push(ProjectionDdlStatement.make({
        label: "policy-frame-cagg-refresh",
        sql: `SELECT add_continuous_aggregate_policy(${lit(viewName)},
  start_offset => INTERVAL ${lit(spec.refreshPolicy.startOffset)},
  end_offset => INTERVAL ${lit(spec.refreshPolicy.endOffset)},
  schedule_interval => INTERVAL ${lit(spec.refreshPolicy.scheduleInterval)});`,
      }))
    }

    return ProjectionCaggPlan.make({
      projectionId: spec.projectionId,
      viewName,
      frameTable,
      statements,
    })
  })

export const compileProjectionCaggUnsafe = (
  plan: ProjectionPlan,
  spec: ProjectionCaggSpec,
): ProjectionCaggPlan => Effect.runSync(compileProjectionCagg(plan, spec))
