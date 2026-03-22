import { Schema } from 'effect'

// ---------------------------------------------------------------------------
// Literal unions
// ---------------------------------------------------------------------------

export const AgentTaskStatusSchema = Schema.Literal(
  'queued',
  'claimed',
  'running',
  'paused',
  'blocked',
  'failed',
  'cancelled',
  'completed',
)

export type AgentTaskStatus = typeof AgentTaskStatusSchema.Type

export const AgentTaskAssignmentModeSchema = Schema.Literal(
  'self-select',
  'dispatcher-assigned',
  'policy-assigned',
  'handoff',
)

export type AgentTaskAssignmentMode = typeof AgentTaskAssignmentModeSchema.Type

export const AgentTaskPhaseSchema = Schema.Literal(
  'brief',
  'schema',
  'layout',
  'interaction',
  'qa',
)

export type AgentTaskPhase = typeof AgentTaskPhaseSchema.Type

// ---------------------------------------------------------------------------
// Metadata struct (nested, not tagged)
// ---------------------------------------------------------------------------

export const AgentTaskMetadataSchema = Schema.Struct({
  phase: Schema.optional(AgentTaskPhaseSchema),
  owner: Schema.optional(Schema.String),
  deliverable: Schema.optional(Schema.String),
  note: Schema.optional(Schema.String),
})

export type AgentTaskMetadata = typeof AgentTaskMetadataSchema.Type

// ---------------------------------------------------------------------------
// AgentTask — TaggedClass (constructable via `new AgentTask({...})`)
// ---------------------------------------------------------------------------

const AgentTaskFields = {
  taskId: Schema.String,
  title: Schema.String,
  status: AgentTaskStatusSchema,
  progress: Schema.optional(Schema.NullOr(Schema.Number)),
  message: Schema.optional(Schema.String),
  dependencies: Schema.Array(Schema.String),

  assignmentMode: Schema.optional(AgentTaskAssignmentModeSchema),
  assignedAgentId: Schema.optional(Schema.String),
  claimedBy: Schema.optional(Schema.String),

  sessionId: Schema.optional(Schema.String),
  nodeId: Schema.optional(Schema.String),
  toolCallId: Schema.optional(Schema.String),
  toolName: Schema.optional(Schema.String),
  lastSeq: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),

  metadata: Schema.optional(AgentTaskMetadataSchema),

  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}

export class AgentTask extends Schema.TaggedClass<AgentTask>()('AgentTask', AgentTaskFields) {}

/** Schema for AgentTask — use for AST introspection and codec derivation */
export const AgentTaskSchema = AgentTask

// ---------------------------------------------------------------------------
// Transfer mode + cluster
// ---------------------------------------------------------------------------

export const AgentTaskThreadTransferModeSchema = Schema.Literal('individuated', 'cluster')
export type AgentTaskThreadTransferMode = typeof AgentTaskThreadTransferModeSchema.Type

export const AgentTaskThreadClusterSchema = Schema.Struct({
  clusterId: Schema.String,
  label: Schema.String,
  taskIds: Schema.Array(Schema.String),
})

export type AgentTaskThreadCluster = typeof AgentTaskThreadClusterSchema.Type

// ---------------------------------------------------------------------------
// AgentTaskThread — TaggedClass
// ---------------------------------------------------------------------------

const AgentTaskThreadFields = {
  threadId: Schema.String,
  messageAnchorId: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
  items: Schema.Array(AgentTask),
  selectedTaskIds: Schema.Array(Schema.String),
  clusters: Schema.Array(AgentTaskThreadClusterSchema),
  transferModeDefault: AgentTaskThreadTransferModeSchema,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}

export class AgentTaskThread extends Schema.TaggedClass<AgentTaskThread>()('AgentTaskThread', AgentTaskThreadFields) {}

export const AgentTaskThreadSchema = AgentTaskThread

// ---------------------------------------------------------------------------
// Backward compat aliases (TMNL namespace)
// ---------------------------------------------------------------------------

export const ChatInlineTaskStatusSchema = AgentTaskStatusSchema
export type ChatInlineTaskStatus = AgentTaskStatus

export const ChatInlineTaskPhaseSchema = AgentTaskPhaseSchema
export type ChatInlineTaskPhase = AgentTaskPhase

export const ChatInlineTaskMetadataSchema = AgentTaskMetadataSchema
export type ChatInlineTaskMetadata = AgentTaskMetadata

export const ChatInlineTaskItemSchema = AgentTaskSchema
export type ChatInlineTaskItem = AgentTask
