/**
 * Compound Questionnaire Schemas — DAG-based multi-survey orchestration.
 *
 * Defines the graph specification, routing strategies, execution state,
 * and persistence shapes for compound questionnaires (surveys of surveys).
 *
 * JSON-serializable — Graph hydration lives in ./graph.ts, NOT here.
 *
 * Key layout in bucket:
 *   compound-specs/{specId}/v{version}.json    — versioned compound spec snapshots
 *   compound-specs/{specId}/latest.json        — pointer to current version
 *   compound-runs/{specId}/{runId}.json        — individual run records
 *
 * @module questionnaire/compound/schemas
 */

import { Schema, Data } from 'effect'

// Re-export reference for JSDoc — raw accumulator values are RichAnswerEntry-compatible
// import type { RichAnswerEntry } from '../persistence/schemas.ts'

// =============================================================================
// Branded IDs — no stringly-typed soup
// =============================================================================

export const CompoundSpecId = Schema.String.pipe(
  Schema.brand('CompoundSpecId'),
  Schema.minLength(1),
)
export type CompoundSpecId = typeof CompoundSpecId.Type

export const CompoundRunId = Schema.String.pipe(
  Schema.brand('CompoundRunId'),
  Schema.minLength(1),
)
export type CompoundRunId = typeof CompoundRunId.Type

export const NodeId = Schema.String.pipe(
  Schema.brand('NodeId'),
  Schema.minLength(1),
)
export type NodeId = typeof NodeId.Type

// =============================================================================
// Routing Strategies — discriminated union for edge traversal decisions
// =============================================================================

/**
 * Static branch: maps answer values to next nodeIds.
 * Uses the same branching pattern as questionnaire question `next`.
 * `branchMap["*"]` is the default fallback.
 */
export const StaticBranch = Schema.TaggedStruct('StaticBranch', {
  branchMap: Schema.Record({ key: Schema.String, value: Schema.Array(Schema.String) }),
})
export type StaticBranch = typeof StaticBranch.Type

/**
 * Predicate guard: boolean expression evaluated against the accumulator.
 * Expression is a simple string (e.g., "scope == 'backend' && depth > 2").
 * Runtime evaluator interprets it — schema just stores the expression string.
 */
export const PredicateGuard = Schema.TaggedStruct('PredicateGuard', {
  expression: Schema.String,
  trueTargets: Schema.Array(Schema.String),
  falseTargets: Schema.Array(Schema.String),
})
export type PredicateGuard = typeof PredicateGuard.Type

/**
 * Dynamic hook route: microagent decides the next path at runtime.
 * Same pattern as DynamicNextHook from the base questionnaire schema.
 */
export const DynamicHookRoute = Schema.TaggedStruct('DynamicHookRoute', {
  hookId: Schema.String,
  toolName: Schema.String,
  metaPrompt: Schema.optional(Schema.String),
  model: Schema.optional(Schema.String),
  temperature: Schema.optional(Schema.Number),
  payload: Schema.optional(Schema.Unknown),
})
export type DynamicHookRoute = typeof DynamicHookRoute.Type

/**
 * Union of all routing strategies.
 * Discriminated on `_tag` for pattern matching.
 */
export const RoutingStrategy = Schema.Union(StaticBranch, PredicateGuard, DynamicHookRoute)
export type RoutingStrategy = typeof RoutingStrategy.Type

// =============================================================================
// CompoundNodeDef — a node in the compound graph spec (JSON-serializable)
// =============================================================================

export class CompoundNodeDef extends Schema.Class<CompoundNodeDef>('CompoundNodeDef')({
  /** Unique node ID within the compound spec */
  nodeId: NodeId,
  /** References an existing questionnaire spec ID */
  specId: Schema.String,
  /** Human-readable display label */
  label: Schema.optional(Schema.String),
  /** Question patches applied on top of the referenced spec */
  overrides: Schema.optional(Schema.Unknown),
  /** Template substitution parameters — { key: value } for string interpolation */
  parameters: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),
  /** Injected context from accumulator before the survey starts */
  preamble: Schema.optional(Schema.String),
}) {}

// =============================================================================
// CompoundEdgeDef — an edge in the compound graph
// =============================================================================

export class CompoundEdgeDef extends Schema.Class<CompoundEdgeDef>('CompoundEdgeDef')({
  /** Source node */
  from: NodeId,
  /** Target node */
  to: NodeId,
  /** How to decide if this edge is followed. If omitted, the edge is unconditional (always followed). */
  routing: Schema.optional(RoutingStrategy),
  /** Display label for the edge */
  label: Schema.optional(Schema.String),
}) {}

// =============================================================================
// CompoundSpec — THE graph definition (JSON-serializable)
// =============================================================================

export class CompoundSpec extends Schema.Class<CompoundSpec>('CompoundSpec')({
  /** Compound spec identifier */
  id: CompoundSpecId,
  /** Human-readable title */
  title: Schema.String,
  /** Optional description */
  description: Schema.optional(Schema.String),
  /** Monotonically increasing version */
  version: Schema.optionalWith(Schema.Number, { default: () => 1 }),
  /** All nodes in the compound graph */
  nodes: Schema.Array(CompoundNodeDef),
  /** All edges in the compound graph */
  edges: Schema.Array(CompoundEdgeDef),
  /** Entry point node IDs — can have multiple for parallel start */
  startNodeIds: Schema.Array(NodeId),
  /** Tags for categorization and query */
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
}) {
  /** Build a lookup map for O(1) node access by nodeId. */
  get nodeMap(): Map<string, CompoundNodeDef> {
    return new Map(this.nodes.map(n => [n.nodeId as string, n]))
  }
}

// =============================================================================
// NodeExecutionStatus — per-node lifecycle
// =============================================================================

export const NodeExecutionStatus = Schema.Literal('pending', 'running', 'completed', 'failed', 'skipped')
export type NodeExecutionStatus = typeof NodeExecutionStatus.Type

// =============================================================================
// AccumulatorSnapshot — accumulated context at a point in the execution
// =============================================================================

/**
 * Snapshot of accumulated answers at a point in the compound run.
 *
 * `raw` keys are formatted as `{nodeId}/{questionId}` strings.
 * Values are RichAnswerEntry-compatible objects stored as `Schema.Unknown`
 * for serialization flexibility. See `../persistence/schemas.ts` for
 * the RichAnswerEntry shape reference.
 */
export class AccumulatorSnapshot extends Schema.Class<AccumulatorSnapshot>('AccumulatorSnapshot')({
  /** Which node produced this snapshot (undefined for initial empty snapshot) */
  afterNodeId: Schema.optional(NodeId),
  /** Accumulated answers keyed by `{nodeId}/{questionId}` — values are RichAnswerEntry-compatible */
  raw: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { default: () => ({}) },
  ),
  /** LLM-generated summary of accumulated context */
  summary: Schema.optional(Schema.String),
  /** ISO-8601 timestamp of when this snapshot was captured */
  timestamp: Schema.String,
}) {}

// =============================================================================
// NodeExecution — per-node runtime state
// =============================================================================

export class NodeExecution extends Schema.Class<NodeExecution>('NodeExecution')({
  /** Which node this execution record belongs to */
  nodeId: NodeId,
  /** Current lifecycle status */
  status: NodeExecutionStatus,
  /** ISO-8601 start time */
  startedAt: Schema.optional(Schema.String),
  /** ISO-8601 completion time */
  completedAt: Schema.optional(Schema.String),
  /** Links to PersistedResult.resultId from the questionnaire persistence layer */
  resultId: Schema.optional(Schema.String),
  /** Error message if status is 'failed' */
  error: Schema.optional(Schema.String),
  /** Accumulator snapshot fed INTO this node */
  accumulatorBefore: Schema.optional(AccumulatorSnapshot),
  /** Accumulator snapshot AFTER this node completed */
  accumulatorAfter: Schema.optional(AccumulatorSnapshot),
}) {}

// =============================================================================
// CompoundRunStatus — top-level run lifecycle
// =============================================================================

export const CompoundRunStatus = Schema.Literal('pending', 'running', 'completed', 'failed', 'cancelled')
export type CompoundRunStatus = typeof CompoundRunStatus.Type

// =============================================================================
// CompoundRun — full runtime execution record
// =============================================================================

export class CompoundRun extends Schema.Class<CompoundRun>('CompoundRun')({
  /** Unique run identifier */
  runId: CompoundRunId,
  /** Which compound spec this run executes */
  specId: CompoundSpecId,
  /** Which version of the compound spec was used */
  specVersion: Schema.Number,
  /** Current lifecycle status */
  status: CompoundRunStatus,
  /** ISO-8601 start time */
  startedAt: Schema.String,
  /** ISO-8601 completion time */
  completedAt: Schema.optional(Schema.String),
  /** Execution log per node */
  nodeExecutions: Schema.Array(NodeExecution),
  /** Ordered list of completed nodes — the actual execution path taken */
  pathTaken: Schema.Array(NodeId),
  /** Final merged accumulator state after all nodes completed */
  finalAccumulator: Schema.optional(AccumulatorSnapshot),
  /** Tags for categorization and query */
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** Top-level error if run failed */
  error: Schema.optional(Schema.String),
  /** Graph.toMermaid output cached for debugging/visualization */
  mermaidDiagram: Schema.optional(Schema.String),
}) {}

// =============================================================================
// Key Generators — deterministic storage key paths
// =============================================================================

/** Generate the key for a versioned compound spec snapshot */
export const compoundSpecVersionKey = (specId: string, version: number): string =>
  `compound-specs/${specId}/v${version}.json`

/** Generate the key for a compound spec's latest pointer */
export const compoundSpecLatestKey = (specId: string): string =>
  `compound-specs/${specId}/latest.json`

/** Generate the key for a compound run record */
export const compoundRunKey = (specId: string, runId: string): string =>
  `compound-runs/${specId}/${runId}.json`

/** List prefix for all runs of a compound spec */
export const compoundRunListPrefix = (specId: string): string =>
  `compound-runs/${specId}/`

// =============================================================================
// PersistedCompoundSpec — versioned compound spec snapshot
// =============================================================================

export class PersistedCompoundSpec extends Schema.Class<PersistedCompoundSpec>('PersistedCompoundSpec')({
  /** The compound spec ID */
  specId: CompoundSpecId,
  /** Monotonically increasing version */
  version: Schema.Number,
  /** ISO-8601 timestamp of when this version was saved */
  savedAt: Schema.String,
  /** Tags for categorization and query */
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** The raw CompoundSpec as JSON-compatible object */
  spec: Schema.Unknown,
}) {}

// =============================================================================
// CompoundQueryFilter — topology-aware query for compound runs
// =============================================================================

export class CompoundQueryFilter extends Schema.Class<CompoundQueryFilter>('CompoundQueryFilter')({
  /** Filter by compound spec ID */
  specId: Schema.optional(Schema.String),
  /** Filter by run ID */
  runId: Schema.optional(Schema.String),
  /** Filter by date range (ISO-8601) */
  dateFrom: Schema.optional(Schema.String),
  dateTo: Schema.optional(Schema.String),
  /** Filter by tags (AND logic — all tags must match) */
  tags: Schema.optional(Schema.Array(Schema.String)),
  /** Filter by run status */
  status: Schema.optional(CompoundRunStatus),
  /** Run must have visited ALL of these nodeIds */
  pathContains: Schema.optional(Schema.Array(Schema.String)),
  /** Per-node answer filters — { nodeId: { questionId: answerValuePattern } } */
  nodeFilters: Schema.optional(
    Schema.Record({
      key: Schema.String,
      value: Schema.Record({ key: Schema.String, value: Schema.String }),
    }),
  ),
  /** Pagination: max results */
  limit: Schema.optionalWith(Schema.Number, { default: () => 50 }),
  /** Pagination: offset */
  offset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
}) {}

// =============================================================================
// Errors — TaggedError per project discipline
// =============================================================================

/** Compound spec structural or operational error */
export class CompoundSpecError extends Data.TaggedError('CompoundSpecError')<{
  readonly message: string
  readonly specId?: string
  readonly cause?: unknown
}> {}

/** Compound run execution error */
export class CompoundRunError extends Data.TaggedError('CompoundRunError')<{
  readonly message: string
  readonly runId?: string
  readonly specId?: string
  readonly cause?: unknown
}> {}

/** Compound spec validation error — graph integrity, missing nodes, cycles */
export class CompoundValidationError extends Data.TaggedError('CompoundValidationError')<{
  readonly message: string
  readonly specId?: string
  readonly issues: ReadonlyArray<string>
}> {}
