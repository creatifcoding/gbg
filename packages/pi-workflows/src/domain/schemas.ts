import * as Schema from 'effect/Schema'

export const WorkflowRunId = Schema.String.pipe(Schema.brand('WorkflowRunId'))
export type WorkflowRunId = typeof WorkflowRunId.Type

export const WorkflowCallId = Schema.String.pipe(Schema.brand('WorkflowCallId'))
export type WorkflowCallId = typeof WorkflowCallId.Type

export const WorkflowName = Schema.String.check(Schema.isMinLength(1)).pipe(Schema.brand('WorkflowName'))
export type WorkflowName = typeof WorkflowName.Type

export const WorkflowDigest = Schema.String.check(Schema.isMinLength(1)).pipe(Schema.brand('WorkflowDigest'))
export type WorkflowDigest = typeof WorkflowDigest.Type

export const WorkflowPhaseName = Schema.String.check(Schema.isMinLength(1)).pipe(Schema.brand('WorkflowPhaseName'))
export type WorkflowPhaseName = typeof WorkflowPhaseName.Type

export const WorkflowSourceKind = Schema.Literals(['name', 'path', 'inline'] as const)
export type WorkflowSourceKind = typeof WorkflowSourceKind.Type

export const WorkflowRunStatus = Schema.Literals([
  'pending',
  'running',
  'succeeded',
  'failed',
  'cancelled',
] as const)
export type WorkflowRunStatus = typeof WorkflowRunStatus.Type

export const WorkflowCallStatus = Schema.Literals([
  'pending',
  'running',
  'succeeded',
  'failed',
  'replayed',
] as const)
export type WorkflowCallStatus = typeof WorkflowCallStatus.Type

export const WorkflowMeta = Schema.Struct({
  name: WorkflowName,
  description: Schema.String,
  phases: Schema.optionalKey(Schema.Array(WorkflowPhaseName)),
  maxConcurrency: Schema.optionalKey(Schema.Number),
  tags: Schema.optionalKey(Schema.Array(Schema.String)),
})
export type WorkflowMeta = typeof WorkflowMeta.Type

export const WorkflowSource = Schema.Struct({
  kind: WorkflowSourceKind,
  value: Schema.String,
  digest: Schema.optionalKey(WorkflowDigest),
})
export type WorkflowSource = typeof WorkflowSource.Type

export const WorkflowDescriptor = Schema.Struct({
  meta: WorkflowMeta,
  source: WorkflowSource,
  discoveredAt: Schema.Number,
})
export type WorkflowDescriptor = typeof WorkflowDescriptor.Type

export const AgentOutputMode = Schema.Literals(['text', 'json'] as const)
export type AgentOutputMode = typeof AgentOutputMode.Type

export const AgentOptions = Schema.Struct({
  label: Schema.optionalKey(Schema.String),
  agent: Schema.optionalKey(Schema.String),
  model: Schema.optionalKey(Schema.String),
  output: Schema.optionalKey(AgentOutputMode),
  schema: Schema.optionalKey(Schema.Unknown),
  reads: Schema.optionalKey(Schema.Union([Schema.Array(Schema.String), Schema.Literal(false)])),
  progress: Schema.optionalKey(Schema.Boolean),
  timeoutMs: Schema.optionalKey(Schema.Number),
})
export type AgentOptions = typeof AgentOptions.Type

export const WorkflowCall = Schema.Struct({
  id: WorkflowCallId,
  key: Schema.String,
  phase: Schema.optionalKey(WorkflowPhaseName),
  prompt: Schema.String,
  options: Schema.optionalKey(AgentOptions),
  status: WorkflowCallStatus,
  startedAt: Schema.Number,
  completedAt: Schema.optionalKey(Schema.Number),
  result: Schema.optionalKey(Schema.Unknown),
  error: Schema.optionalKey(Schema.String),
})
export type WorkflowCall = typeof WorkflowCall.Type

export const WorkflowRun = Schema.Struct({
  id: WorkflowRunId,
  workflowName: WorkflowName,
  source: WorkflowSource,
  inputDigest: WorkflowDigest,
  status: WorkflowRunStatus,
  phase: Schema.optionalKey(WorkflowPhaseName),
  startedAt: Schema.Number,
  completedAt: Schema.optionalKey(Schema.Number),
  calls: Schema.Array(WorkflowCall),
  result: Schema.optionalKey(Schema.Unknown),
  error: Schema.optionalKey(Schema.String),
})
export type WorkflowRun = typeof WorkflowRun.Type

export const RunStarted = Schema.TaggedStruct('RunStarted', {
  runId: WorkflowRunId,
  workflowName: WorkflowName,
  source: WorkflowSource,
  inputDigest: WorkflowDigest,
  at: Schema.Number,
})

export const PhaseStarted = Schema.TaggedStruct('PhaseStarted', {
  runId: WorkflowRunId,
  phase: WorkflowPhaseName,
  at: Schema.Number,
})

export const LogRecorded = Schema.TaggedStruct('LogRecorded', {
  runId: WorkflowRunId,
  message: Schema.String,
  details: Schema.optionalKey(Schema.Unknown),
  at: Schema.Number,
})

export const AgentCallStarted = Schema.TaggedStruct('AgentCallStarted', {
  runId: WorkflowRunId,
  callId: WorkflowCallId,
  key: Schema.String,
  phase: Schema.optionalKey(WorkflowPhaseName),
  prompt: Schema.String,
  options: Schema.optionalKey(AgentOptions),
  at: Schema.Number,
})

export const AgentCallSucceeded = Schema.TaggedStruct('AgentCallSucceeded', {
  runId: WorkflowRunId,
  callId: WorkflowCallId,
  key: Schema.String,
  result: Schema.Unknown,
  replayed: Schema.optionalKey(Schema.Boolean),
  at: Schema.Number,
})

export const AgentCallFailed = Schema.TaggedStruct('AgentCallFailed', {
  runId: WorkflowRunId,
  callId: WorkflowCallId,
  key: Schema.String,
  error: Schema.String,
  at: Schema.Number,
})

export const ParallelStarted = Schema.TaggedStruct('ParallelStarted', {
  runId: WorkflowRunId,
  label: Schema.optionalKey(Schema.String),
  count: Schema.Number,
  at: Schema.Number,
})

export const ParallelCompleted = Schema.TaggedStruct('ParallelCompleted', {
  runId: WorkflowRunId,
  label: Schema.optionalKey(Schema.String),
  count: Schema.Number,
  failures: Schema.Number,
  at: Schema.Number,
})

export const PipelineStarted = Schema.TaggedStruct('PipelineStarted', {
  runId: WorkflowRunId,
  label: Schema.optionalKey(Schema.String),
  itemCount: Schema.Number,
  stageCount: Schema.Number,
  at: Schema.Number,
})

export const PipelineCompleted = Schema.TaggedStruct('PipelineCompleted', {
  runId: WorkflowRunId,
  label: Schema.optionalKey(Schema.String),
  itemCount: Schema.Number,
  failures: Schema.Number,
  at: Schema.Number,
})

export const RunSucceeded = Schema.TaggedStruct('RunSucceeded', {
  runId: WorkflowRunId,
  result: Schema.Unknown,
  at: Schema.Number,
})

export const RunFailed = Schema.TaggedStruct('RunFailed', {
  runId: WorkflowRunId,
  error: Schema.String,
  at: Schema.Number,
})

export const RunCancelled = Schema.TaggedStruct('RunCancelled', {
  runId: WorkflowRunId,
  reason: Schema.optionalKey(Schema.String),
  at: Schema.Number,
})

export const WorkflowJournalEntry = Schema.Union([
  RunStarted,
  PhaseStarted,
  LogRecorded,
  AgentCallStarted,
  AgentCallSucceeded,
  AgentCallFailed,
  ParallelStarted,
  ParallelCompleted,
  PipelineStarted,
  PipelineCompleted,
  RunSucceeded,
  RunFailed,
  RunCancelled,
])
export type WorkflowJournalEntry = typeof WorkflowJournalEntry.Type
export type WorkflowJournalEntryTag = WorkflowJournalEntry['_tag']
