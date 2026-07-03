import * as Schema from 'effect/Schema'

import { WorkflowCallId, WorkflowDigest, WorkflowName, WorkflowRunId } from './schemas'

export class WorkflowContractError extends Schema.TaggedErrorClass<WorkflowContractError>(
  '@tmnl/pi-workflows/WorkflowContractError',
)('Workflow/Contract', {
  message: Schema.String,
  field: Schema.optionalKey(Schema.String),
  cause: Schema.optionalKey(Schema.Unknown),
}) {}

export class WorkflowDiscoveryError extends Schema.TaggedErrorClass<WorkflowDiscoveryError>(
  '@tmnl/pi-workflows/WorkflowDiscoveryError',
)('Workflow/Discovery', {
  message: Schema.String,
  path: Schema.optionalKey(Schema.String),
  cause: Schema.optionalKey(Schema.Unknown),
}) {}

export class WorkflowCompileError extends Schema.TaggedErrorClass<WorkflowCompileError>(
  '@tmnl/pi-workflows/WorkflowCompileError',
)('Workflow/Compile', {
  message: Schema.String,
  workflowName: Schema.optionalKey(WorkflowName),
  cause: Schema.optionalKey(Schema.Unknown),
}) {}

export class WorkflowRuntimeError extends Schema.TaggedErrorClass<WorkflowRuntimeError>(
  '@tmnl/pi-workflows/WorkflowRuntimeError',
)('Workflow/Runtime', {
  message: Schema.String,
  runId: Schema.optionalKey(WorkflowRunId),
  phase: Schema.optionalKey(Schema.String),
  cause: Schema.optionalKey(Schema.Unknown),
}) {}

export class WorkflowAdapterError extends Schema.TaggedErrorClass<WorkflowAdapterError>(
  '@tmnl/pi-workflows/WorkflowAdapterError',
)('Workflow/Adapter', {
  message: Schema.String,
  runId: Schema.optionalKey(WorkflowRunId),
  callId: Schema.optionalKey(WorkflowCallId),
  cause: Schema.optionalKey(Schema.Unknown),
}) {}

export class WorkflowJournalError extends Schema.TaggedErrorClass<WorkflowJournalError>(
  '@tmnl/pi-workflows/WorkflowJournalError',
)('Workflow/Journal', {
  message: Schema.String,
  runId: Schema.optionalKey(WorkflowRunId),
  cause: Schema.optionalKey(Schema.Unknown),
}) {}

export class ResumeDivergenceError extends Schema.TaggedErrorClass<ResumeDivergenceError>(
  '@tmnl/pi-workflows/ResumeDivergenceError',
)('Workflow/ResumeDivergence', {
  message: Schema.String,
  runId: WorkflowRunId,
  workflowName: WorkflowName,
  expectedDigest: WorkflowDigest,
  actualDigest: WorkflowDigest,
}) {}

export type WorkflowError =
  | WorkflowContractError
  | WorkflowDiscoveryError
  | WorkflowCompileError
  | WorkflowRuntimeError
  | WorkflowAdapterError
  | WorkflowJournalError
  | ResumeDivergenceError
