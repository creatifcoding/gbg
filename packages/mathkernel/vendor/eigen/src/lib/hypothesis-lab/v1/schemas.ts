import { Schema } from 'effect';

// -----------------------------------------------------------------------------
// Scalar / Enum Schemas
// -----------------------------------------------------------------------------

export const RunStatus = Schema.Literal(
  'idle',
  'draft',
  'validating',
  'ratification_pending',
  'finalized',
  'failed'
);
export type RunStatus = typeof RunStatus.Type;

export const HypothesisLabel = Schema.Literal('A', 'B');
export type HypothesisLabel = typeof HypothesisLabel.Type;

export const StageMode = Schema.Literal('sequential', 'parallel-safe');
export type StageMode = typeof StageMode.Type;

export const HookOnErrorPolicy = Schema.Literal('halt', 'continue', 'quarantine');
export type HookOnErrorPolicy = typeof HookOnErrorPolicy.Type;

export const ReplayStatus = Schema.Literal('passed', 'passed_with_warnings', 'failed');
export type ReplayStatus = typeof ReplayStatus.Type;

export const DriftCategory = Schema.Literal(
  'strict_mismatch',
  'strict_missing_event',
  'tolerant_drift_numeric',
  'tolerant_drift_temporal',
  'schema_drift',
  'config_drift'
);
export type DriftCategory = typeof DriftCategory.Type;

export const EisenhowerQuadrant = Schema.Literal(
  'Do',
  'Schedule',
  'Delegate',
  'Eliminate'
);
export type EisenhowerQuadrant = typeof EisenhowerQuadrant.Type;

export const Winner = Schema.Literal('A', 'B', 'Tie');
export type Winner = typeof Winner.Type;

export const TrustGate = Schema.Literal(
  'required_rationale',
  'required_citations',
  'required_provenance',
  'model_prompt_pinning',
  'dual_run_consistency',
  'human_signoff'
);
export type TrustGate = typeof TrustGate.Type;

export const TrustGateStatus = Schema.Literal('passed', 'failed', 'pending');
export type TrustGateStatus = typeof TrustGateStatus.Type;

export const RatificationPhase = Schema.Literal(
  'phase1_pending',
  'phase1_acknowledged',
  'phase2_final'
);
export type RatificationPhase = typeof RatificationPhase.Type;

// -----------------------------------------------------------------------------
// Core Runtime Data
// -----------------------------------------------------------------------------

export const HypothesisRun = Schema.TaggedStruct('HypothesisRun', {
  id: Schema.String,
  status: RunStatus,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  createdBy: Schema.String,
  context: Schema.String,
});
export type HypothesisRun = typeof HypothesisRun.Type;

export const Hypothesis = Schema.TaggedStruct('Hypothesis', {
  id: Schema.String,
  runId: Schema.String,
  label: HypothesisLabel,
  statement: Schema.NonEmptyString,
  assumptions: Schema.Array(Schema.String),
  createdAt: Schema.Number,
  createdBy: Schema.String,
});
export type Hypothesis = typeof Hypothesis.Type;

export const HookStepPolicy = Schema.Struct({
  timeoutMs: Schema.Number,
  retries: Schema.Number,
  onError: HookOnErrorPolicy,
});
export type HookStepPolicy = typeof HookStepPolicy.Type;

export const HookStepSpec = Schema.TaggedStruct('HookStepSpec', {
  stepId: Schema.String,
  hookKey: Schema.String,
  hookVersion: Schema.String,
  inputSchemaRef: Schema.String,
  outputSchemaRef: Schema.String,
  policy: HookStepPolicy,
  mergePolicy: Schema.optional(Schema.String),
});
export type HookStepSpec = typeof HookStepSpec.Type;

export const HookGroupSpec = Schema.TaggedStruct('HookGroupSpec', {
  groupId: Schema.String,
  mode: Schema.Literal('parallel-safe'),
  mergeContractRef: Schema.String,
  steps: Schema.Array(HookStepSpec),
});
export type HookGroupSpec = typeof HookGroupSpec.Type;

export const HookStageEntry = Schema.Union(HookStepSpec, HookGroupSpec);
export type HookStageEntry = typeof HookStageEntry.Type;

export const HookStageSpec = Schema.Struct({
  name: Schema.String,
  mode: StageMode,
  sequence: Schema.Number,
  entries: Schema.Array(HookStageEntry),
});
export type HookStageSpec = typeof HookStageSpec.Type;

export const HookEventSpec = Schema.Struct({
  eventName: Schema.String,
  steps: Schema.Array(HookStepSpec),
});
export type HookEventSpec = typeof HookEventSpec.Type;

export const ResolverSnapshotEntry = Schema.Struct({
  hookKey: Schema.String,
  resolvedTo: Schema.String,
  resolvedVersion: Schema.String,
});
export type ResolverSnapshotEntry = typeof ResolverSnapshotEntry.Type;

export const HookPlanIntegrity = Schema.Struct({
  contentHash: Schema.String,
});
export type HookPlanIntegrity = typeof HookPlanIntegrity.Type;

export const HookPlanCompiled = Schema.Struct({
  planId: Schema.String,
  schemaVersion: Schema.String,
  builderVersion: Schema.String,
  createdAt: Schema.String,
  stages: Schema.Array(HookStageSpec),
  events: Schema.Array(HookEventSpec),
  resolverSnapshot: Schema.Array(ResolverSnapshotEntry),
  integrity: HookPlanIntegrity,
});
export type HookPlanCompiled = typeof HookPlanCompiled.Type;

export const EvidenceRecord = Schema.TaggedStruct('EvidenceRecord', {
  id: Schema.String,
  runId: Schema.String,
  source: Schema.String,
  summary: Schema.String,
  confidence: Schema.Number,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  createdAt: Schema.Number,
});
export type EvidenceRecord = typeof EvidenceRecord.Type;

export const CriterionProvenance = Schema.Struct({
  modelPin: Schema.String,
  promptPin: Schema.String,
  evidenceRefs: Schema.Array(Schema.String),
});
export type CriterionProvenance = typeof CriterionProvenance.Type;

export const MatrixCriterion = Schema.Struct({
  criterion: Schema.String,
  weight: Schema.Number,
  scoreA: Schema.Number,
  scoreB: Schema.Number,
  rationale: Schema.String,
  citations: Schema.Array(Schema.String),
  provenance: CriterionProvenance,
});
export type MatrixCriterion = typeof MatrixCriterion.Type;

export const AdaptiveWeightPolicySnapshot = Schema.Struct({
  policyId: Schema.String,
  clarityWeight: Schema.Number,
  evidenceWeight: Schema.Number,
});
export type AdaptiveWeightPolicySnapshot = typeof AdaptiveWeightPolicySnapshot.Type;

export const DecisionMatrix = Schema.TaggedStruct('DecisionMatrix', {
  id: Schema.String,
  runId: Schema.String,
  criteria: Schema.Array(MatrixCriterion),
  aggregateA: Schema.Number,
  aggregateB: Schema.Number,
  aggregateWinner: Winner,
  eisenhowerA: EisenhowerQuadrant,
  eisenhowerB: EisenhowerQuadrant,
  eisenhowerWinner: Winner,
  hasConflict: Schema.Boolean,
  adaptiveWeightPolicy: AdaptiveWeightPolicySnapshot,
  createdAt: Schema.Number,
});
export type DecisionMatrix = typeof DecisionMatrix.Type;

export const Verdict = Schema.TaggedStruct('Verdict', {
  id: Schema.String,
  runId: Schema.String,
  winner: Winner,
  aggregateWinner: Winner,
  eisenhowerWinner: Winner,
  hasConflict: Schema.Boolean,
  conflictAcknowledged: Schema.Boolean,
  rationale: Schema.String,
  ratified: Schema.Boolean,
  ratifiedBy: Schema.NullOr(Schema.String),
  ratificationPhase: RatificationPhase,
  createdAt: Schema.Number,
  finalizedAt: Schema.NullOr(Schema.Number),
});
export type Verdict = typeof Verdict.Type;

export const DriftRecord = Schema.Struct({
  category: DriftCategory,
  eventType: Schema.String,
  eventSequence: Schema.Number,
  path: Schema.String,
  expected: Schema.Unknown,
  actual: Schema.Unknown,
  toleranceApplied: Schema.NullOr(Schema.String),
});
export type DriftRecord = typeof DriftRecord.Type;

export const ReplayReport = Schema.TaggedStruct('ReplayReport', {
  replayId: Schema.String,
  runId: Schema.String,
  status: ReplayStatus,
  strictDriftCount: Schema.Number,
  tolerantDriftCount: Schema.Number,
  drifts: Schema.Array(DriftRecord),
  generatedAt: Schema.Number,
});
export type ReplayReport = typeof ReplayReport.Type;

// -----------------------------------------------------------------------------
// Audit Events
// -----------------------------------------------------------------------------

export const RunCreated = Schema.TaggedStruct('RunCreated', {
  runId: Schema.String,
  actor: Schema.String,
  timestamp: Schema.Number,
});
export type RunCreated = typeof RunCreated.Type;

export const HypothesisSeeded = Schema.TaggedStruct('HypothesisSeeded', {
  runId: Schema.String,
  hypothesisId: Schema.String,
  label: HypothesisLabel,
  actor: Schema.String,
  timestamp: Schema.Number,
});
export type HypothesisSeeded = typeof HypothesisSeeded.Type;

export const HookPlanCompiledEvent = Schema.TaggedStruct('HookPlanCompiledEvent', {
  runId: Schema.String,
  planId: Schema.String,
  actor: Schema.String,
  timestamp: Schema.Number,
});
export type HookPlanCompiledEvent = typeof HookPlanCompiledEvent.Type;

export const HookInvoked = Schema.TaggedStruct('HookInvoked', {
  runId: Schema.String,
  stage: Schema.String,
  stepId: Schema.String,
  hookKey: Schema.String,
  outcome: Schema.Literal('success', 'failure', 'quarantined'),
  timestamp: Schema.Number,
});
export type HookInvoked = typeof HookInvoked.Type;

export const MatrixDrafted = Schema.TaggedStruct('MatrixDrafted', {
  runId: Schema.String,
  matrixId: Schema.String,
  timestamp: Schema.Number,
});
export type MatrixDrafted = typeof MatrixDrafted.Type;

export const TrustGateEvaluated = Schema.TaggedStruct('TrustGateEvaluated', {
  runId: Schema.String,
  gate: TrustGate,
  status: TrustGateStatus,
  detail: Schema.String,
  actor: Schema.NullOr(Schema.String),
  timestamp: Schema.Number,
});
export type TrustGateEvaluated = typeof TrustGateEvaluated.Type;

export const RatificationPhaseAdvanced = Schema.TaggedStruct('RatificationPhaseAdvanced', {
  runId: Schema.String,
  verdictId: Schema.String,
  actor: Schema.String,
  phase: RatificationPhase,
  conflictAcknowledged: Schema.Boolean,
  timestamp: Schema.Number,
});
export type RatificationPhaseAdvanced = typeof RatificationPhaseAdvanced.Type;

export const VerdictRatified = Schema.TaggedStruct('VerdictRatified', {
  runId: Schema.String,
  verdictId: Schema.String,
  actor: Schema.String,
  timestamp: Schema.Number,
});
export type VerdictRatified = typeof VerdictRatified.Type;

export const ReplayEvaluated = Schema.TaggedStruct('ReplayEvaluated', {
  runId: Schema.String,
  replayId: Schema.String,
  status: ReplayStatus,
  timestamp: Schema.Number,
});
export type ReplayEvaluated = typeof ReplayEvaluated.Type;

export const AuditEvent = Schema.Union(
  RunCreated,
  HypothesisSeeded,
  HookPlanCompiledEvent,
  HookInvoked,
  MatrixDrafted,
  TrustGateEvaluated,
  RatificationPhaseAdvanced,
  VerdictRatified,
  ReplayEvaluated
);
export type AuditEvent = typeof AuditEvent.Type;

// -----------------------------------------------------------------------------
// Vertical Slice Input Schemas
// -----------------------------------------------------------------------------

export const CreateRunInput = Schema.Struct({
  actor: Schema.String,
  context: Schema.String,
  hypothesisAStatement: Schema.NonEmptyString,
  hypothesisAAssumptions: Schema.Array(Schema.String),
  hypothesisBStatement: Schema.NonEmptyString,
  hypothesisBAssumptions: Schema.Array(Schema.String),
});
export type CreateRunInput = typeof CreateRunInput.Type;

export const RatifyVerdictInput = Schema.Struct({
  actor: Schema.String,
  rationale: Schema.NonEmptyString,
  acknowledgeConflict: Schema.optional(Schema.Boolean),
  dualRunConsistent: Schema.optional(Schema.Boolean),
  humanSignoff: Schema.optional(Schema.Boolean),
});
export type RatifyVerdictInput = typeof RatifyVerdictInput.Type;
