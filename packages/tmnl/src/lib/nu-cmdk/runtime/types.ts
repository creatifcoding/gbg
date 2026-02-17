import { Schema } from "effect"

export const QueryId = Schema.String.pipe(Schema.brand("QueryId"))
export const LaneId = Schema.String.pipe(Schema.brand("LaneId"))
export const RowId = Schema.String.pipe(Schema.brand("RowId"))

export const ScopeSchema = Schema.Literal("global", "editor", "grid", "tldraw", "modal")
export type Scope = typeof ScopeSchema.Type

export const ResultKind = Schema.Literal(
  "command",
  "entity",
  "action",
  "navigation",
  "docs",
  "terminal",
  "workflow",
  "agent",
  "history",
  "file",
  "generic",
)
export type ResultKind = typeof ResultKind.Type

export const QueryRowBadge = Schema.Struct({
  text: Schema.String,
  tone: Schema.optional(Schema.Literal("neutral", "warn", "success", "error", "info")),
})
export type QueryRowBadge = typeof QueryRowBadge.Type

export const QueryRow = Schema.Struct({
  rowId: RowId,
  laneId: LaneId,
  score: Schema.Number,
  category: ResultKind,
  rendererToken: Schema.String,
  resolverIdentity: Schema.String,
  providerId: Schema.optional(Schema.String),
  label: Schema.optional(Schema.String),
  description: Schema.optional(Schema.NullOr(Schema.String)),
  badges: Schema.optional(Schema.Array(QueryRowBadge)),
  shortcuts: Schema.optional(Schema.Array(Schema.String)),
  sectionKey: Schema.optional(Schema.String),
  sectionTitle: Schema.optional(Schema.String),
  sectionPriority: Schema.optional(Schema.Int),
})
export type QueryRow = typeof QueryRow.Type

export const LaneHealth = Schema.Literal("healthy", "degraded", "open_circuit", "closed")
export type LaneHealth = typeof LaneHealth.Type

export const LaneState = Schema.Struct({
  laneId: LaneId,
  lastSeq: Schema.Int,
  health: LaneHealth,
  publishBudget: Schema.Int,
  pending: Schema.Array(QueryRow),
  publishedCount: Schema.Int,
  fallbackRows: Schema.Int,
  decodeDrops: Schema.Int,
  resolverDenies: Schema.Int,
  lastUpdateMs: Schema.Int,
})
export type LaneState = typeof LaneState.Type

export const QuerySessionState = Schema.Struct({
  queryId: QueryId,
  queryText: Schema.String,
  scope: ScopeSchema,
  status: Schema.Literal("active", "cancelling", "complete", "failed"),
  lanes: Schema.Record({ key: Schema.String, value: LaneState }),
  rowsById: Schema.Record({ key: Schema.String, value: QueryRow }),
  rankedRowIds: Schema.Array(RowId),
  selectedRowId: Schema.NullOr(RowId),
  lastTopRowId: Schema.NullOr(RowId),
  lastTopChangedMs: Schema.Int,
  topStableEmitted: Schema.Boolean,
  oscillationCount: Schema.Int,
})
export type QuerySessionState = typeof QuerySessionState.Type

export const Theta = Schema.Struct({
  publish_budget_base: Schema.Int,
  publish_budget_degraded: Schema.Int,
  rank_weight: Schema.Struct({
    provider: Schema.Number,
    lexical: Schema.Number,
    semantic: Schema.Number,
    recency: Schema.Number,
  }),
  stability_epsilon: Schema.Number,
  stability_window_ms: Schema.Int,
  quality_budget: Schema.Struct({
    max_fallback_ratio: Schema.Number,
    max_decode_drop_ratio: Schema.Number,
    max_resolver_deny_ratio: Schema.Number,
  }),
  cacheguard: Schema.Struct({
    singleflight_ttl_ms: Schema.Int,
    checkpoint_wal_pages: Schema.Int,
  }),
})
export type Theta = typeof Theta.Type

export const IngestChunk = Schema.TaggedStruct("IngestChunk", {
  seq: Schema.Int,
  laneId: Schema.String,
  rows: Schema.Array(QueryRow),
  scenarioId: Schema.String,
})

export const PlannerTick = Schema.TaggedStruct("PlannerTick", {
  scenarioId: Schema.String,
})

export const CancelQuery = Schema.TaggedStruct("CancelQuery", {
  reason: Schema.String,
  scenarioId: Schema.String,
})

export const SimulateMigrationCrash = Schema.TaggedStruct("SimulateMigrationCrash", {
  scenarioId: Schema.String,
})

export const QuerySessionMessage = Schema.Union(
  IngestChunk,
  PlannerTick,
  CancelQuery,
  SimulateMigrationCrash,
)
export type QuerySessionMessage = typeof QuerySessionMessage.Type

export type EventRecord = {
  readonly event: string
  readonly run_id: string
  readonly query_id: string
  readonly scenario_id?: string
  readonly lane_id?: string
  readonly row_id?: string
  readonly t_ms: number
  readonly attrs: Record<string, unknown>
}

export const nowMs = () => Math.round(performance.timeOrigin + performance.now())

export const makeInitialSessionState = (params: {
  queryId: string
  queryText: string
  scope: Scope
}): QuerySessionState => ({
  queryId: params.queryId as QuerySessionState["queryId"],
  queryText: params.queryText,
  scope: params.scope,
  status: "active",
  lanes: {},
  rowsById: {},
  rankedRowIds: [],
  selectedRowId: null,
  lastTopRowId: null,
  lastTopChangedMs: nowMs(),
  topStableEmitted: false,
  oscillationCount: 0,
})
