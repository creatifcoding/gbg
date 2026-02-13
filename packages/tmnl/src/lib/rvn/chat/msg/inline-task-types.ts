import { Schema } from 'effect'

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

export const AgentTaskMetadataSchema = Schema.Struct({
  phase: Schema.optional(AgentTaskPhaseSchema),
  owner: Schema.optional(Schema.String),
  deliverable: Schema.optional(Schema.String),
  note: Schema.optional(Schema.String),
})

export type AgentTaskMetadata = typeof AgentTaskMetadataSchema.Type

export const AgentTaskSchema = Schema.TaggedStruct('AgentTask', {
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
})

export type AgentTask = typeof AgentTaskSchema.Type

export const AgentTaskThreadTransferModeSchema = Schema.Literal('individuated', 'cluster')
export type AgentTaskThreadTransferMode = typeof AgentTaskThreadTransferModeSchema.Type

export const AgentTaskThreadClusterSchema = Schema.Struct({
  clusterId: Schema.String,
  label: Schema.String,
  taskIds: Schema.Array(Schema.String),
})

export type AgentTaskThreadCluster = typeof AgentTaskThreadClusterSchema.Type

export const AgentTaskThreadSchema = Schema.TaggedStruct('AgentTaskThread', {
  threadId: Schema.String,
  messageAnchorId: Schema.optional(Schema.String),
  sessionId: Schema.optional(Schema.String),
  items: Schema.Array(AgentTaskSchema),
  selectedTaskIds: Schema.Array(Schema.String),
  clusters: Schema.Array(AgentTaskThreadClusterSchema),
  transferModeDefault: AgentTaskThreadTransferModeSchema,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
})

export type AgentTaskThread = typeof AgentTaskThreadSchema.Type

// Backward compatibility exports for existing RVN surface names
export const RvnChatInlineTaskStatusSchema = AgentTaskStatusSchema
export type RvnChatInlineTaskStatus = AgentTaskStatus

export const RvnChatInlineTaskPhaseSchema = AgentTaskPhaseSchema
export type RvnChatInlineTaskPhase = AgentTaskPhase

export const RvnChatInlineTaskMetadataSchema = AgentTaskMetadataSchema
export type RvnChatInlineTaskMetadata = AgentTaskMetadata

export const RvnChatInlineTaskItemSchema = AgentTaskSchema
export type RvnChatInlineTaskItem = AgentTask
