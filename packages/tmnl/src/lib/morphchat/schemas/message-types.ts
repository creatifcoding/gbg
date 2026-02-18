/**
 * MorphChat Message & Connection Schemas
 *
 * Effect Schema definitions for the data flowing through adapters.
 * These are the canonical types that adapters produce and surfaces consume.
 *
 * @module morphchat/schemas/message-types
 */

import { Schema } from 'effect'

// =============================================================================
// Role
// =============================================================================

/**
 * Message author roles.
 *
 * - operator: Human user
 * - agent: AI/LLM agent
 * - system: System message (welcome, error, etc.)
 * - tool: Tool invocation result
 */
export const ChatRole = Schema.Literal('operator', 'agent', 'system', 'tool')
export type ChatRole = typeof ChatRole.Type

// =============================================================================
// Message Status
// =============================================================================

export const MessageStatus = Schema.Literal(
  'pending',    // Queued, not yet sent
  'sent',       // Sent to backend
  'streaming',  // Receiving streaming response
  'complete',   // Final
  'error',      // Send/receive failure
)
export type MessageStatus = typeof MessageStatus.Type

// =============================================================================
// Attachment
// =============================================================================

export const AttachmentKind = Schema.Literal(
  'file', 'image', 'code', 'reference', 'task-cluster',
)
export type AttachmentKind = typeof AttachmentKind.Type

export const ChatAttachment = Schema.Struct({
  id: Schema.String,
  kind: AttachmentKind,
  label: Schema.String,
  /** MIME type for file/image */
  mimeType: Schema.optional(Schema.String),
  /** URL or data URI */
  url: Schema.optional(Schema.String),
  /** Inline content (code blocks, references) */
  content: Schema.optional(Schema.String),
  /** Byte size for files */
  size: Schema.optional(Schema.Number),
})
export type ChatAttachment = typeof ChatAttachment.Type

// =============================================================================
// Chat Message
// =============================================================================

export const ChatMessage = Schema.Struct({
  /** Unique message ID */
  id: Schema.String,

  /** Author role */
  role: ChatRole,

  /** Display name of author */
  authorName: Schema.optional(Schema.String),

  /** Agent ID (when role === 'agent') */
  agentId: Schema.optional(Schema.String),

  /** Message text content (may contain markdown) */
  content: Schema.String,

  /** Timestamp (ISO 8601) */
  timestamp: Schema.String,

  /** Current message lifecycle status */
  status: MessageStatus,

  /** Attached files, references, task clusters */
  attachments: Schema.optional(Schema.Array(ChatAttachment)),

  /** Thinking level (0 = none, 1 = low, 2 = medium, 3 = high) */
  thinkingLevel: Schema.optional(Schema.Number),

  /** Parent message ID (for threaded replies) */
  parentId: Schema.optional(Schema.String),

  /** Inline task IDs associated with this message */
  taskIds: Schema.optional(Schema.Array(Schema.String)),

  /** Model identifier that produced this message */
  model: Schema.optional(Schema.String),

  /** Token usage stats */
  tokenUsage: Schema.optional(Schema.Struct({
    prompt: Schema.Number,
    completion: Schema.Number,
    total: Schema.Number,
  })),
})
export type ChatMessage = typeof ChatMessage.Type

// =============================================================================
// Connection State
// =============================================================================

export const ConnectionPhase = Schema.Literal(
  'disconnected',
  'connecting',
  'connected',
  'reconnecting',
  'error',
)
export type ConnectionPhase = typeof ConnectionPhase.Type

export const ConnectionState = Schema.Struct({
  phase: ConnectionPhase,
  /** Latency in ms (undefined when disconnected) */
  latencyMs: Schema.optional(Schema.Number),
  /** Error message (when phase === 'error') */
  error: Schema.optional(Schema.String),
  /** Reconnection attempt count */
  reconnectAttempt: Schema.optional(Schema.Number),
  /** Server endpoint label */
  endpoint: Schema.optional(Schema.String),
})
export type ConnectionState = typeof ConnectionState.Type

/** Default disconnected state */
export const DISCONNECTED: ConnectionState = {
  phase: 'disconnected',
}

/** Default connected state */
export const CONNECTED: ConnectionState = {
  phase: 'connected',
}

// =============================================================================
// Agent Info
// =============================================================================

export const AgentInfo = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  description: Schema.optional(Schema.String),
  /** Avatar URL or icon identifier */
  avatar: Schema.optional(Schema.String),
  /** Whether agent is currently active/available */
  isActive: Schema.Boolean,
  /** Capabilities/tags */
  capabilities: Schema.optional(Schema.Array(Schema.String)),
})
export type AgentInfo = typeof AgentInfo.Type

// =============================================================================
// Streaming State
// =============================================================================

export const StreamingState = Schema.Struct({
  /** Whether a response is currently streaming */
  isStreaming: Schema.Boolean,
  /** Partial content buffer for current stream */
  buffer: Schema.String,
  /** Message ID being streamed */
  messageId: Schema.optional(Schema.String),
  /** Token count so far */
  tokensReceived: Schema.optional(Schema.Number),
})
export type StreamingState = typeof StreamingState.Type

/** Default idle streaming state */
export const STREAMING_IDLE: StreamingState = {
  isStreaming: false,
  buffer: '',
}

// =============================================================================
// Send Params
// =============================================================================

export const SendParams = Schema.Struct({
  /** Message content */
  content: Schema.String,
  /** Target agent ID (if agent selector active) */
  agentId: Schema.optional(Schema.String),
  /** Attachments to include */
  attachments: Schema.optional(Schema.Array(ChatAttachment)),
  /** Context chip values */
  contextChips: Schema.optional(Schema.Array(Schema.Struct({
    type: Schema.Literal('hashtag', 'context', 'pending'),
    value: Schema.String,
  }))),
  /** Thinking level override */
  thinkingLevel: Schema.optional(Schema.Number),
  /** Parent message ID for threaded reply */
  parentId: Schema.optional(Schema.String),
})
export type SendParams = typeof SendParams.Type
