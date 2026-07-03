import type { Effect } from 'effect'

import type {
  AgentOptions,
  WorkflowCallId,
  WorkflowDescriptor,
  WorkflowDigest,
  WorkflowJournalEntry,
  WorkflowMeta,
  WorkflowName,
  WorkflowRun,
  WorkflowRunId,
  WorkflowSource,
} from '../domain/schemas'
import type {
  WorkflowAdapterError,
  WorkflowCompileError,
  WorkflowContractError,
  WorkflowDiscoveryError,
  WorkflowError,
  WorkflowJournalError,
  WorkflowRuntimeError,
} from '../domain/errors'

export type WorkflowRequest = {
  readonly name?: string
  readonly script?: string
  readonly path?: string
  readonly input?: unknown
  readonly resume?: boolean
  readonly dryRun?: boolean
}

export type CompiledWorkflow = {
  readonly descriptor: WorkflowDescriptor
  readonly script: string
}

export type AgentRequest = {
  readonly runId: WorkflowRunId
  readonly callId: WorkflowCallId
  readonly key: string
  readonly prompt: string
  readonly phase?: string
  readonly options?: AgentOptions
}

export type AgentResponse = {
  readonly callId: WorkflowCallId
  readonly key: string
  readonly output: unknown
  readonly text: string
  readonly metadata?: Readonly<Record<string, unknown>>
}

export type WorkflowRunResult = {
  readonly run: WorkflowRun
  readonly descriptor: WorkflowDescriptor
  readonly result: unknown
  readonly dryRun: boolean
}

export type WorkflowRegistryShape = {
  readonly listSources: () => Effect.Effect<ReadonlyArray<WorkflowSource>, WorkflowDiscoveryError>
  readonly resolveSource: (
    request: WorkflowRequest,
  ) => Effect.Effect<WorkflowSource, WorkflowDiscoveryError | WorkflowContractError>
}

export type WorkflowCompilerShape = {
  readonly inspect: (
    source: WorkflowSource,
  ) => Effect.Effect<WorkflowDescriptor, WorkflowCompileError | WorkflowContractError>
  readonly compile: (
    source: WorkflowSource,
  ) => Effect.Effect<CompiledWorkflow, WorkflowCompileError | WorkflowContractError>
}

export type WorkflowJournalShape = {
  readonly append: (entry: WorkflowJournalEntry) => Effect.Effect<void, WorkflowJournalError>
  readonly entries: () => Effect.Effect<ReadonlyArray<WorkflowJournalEntry>, WorkflowJournalError>
  readonly entriesForRun: (runId: WorkflowRunId) => Effect.Effect<ReadonlyArray<WorkflowJournalEntry>, WorkflowJournalError>
}

export type WorkflowStoreShape = {
  readonly upsertRun: (run: WorkflowRun) => Effect.Effect<void, WorkflowRuntimeError>
  readonly getRun: (runId: WorkflowRunId) => Effect.Effect<WorkflowRun | undefined, WorkflowRuntimeError>
  readonly listRuns: () => Effect.Effect<ReadonlyArray<WorkflowRun>, WorkflowRuntimeError>
}

export type SubagentAdapterShape = {
  readonly runAgent: (request: AgentRequest) => Effect.Effect<AgentResponse, WorkflowAdapterError>
}

export type WorkflowRuntimeShape = {
  readonly run: (request: WorkflowRequest) => Effect.Effect<WorkflowRunResult, WorkflowError>
  readonly dryRun: (request: WorkflowRequest) => Effect.Effect<WorkflowDescriptor, WorkflowError>
}

export type WorkflowRuntimeClock = {
  readonly now: () => number
}

export type WorkflowRuntimeIdFactory = {
  readonly runId: () => WorkflowRunId
  readonly callId: () => WorkflowCallId
  readonly digest: (value: unknown) => WorkflowDigest
}

export type WorkflowCompilerMeta = {
  readonly meta: WorkflowMeta
  readonly script: string
}
