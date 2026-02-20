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
// Chat Message Parts — Structured content blocks within a message
// =============================================================================

/**
 * Text part — standard message content (may contain markdown).
 * The most common part type; a message with only text parts
 * behaves identically to the legacy flat `content` string.
 */
export const TextPart = Schema.TaggedStruct('text', {
  /** Text content, potentially markdown */
  content: Schema.String,
})
export type TextPart = typeof TextPart.Type

/**
 * Thinking/reasoning part — collapsible reasoning content.
 * Maps to harness `assistant_thinking_delta` events and
 * `provider_marker/thinking_*` markers.
 *
 * Mirrors AI Elements' ReasoningUIPart.
 */
export const ThinkingPart = Schema.TaggedStruct('thinking', {
  /** Accumulated thinking content */
  content: Schema.String,
  /** Whether thinking is still streaming */
  isStreaming: Schema.Boolean,
  /** Duration of thinking in milliseconds (set on completion) */
  durationMs: Schema.optional(Schema.Number),
})
export type ThinkingPart = typeof ThinkingPart.Type

/**
 * Tool invocation lifecycle states.
 *
 * Maps to AI Elements' ToolUIPart.state but using our domain vocabulary:
 *   AI Elements            → TMNL
 *   input-streaming        → pending
 *   input-available        → running
 *   approval-requested     → approval-required
 *   approval-responded     → approved
 *   output-available       → completed
 *   output-error           → error
 *   output-denied          → denied
 */
export const ToolInvocationState = Schema.Literal(
  'pending',            // Tool call started, input still streaming
  'running',            // Input complete, executing
  'approval-required',  // Awaiting user confirmation
  'approved',           // User approved, executing
  'completed',          // Output available
  'error',              // Error occurred
  'denied',             // User denied execution
)
export type ToolInvocationState = typeof ToolInvocationState.Type

/**
 * Tool invocation part — tool call with lifecycle state machine.
 * Maps to harness `tool_event` (start/update/end) events.
 *
 * Mirrors AI Elements' ToolUIPart.
 */
export const ToolInvocationPart = Schema.TaggedStruct('tool-invocation', {
  /** Unique tool call ID from the LLM/harness */
  toolCallId: Schema.String,
  /** Tool name (e.g., 'read_file', 'execute_command') */
  toolName: Schema.String,
  /** Current lifecycle state */
  state: ToolInvocationState,
  /** Input parameters (JSON-serializable) */
  input: Schema.optional(Schema.Unknown),
  /** Output result (JSON-serializable) */
  output: Schema.optional(Schema.Unknown),
  /** Error message when state === 'error' */
  errorText: Schema.optional(Schema.String),
})
export type ToolInvocationPart = typeof ToolInvocationPart.Type

/**
 * File attachment part — embedded file/image reference.
 * Maps to AI Elements' FileUIPart.
 */
export const FilePart = Schema.TaggedStruct('file', {
  /** URL or data URI */
  url: Schema.String,
  /** MIME type (e.g., 'image/png', 'application/pdf') */
  mediaType: Schema.String,
  /** Original filename */
  filename: Schema.optional(Schema.String),
  /** File size in bytes */
  size: Schema.optional(Schema.Number),
})
export type FilePart = typeof FilePart.Type

/**
 * Code block part — fenced code with optional language and filename.
 * Rendered by ChatCodeBlock with syntax highlighting (shiki).
 */
export const CodePart = Schema.TaggedStruct('code', {
  /** Source code content */
  code: Schema.String,
  /** Language identifier (e.g., 'typescript', 'python', 'json') */
  language: Schema.optional(Schema.String),
  /** Optional filename for display in header */
  filename: Schema.optional(Schema.String),
})
export type CodePart = typeof CodePart.Type

/**
 * Union of all message part types.
 *
 * Each part has a `_tag` discriminant for pattern matching:
 *   - 'text'            → TextPart
 *   - 'thinking'        → ThinkingPart
 *   - 'tool-invocation' → ToolInvocationPart
 *   - 'file'            → FilePart
 *   - 'code'            → CodePart
 *
 * Usage:
 *   message.parts.map(part => {
 *     switch (part._tag) {
 *       case 'text': return <TextBlock>{part.content}</TextBlock>
 *       case 'thinking': return <ThinkingBlock ...part />
 *       case 'tool-invocation': return <ToolBlock ...part />
 *       case 'file': return <FileBlock ...part />
 *       case 'code': return <CodeBlock ...part />
 *     }
 *   })
 */
export const ChatMessagePart = Schema.Union(
  TextPart,
  ThinkingPart,
  ToolInvocationPart,
  FilePart,
  CodePart,
)
export type ChatMessagePart = typeof ChatMessagePart.Type

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

  /**
   * Flat text content — backwards-compatible summary.
   *
   * When `parts` is populated, this is the concatenation of all TextPart
   * content. Consumers should prefer iterating `parts` for rich rendering
   * and fall back to `content` for plain-text contexts (notifications,
   * search indexing, clipboard copy).
   */
  content: Schema.String,

  /** Timestamp (ISO 8601) */
  timestamp: Schema.String,

  /** Current message lifecycle status */
  status: MessageStatus,

  /**
   * Structured content parts — the rich representation.
   *
   * Each element is a tagged union (`_tag` discriminant) that maps to
   * a purpose-built content block component. When empty/undefined,
   * falls back to rendering `content` as a single TextPart.
   *
   * Populated by adapters from structured event streams.
   */
  parts: Schema.optional(Schema.Array(ChatMessagePart)),

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

  /** Provider identifier (e.g. 'anthropic', 'openai') from provider_marker event */
  provider: Schema.optional(Schema.String),

  /** Token usage stats */
  tokenUsage: Schema.optional(Schema.Struct({
    prompt: Schema.Number,
    completion: Schema.Number,
    total: Schema.Number,
    /** Cache read tokens */
    cacheRead: Schema.optional(Schema.Number),
    /** Cache write tokens */
    cacheWrite: Schema.optional(Schema.Number),
    /** Cost in USD */
    cost: Schema.optional(Schema.Struct({
      input: Schema.Number,
      output: Schema.Number,
      cacheRead: Schema.Number,
      cacheWrite: Schema.Number,
      total: Schema.Number,
    })),
  })),
})
export type ChatMessage = typeof ChatMessage.Type

// =============================================================================
// Part Utilities
// =============================================================================

/**
 * Extract flat text content from message parts.
 * Concatenates all TextPart content values, ignoring thinking/tool/file parts.
 * Used for backwards-compatible `content` field derivation.
 */
export function flattenPartsToText(parts: ReadonlyArray<ChatMessagePart>): string {
  return parts
    .filter((p): p is TextPart => p._tag === 'text')
    .map((p) => p.content)
    .join('')
}

/**
 * Get effective parts from a ChatMessage.
 * If `parts` is populated, returns it.
 * Otherwise, wraps `content` in a single TextPart for uniform rendering.
 */
export function getMessageParts(message: ChatMessage): ReadonlyArray<ChatMessagePart> {
  if (message.parts && message.parts.length > 0) {
    return message.parts
  }
  // Backwards compat: wrap flat content as a single text part
  return [{ _tag: 'text' as const, content: message.content }]
}

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
