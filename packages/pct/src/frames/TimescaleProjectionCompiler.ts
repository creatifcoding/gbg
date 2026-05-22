/**
 * TimescaleProjectionCompiler — deterministic DDL planning for frame tables.
 *
 * This is intentionally a compiler, not a database client. It turns a
 * `FrameProjectionSpec` into SQL statements that migration tooling can review,
 * diff, and apply. The ProjectionWorker runtime is a separate concern.
 *
 * @module @tmnl/pct/frames/TimescaleProjectionCompiler
 */

import * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"

import {
  ProjectionPlan,
  type FrameProjectionSpec,
  type FrameSqlColumn,
  type ProjectionDdlStatement,
} from "./FrameProjectionSpec.js"

// ─── Errors ─────────────────────────────────────────────────────────────────

export class FrameProjectionCompileError extends Schema.TaggedErrorClass<FrameProjectionCompileError>()(
  "FrameProjectionCompileError",
  {
    projectionId: Schema.String,
    message: Schema.String,
  },
) {}

// ─── Constants ──────────────────────────────────────────────────────────────

const DEFAULT_SOURCE_FACT_TABLE = "metric_observations"
const DEFAULT_STATE_TABLE = "frame_projection_state"
const DEFAULT_LEDGER_TABLE = "frame_part_ledger"

const IDENTIFIER = /^[a-z][a-z0-9_]*$/

const assertIdentifier = (
  projectionId: string,
  value: string,
  label: string,
): Effect.Effect<string, FrameProjectionCompileError> =>
  IDENTIFIER.test(value)
    ? Effect.succeed(value)
    : Effect.fail(
        new FrameProjectionCompileError({
          projectionId,
          message: `${label} must be a lowercase SQL identifier: ${value}`,
        }),
      )

const assertInterval = (
  projectionId: string,
  value: string,
  label: string,
): Effect.Effect<string, FrameProjectionCompileError> =>
  /^[0-9]+\s+(millisecond|milliseconds|second|seconds|minute|minutes|hour|hours|day|days|week|weeks|month|months)$/.test(value)
    ? Effect.succeed(value)
    : Effect.fail(
        new FrameProjectionCompileError({
          projectionId,
          message: `${label} must be a simple interval literal, got: ${value}`,
        }),
      )

const q = (identifier: string): string => `"${identifier}"`
const lit = (value: string): string => `'${value.replace(/'/g, "''")}'`

const columnNullable = (column: FrameSqlColumn): boolean => {
  if (column.nullable !== undefined) return column.nullable
  return column.role !== "key"
}

const columnDdl = (column: FrameSqlColumn): string =>
  `${q(column.column)} ${column.sqlType}${columnNullable(column) ? "" : " NOT NULL"}`

const dedupe = <A>(items: ReadonlyArray<A>): ReadonlyArray<A> =>
  Array.from(new Set(items))

const uniqueOrFail = (
  projectionId: string,
  values: ReadonlyArray<string>,
  label: string,
): Effect.Effect<void, FrameProjectionCompileError> => {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index)
  return duplicates.length === 0
    ? Effect.void
    : Effect.fail(
        new FrameProjectionCompileError({
          projectionId,
          message: `${label} contains duplicate values: ${dedupe(duplicates).join(", ")}`,
        }),
      )
}

const supportTables = (
  sourceFactTable: string,
  stateTable: string,
  ledgerTable: string,
): ReadonlyArray<ProjectionDdlStatement> => [
  {
    label: "create-source-fact-table",
    sql: `CREATE TABLE IF NOT EXISTS ${q(sourceFactTable)} (\n  "observed_at" TIMESTAMPTZ NOT NULL,\n  "entity_key" JSONB NOT NULL,\n  "stream_id" TEXT NOT NULL,\n  "offset" TEXT NOT NULL,\n  "schema_id" TEXT NOT NULL,\n  "metric_key" TEXT NOT NULL,\n  "value_double" DOUBLE PRECISION,\n  "value_bigint" BIGINT,\n  "value_text" TEXT,\n  "value_boolean" BOOLEAN,\n  "value_jsonb" JSONB,\n  "payload" JSONB NOT NULL,\n  "quality" TEXT,\n  "ingested_at" TIMESTAMPTZ NOT NULL DEFAULT now(),\n  PRIMARY KEY ("observed_at", "stream_id", "offset")\n);`,
  },
  {
    label: "hypertable-source-facts",
    sql: `SELECT create_hypertable(${lit(sourceFactTable)}, 'observed_at', if_not_exists => TRUE);`,
  },
  {
    label: "index-source-facts-stream-offset",
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS ${q(`${sourceFactTable}_stream_offset_uidx`)} ON ${q(sourceFactTable)} ("stream_id", "offset");`,
  },
  {
    label: "index-source-facts-entity-time",
    sql: `CREATE INDEX IF NOT EXISTS ${q(`${sourceFactTable}_entity_time_idx`)} ON ${q(sourceFactTable)} USING GIN ("entity_key");`,
  },
  {
    label: "create-frame-state-table",
    sql: `CREATE TABLE IF NOT EXISTS ${q(stateTable)} (\n  "projection_id" TEXT NOT NULL,\n  "frame_id" TEXT NOT NULL,\n  "frame_time" TIMESTAMPTZ NOT NULL,\n  "deadline_at" TIMESTAMPTZ NOT NULL,\n  "parts" JSONB NOT NULL,\n  "provenance" JSONB NOT NULL,\n  "complete" BOOLEAN NOT NULL DEFAULT false,\n  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),\n  PRIMARY KEY ("projection_id", "frame_id")\n);`,
  },
  {
    label: "index-frame-state-deadline",
    sql: `CREATE INDEX IF NOT EXISTS ${q(`${stateTable}_deadline_idx`)} ON ${q(stateTable)} ("deadline_at") WHERE "complete" = false;`,
  },
  {
    label: "create-frame-ledger-table",
    sql: `CREATE TABLE IF NOT EXISTS ${q(ledgerTable)} (\n  "projection_id" TEXT NOT NULL,\n  "frame_id" TEXT NOT NULL,\n  "part_key" TEXT NOT NULL,\n  "source_stream_id" TEXT NOT NULL,\n  "source_offset" TEXT NOT NULL,\n  "source_schema_id" TEXT NOT NULL,\n  "observed_at" TIMESTAMPTZ NOT NULL,\n  "recorded_at" TIMESTAMPTZ NOT NULL DEFAULT now(),\n  PRIMARY KEY ("projection_id", "source_stream_id", "source_offset")\n);`,
  },
  {
    label: "index-frame-ledger-frame",
    sql: `CREATE INDEX IF NOT EXISTS ${q(`${ledgerTable}_frame_idx`)} ON ${q(ledgerTable)} ("projection_id", "frame_id");`,
  },
]

const frameTable = (
  spec: FrameProjectionSpec,
  frameTableName: string,
): ProjectionDdlStatement => {
  const promotedColumns = spec.output.columns.map(columnDdl)
  const extraColumns = promotedColumns.length === 0
    ? ""
    : `\n  ${promotedColumns.join(",\n  ")},`
  return {
    label: "create-frame-table",
    sql: `CREATE TABLE IF NOT EXISTS ${q(frameTableName)} (\n  "frame_time" TIMESTAMPTZ NOT NULL,\n  "frame_id" TEXT NOT NULL,\n  "entity_key" JSONB NOT NULL,${extraColumns}\n  "complete" BOOLEAN NOT NULL,\n  "missing_parts" TEXT[] NOT NULL DEFAULT '{}',\n  "imputed_parts" TEXT[] NOT NULL DEFAULT '{}',\n  "payload" JSONB NOT NULL,\n  "provenance" JSONB NOT NULL,\n  "projection_id" TEXT NOT NULL,\n  "projection_version" TEXT NOT NULL,\n  "output_schema_id" TEXT NOT NULL,\n  "frame_revision" INTEGER NOT NULL DEFAULT 1,\n  "emitted_at" TIMESTAMPTZ NOT NULL DEFAULT now(),\n  PRIMARY KEY ("frame_time", "frame_id")\n);`,
  }
}

const frameIndexes = (
  frameTableName: string,
  columns: ReadonlyArray<FrameSqlColumn>,
): ReadonlyArray<ProjectionDdlStatement> => {
  const keyColumns = columns.filter((column) => column.role === "key")
  return [
    ...keyColumns.map((column) => ({
      label: `index-frame-key-${column.column}`,
      sql: `CREATE INDEX IF NOT EXISTS ${q(`${frameTableName}_${column.column}_time_idx`)} ON ${q(frameTableName)} (${q(column.column)}, "frame_time" DESC);`,
    })),
    {
      label: "index-frame-complete-time",
      sql: `CREATE INDEX IF NOT EXISTS ${q(`${frameTableName}_complete_time_idx`)} ON ${q(frameTableName)} ("complete", "frame_time" DESC);`,
    },
    {
      label: "index-frame-projection-time",
      sql: `CREATE INDEX IF NOT EXISTS ${q(`${frameTableName}_projection_time_idx`)} ON ${q(frameTableName)} ("projection_id", "frame_time" DESC);`,
    },
  ]
}

const framePolicies = (
  spec: FrameProjectionSpec,
  frameTableName: string,
): ReadonlyArray<ProjectionDdlStatement> => {
  const timescale = spec.timescale
  if (timescale === undefined) return []
  const keyColumns = spec.output.columns
    .filter((column) => column.role === "key")
    .map((column) => column.column)
  const segmentBy = timescale.segmentBy ?? [...keyColumns, "projection_id"]
  const statements: ProjectionDdlStatement[] = []
  if (segmentBy.length > 0) {
    statements.push({
      label: "configure-frame-compression",
      sql: `ALTER TABLE ${q(frameTableName)} SET (\n  timescaledb.compress,\n  timescaledb.compress_segmentby = ${lit(segmentBy.join(", "))},\n  timescaledb.compress_orderby = 'frame_time DESC'\n);`,
    })
  }
  if (timescale.compressAfter !== undefined) {
    statements.push({
      label: "policy-frame-compression",
      sql: `SELECT add_compression_policy(${lit(frameTableName)}, INTERVAL ${lit(timescale.compressAfter)});`,
    })
  }
  if (timescale.retainFor !== undefined) {
    statements.push({
      label: "policy-frame-retention",
      sql: `SELECT add_retention_policy(${lit(frameTableName)}, INTERVAL ${lit(timescale.retainFor)});`,
    })
  }
  return statements
}

export const compileTimescaleProjection = (
  spec: FrameProjectionSpec,
): Effect.Effect<ProjectionPlan, FrameProjectionCompileError> =>
  Effect.gen(function* () {
    const frameTableName = yield* assertIdentifier(spec.id, spec.output.table, "output.table")
    const sourceFactTable = yield* assertIdentifier(
      spec.id,
      spec.timescale?.sourceFactTable ?? DEFAULT_SOURCE_FACT_TABLE,
      "timescale.sourceFactTable",
    )
    const stateTable = yield* assertIdentifier(
      spec.id,
      spec.timescale?.stateTable ?? DEFAULT_STATE_TABLE,
      "timescale.stateTable",
    )
    const ledgerTable = yield* assertIdentifier(
      spec.id,
      spec.timescale?.ledgerTable ?? DEFAULT_LEDGER_TABLE,
      "timescale.ledgerTable",
    )

    yield* uniqueOrFail(spec.id, spec.sources.map((source) => source.as), "sources.as")
    yield* uniqueOrFail(spec.id, spec.output.columns.map((column) => column.column), "output.columns")
    for (const column of spec.output.columns) {
      yield* assertIdentifier(spec.id, column.column, `output.columns.${column.column}`)
    }
    for (const interval of [
      spec.frame.timeBucket,
      spec.timescale?.compressAfter,
      spec.timescale?.retainFor,
    ]) {
      if (interval !== undefined) yield* assertInterval(spec.id, interval, "interval")
    }

    const includeSupportTables = spec.timescale?.includeSupportTables ?? true
    const statements: ProjectionDdlStatement[] = [
      ...(includeSupportTables ? supportTables(sourceFactTable, stateTable, ledgerTable) : []),
      frameTable(spec, frameTableName),
      {
        label: "hypertable-frame-table",
        sql: `SELECT create_hypertable(${lit(frameTableName)}, 'frame_time', if_not_exists => TRUE);`,
      },
      ...frameIndexes(frameTableName, spec.output.columns),
      ...framePolicies(spec, frameTableName),
    ]

    return ProjectionPlan.make({
      projectionId: spec.id,
      frameTable: frameTableName,
      sourceFactTable,
      stateTable,
      ledgerTable,
      statements,
    })
  })

/** Sync helper for tests, CLI previews, and migration generators. */
export const compileTimescaleProjectionUnsafe = (spec: FrameProjectionSpec): ProjectionPlan =>
  Effect.runSync(compileTimescaleProjection(spec))
