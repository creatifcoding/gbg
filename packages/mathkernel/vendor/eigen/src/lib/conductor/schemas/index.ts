/**
 * Conductor Schemas
 *
 * Domain types for agent orchestration.
 * Schema-backed for runtime validation, JSON generation, and LLM interop.
 */

import { Schema, Data } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Agent Identity
// ─────────────────────────────────────────────────────────────────────────────

export const AgentRole = Schema.Literal(
  'scout',       // Fast recon, read-only
  'analyzer',    // Deep analysis, pattern detection
  'planner',     // Architecture, strategy
  'implementer', // Code changes, file mutations
  'reviewer',    // Code review, validation
  'conductor',   // Meta — orchestrates other agents
)
export type AgentRole = typeof AgentRole.Type

export const AwarenessLevel = Schema.Literal(
  'blind',       // No context — just a prompt
  'briefed',     // Gets a summary of the workflow
  'contextual',  // Gets relevant file contents + prior answers
  'full',        // Gets everything: workflow state, all prior agent outputs
)
export type AwarenessLevel = typeof AwarenessLevel.Type

export const AgentStatus = Schema.Literal(
  'spawning',
  'idle',
  'working',
  'waiting',     // Waiting for user input (questionnaire)
  'complete',
  'failed',
  'terminated',
)
export type AgentStatus = typeof AgentStatus.Type

// ─────────────────────────────────────────────────────────────────────────────
// Inline task thread contracts (session-scoped + message anchored)
// ─────────────────────────────────────────────────────────────────────────────

export const InlineTaskStatus = Schema.Literal(
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
  'cancelled',
  'blocked',
)
export type InlineTaskStatus = typeof InlineTaskStatus.Type

const InlineHarnessTaskEventShared = {
  threadId: Schema.String,
  messageAnchorId: Schema.optional(Schema.String),
  taskId: Schema.String,
  title: Schema.String,
  status: InlineTaskStatus,
  progress: Schema.NullOr(Schema.Number),
  seq: Schema.Number,
  at: Schema.String,
  message: Schema.optional(Schema.String),
} as const

export const InlineHarnessTaskThreadStarted = Schema.TaggedStruct(
  'InlineHarnessTaskThreadStarted',
  InlineHarnessTaskEventShared,
)
export type InlineHarnessTaskThreadStarted = typeof InlineHarnessTaskThreadStarted.Type

export const InlineHarnessTaskUpserted = Schema.TaggedStruct(
  'InlineHarnessTaskUpserted',
  InlineHarnessTaskEventShared,
)
export type InlineHarnessTaskUpserted = typeof InlineHarnessTaskUpserted.Type

export const InlineHarnessTaskStatusChanged = Schema.TaggedStruct(
  'InlineHarnessTaskStatusChanged',
  {
    ...InlineHarnessTaskEventShared,
    previousStatus: Schema.optional(InlineTaskStatus),
  },
)
export type InlineHarnessTaskStatusChanged = typeof InlineHarnessTaskStatusChanged.Type

export const InlineHarnessTaskProgressChanged = Schema.TaggedStruct(
  'InlineHarnessTaskProgressChanged',
  InlineHarnessTaskEventShared,
)
export type InlineHarnessTaskProgressChanged = typeof InlineHarnessTaskProgressChanged.Type

export const InlineHarnessTaskLogAppended = Schema.TaggedStruct(
  'InlineHarnessTaskLogAppended',
  InlineHarnessTaskEventShared,
)
export type InlineHarnessTaskLogAppended = typeof InlineHarnessTaskLogAppended.Type

export const InlineHarnessTaskCompleted = Schema.TaggedStruct(
  'InlineHarnessTaskCompleted',
  {
    ...InlineHarnessTaskEventShared,
    status: Schema.Literal('completed'),
  },
)
export type InlineHarnessTaskCompleted = typeof InlineHarnessTaskCompleted.Type

export const InlineHarnessTaskFailed = Schema.TaggedStruct(
  'InlineHarnessTaskFailed',
  {
    ...InlineHarnessTaskEventShared,
    status: Schema.Literal('failed'),
  },
)
export type InlineHarnessTaskFailed = typeof InlineHarnessTaskFailed.Type

export const InlineHarnessTaskThreadCompleted = Schema.TaggedStruct(
  'InlineHarnessTaskThreadCompleted',
  {
    ...InlineHarnessTaskEventShared,
    status: Schema.Literal('completed', 'failed', 'cancelled'),
  },
)
export type InlineHarnessTaskThreadCompleted = typeof InlineHarnessTaskThreadCompleted.Type

export const InlineHarnessTaskEvent = Schema.Union(
  InlineHarnessTaskThreadStarted,
  InlineHarnessTaskUpserted,
  InlineHarnessTaskStatusChanged,
  InlineHarnessTaskProgressChanged,
  InlineHarnessTaskLogAppended,
  InlineHarnessTaskCompleted,
  InlineHarnessTaskFailed,
  InlineHarnessTaskThreadCompleted,
)
export type InlineHarnessTaskEvent = typeof InlineHarnessTaskEvent.Type

export class AgentSpec extends Schema.Class<AgentSpec>('AgentSpec')({
  id: Schema.String,
  name: Schema.String,
  role: AgentRole,
  awareness: Schema.optionalWith(AwarenessLevel, { default: () => 'briefed' as const }),
  provider: Schema.optionalWith(Schema.String, { default: () => 'anthropic' }),
  model: Schema.optionalWith(Schema.String, { default: () => 'claude-sonnet-4-20250514' }),
  cwd: Schema.optional(Schema.String),
  skills: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  systemPrompt: Schema.optional(Schema.String),
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Agent Instance (runtime state)
// ─────────────────────────────────────────────────────────────────────────────

export class AgentInstance extends Schema.Class<AgentInstance>('AgentInstance')({
  spec: AgentSpec,
  sessionId: Schema.String,
  status: AgentStatus,
  spawnedAt: Schema.String,
  output: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  lastActivity: Schema.optional(Schema.String),
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Steps
// ─────────────────────────────────────────────────────────────────────────────

export const StepType = Schema.Literal(
  'agent',          // Spawn an agent, send it a prompt
  'questionnaire',  // Present a questionnaire to the user
  'gate',           // Branch based on prior answers/outputs
  'parallel',       // Run multiple steps concurrently
  'sequence',       // Run steps sequentially
)
export type StepType = typeof StepType.Type

/** Reference to output from a prior step */
export class StepRef extends Schema.Class<StepRef>('StepRef')({
  stepId: Schema.String,
  field: Schema.optionalWith(Schema.String, { default: () => 'output' }),
}) {}

export class AgentStep extends Schema.Class<AgentStep>('AgentStep')({
  _type: Schema.optionalWith(Schema.Literal('agent'), { default: () => 'agent' as const }),
  id: Schema.String,
  agent: AgentSpec,
  prompt: Schema.String,
  /** Inject prior step outputs into prompt via {{stepId.field}} */
  injectFrom: Schema.optionalWith(Schema.Array(StepRef), { default: () => [] }),
  /** Timeout in seconds */
  timeout: Schema.optionalWith(Schema.Number, { default: () => 120 }),
}) {}

export class QuestionnaireStep extends Schema.Class<QuestionnaireStep>('QuestionnaireStep')({
  _type: Schema.optionalWith(Schema.Literal('questionnaire'), { default: () => 'questionnaire' as const }),
  id: Schema.String,
  /** Inline questionnaire spec (same schema as questionnaire extension) */
  spec: Schema.Unknown,
}) {}

export class GateStep extends Schema.Class<GateStep>('GateStep')({
  _type: Schema.optionalWith(Schema.Literal('gate'), { default: () => 'gate' as const }),
  id: Schema.String,
  /** Step ID whose output we branch on */
  sourceStep: Schema.String,
  /** Field to match (default: first answer value) */
  matchField: Schema.optionalWith(Schema.String, { default: () => 'value' }),
  /** Map of match value → next step ID. "*" = default. */
  branches: Schema.Record({ key: Schema.String, value: Schema.String }),
}) {}

export class ParallelStep extends Schema.Class<ParallelStep>('ParallelStep')({
  _type: Schema.optionalWith(Schema.Literal('parallel'), { default: () => 'parallel' as const }),
  id: Schema.String,
  stepIds: Schema.Array(Schema.String),
  maxConcurrency: Schema.optionalWith(Schema.Number, { default: () => 4 }),
}) {}

export class SequenceStep extends Schema.Class<SequenceStep>('SequenceStep')({
  _type: Schema.optionalWith(Schema.Literal('sequence'), { default: () => 'sequence' as const }),
  id: Schema.String,
  stepIds: Schema.Array(Schema.String),
}) {}

export const WorkflowStep = Schema.Union(
  AgentStep,
  QuestionnaireStep,
  GateStep,
  ParallelStep,
  SequenceStep,
)
export type WorkflowStep = typeof WorkflowStep.Type

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Definition
// ─────────────────────────────────────────────────────────────────────────────

export class Workflow extends Schema.Class<Workflow>('Workflow')({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  steps: Schema.Array(WorkflowStep),
  startStepId: Schema.String,
}) {
  get stepMap(): Map<string, WorkflowStep> {
    return new Map(this.steps.map(s => [s.id, s]))
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Execution State
// ─────────────────────────────────────────────────────────────────────────────

export class StepResult extends Schema.Class<StepResult>('StepResult')({
  stepId: Schema.String,
  status: Schema.Literal('pending', 'running', 'complete', 'failed', 'skipped'),
  output: Schema.optional(Schema.Unknown),
  error: Schema.optional(Schema.String),
  startedAt: Schema.optional(Schema.String),
  completedAt: Schema.optional(Schema.String),
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

export class ConductorError extends Data.TaggedError('ConductorError')<{
  readonly reason: 'SpawnFailed' | 'Timeout' | 'AgentFailed' | 'WorkflowInvalid' | 'StepNotFound'
  readonly message: string
  readonly stepId?: string
  readonly cause?: unknown
}> {}
