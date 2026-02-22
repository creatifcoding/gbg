/**
 * Compound Questionnaire — DAG-based multi-survey orchestration.
 *
 * @module questionnaire/compound
 */

export {
  // Branded IDs
  CompoundSpecId,
  CompoundRunId,
  NodeId,

  // Routing strategies
  StaticBranch,
  PredicateGuard,
  DynamicHookRoute,
  RoutingStrategy,

  // Graph definition schemas
  CompoundNodeDef,
  CompoundEdgeDef,
  CompoundSpec,

  // Execution status enums
  NodeExecutionStatus,
  CompoundRunStatus,

  // Runtime state schemas
  AccumulatorSnapshot,
  NodeExecution,
  CompoundRun,

  // Persistence schemas
  PersistedCompoundSpec,
  CompoundQueryFilter,

  // Key generators
  compoundSpecVersionKey,
  compoundSpecLatestKey,
  compoundRunKey,
  compoundRunListPrefix,

  // Errors
  CompoundSpecError,
  CompoundRunError,
  CompoundValidationError,
} from './schemas.ts'

// Re-export types
export type {
  CompoundSpecId as CompoundSpecIdType,
  CompoundRunId as CompoundRunIdType,
  NodeId as NodeIdType,
  StaticBranch as StaticBranchType,
  PredicateGuard as PredicateGuardType,
  DynamicHookRoute as DynamicHookRouteType,
  RoutingStrategy as RoutingStrategyType,
  NodeExecutionStatus as NodeExecutionStatusType,
  CompoundRunStatus as CompoundRunStatusType,
} from './schemas.ts'

export {
  // Graph hydration + validation (separate from JSON-serializable schemas)
  hydrateGraph,
  validateGraph,
  buildNodeIndexMap,
  getTopologicalOrder,
  toMermaid,
} from './graph.ts'

export type {
  CompoundGraph,
} from './graph.ts'

// ─── Phase 2: DAG Scheduler Services ─────────────────────────────────────────

export { AccumulatorService, AccumulatorServiceLive } from './AccumulatorService.ts'
export type { AccumulatorServiceShape } from './AccumulatorService.ts'

export { RoutingEngine, RoutingEngineLive } from './RoutingEngine.ts'
export type { RoutingEngineShape } from './RoutingEngine.ts'

export { DAGScheduler, DAGSchedulerLive } from './DAGScheduler.ts'
export type { DAGSchedulerShape } from './DAGScheduler.ts'

// ─── Phase 3: Compound Persistence + Store ───────────────────────────────────

export { CompoundStore, CompoundStoreLive } from './CompoundStore.ts'
export type { CompoundStoreShape } from './CompoundStore.ts'

export { CompoundQueryEngine, CompoundQueryEngineLive } from './CompoundQueryEngine.ts'
export type { CompoundQueryEngineShape, CompoundRunDiff, NodeAggregation, SemanticSearchResult } from './CompoundQueryEngine.ts'
