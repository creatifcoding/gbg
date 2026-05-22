/**
 * FrameProjectionSpec — declarative contract for coherent multi-source frames.
 *
 * Source LNK streams stay pure: one typed message per stream. A frame
 * projection describes how those source facts become an explicit operational
 * read model: a frame stream and/or a Timescale hypertable.
 *
 * @module @tmnl/pct/frames/FrameProjectionSpec
 */

import * as Schema from "effect-v4/Schema"

// ─── SQL / Timescale target vocabulary ─────────────────────────────────────

export const SqlColumnType = Schema.Literals([
  "text",
  "integer",
  "bigint",
  "double precision",
  "boolean",
  "timestamptz",
  "jsonb",
  "text[]",
])
export type SqlColumnType = typeof SqlColumnType.Type

export const FrameMaterializationMode = Schema.Literals([
  "wide",
  "jsonb",
  "hybrid-wide",
])
export type FrameMaterializationMode = typeof FrameMaterializationMode.Type

export const FrameTimeoutPolicy = Schema.Literals([
  "emit-partial",
  "drop-partial",
  "dead-letter",
])
export type FrameTimeoutPolicy = typeof FrameTimeoutPolicy.Type

export const FrameColumnRole = Schema.Literals([
  "key",
  "value",
  "metadata",
])
export type FrameColumnRole = typeof FrameColumnRole.Type

export const FrameSqlColumn = Schema.Struct({
  /** SQL column name in the materialized frame table. */
  column: Schema.String,
  /** SQL type for the promoted column. */
  sqlType: SqlColumnType,
  /** Path inside the assembled frame payload. */
  path: Schema.Array(Schema.String),
  /** Whether the column may be null. Defaults in compiler: key=false, otherwise=true. */
  nullable: Schema.optional(Schema.Boolean),
  /** Query/semantic role for index and compression planning. */
  role: Schema.optional(FrameColumnRole),
})
export type FrameSqlColumn = typeof FrameSqlColumn.Type

// ─── Source bindings ───────────────────────────────────────────────────────

export const FrameSourceBinding = Schema.Struct({
  /** Pure source stream id, e.g. `vitals.heart_rate`. */
  streamId: Schema.String,
  /** PCT schema id expected on that source stream. */
  schemaId: Schema.String,
  /** Stable part key inside the frame, e.g. `heartRate`. */
  as: Schema.String,
  /** Field path used as observation time. */
  timeField: Schema.Array(Schema.String),
  /** Field paths that form the entity key. */
  keyFields: Schema.Array(Schema.Array(Schema.String)),
})
export type FrameSourceBinding = typeof FrameSourceBinding.Type

export const FrameAssemblySpec = Schema.Struct({
  /** Timescale/Postgres interval literal, e.g. `5 seconds`. */
  timeBucket: Schema.String,
  /** Required part keys for a complete frame. */
  required: Schema.Array(Schema.String),
  /** How long to wait for late parts before timeout policy fires. */
  allowedLatenessMs: Schema.Int,
  /** What to do if the deadline arrives before all required parts. */
  onTimeout: FrameTimeoutPolicy,
})
export type FrameAssemblySpec = typeof FrameAssemblySpec.Type

export const FrameTimescaleSpec = Schema.Struct({
  /** Whether to emit source fact/state/ledger support DDL. Defaults true in compiler. */
  includeSupportTables: Schema.optional(Schema.Boolean),
  /** Shared medium-layout source fact hypertable. */
  sourceFactTable: Schema.optional(Schema.String),
  /** Shared active assembly state table. */
  stateTable: Schema.optional(Schema.String),
  /** Shared idempotency/provenance ledger table. */
  ledgerTable: Schema.optional(Schema.String),
  /** Compression policy for the materialized frame table, e.g. `7 days`. */
  compressAfter: Schema.optional(Schema.String),
  /** Retention policy for the materialized frame table, e.g. `180 days`. */
  retainFor: Schema.optional(Schema.String),
  /** Columns used as Timescale compression segmentby. Defaults to key columns + projection_id. */
  segmentBy: Schema.optional(Schema.Array(Schema.String)),
})
export type FrameTimescaleSpec = typeof FrameTimescaleSpec.Type

export const FrameOutputSpec = Schema.Struct({
  /** Large materialized frame hypertable name. */
  table: Schema.String,
  /** Output frame schema id. */
  schemaId: Schema.String,
  /** Optional projected LNK frame stream. */
  streamId: Schema.optional(Schema.String),
  /** SQL materialization strategy. */
  mode: FrameMaterializationMode,
  /** Promoted SQL columns. Full frame payload is still retained for hybrid/jsonb. */
  columns: Schema.Array(FrameSqlColumn),
})
export type FrameOutputSpec = typeof FrameOutputSpec.Type

export const FrameProjectionSpec = Schema.Struct({
  /** Stable projection id, e.g. `vitals.snapshot@1.0.0`. */
  id: Schema.String,
  /** Human description for registry/docs. */
  description: Schema.optional(Schema.String),
  sources: Schema.Array(FrameSourceBinding),
  frame: FrameAssemblySpec,
  output: FrameOutputSpec,
  timescale: Schema.optional(FrameTimescaleSpec),
})
export type FrameProjectionSpec = typeof FrameProjectionSpec.Type

// ─── Compiler output contract ──────────────────────────────────────────────

export const ProjectionDdlStatement = Schema.Struct({
  label: Schema.String,
  sql: Schema.String,
})
export type ProjectionDdlStatement = typeof ProjectionDdlStatement.Type

export const ProjectionPlan = Schema.Struct({
  projectionId: Schema.String,
  frameTable: Schema.String,
  sourceFactTable: Schema.String,
  stateTable: Schema.String,
  ledgerTable: Schema.String,
  statements: Schema.Array(ProjectionDdlStatement),
})
export type ProjectionPlan = typeof ProjectionPlan.Type
