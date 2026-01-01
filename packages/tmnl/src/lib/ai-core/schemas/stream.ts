/**
 * AI Core Stream Event Schemas
 *
 * Typed stream events using Effect Schema TaggedStruct pattern.
 * Events are discriminated by _tag for exhaustive pattern matching.
 *
 * Event categories:
 * - Content: TextDelta, ThinkingDelta
 * - Tool: ToolCallStart, ToolCallDelta, ToolCallComplete, ToolResult
 * - Lifecycle: StreamStart, StreamComplete, StreamError
 */

import { Schema } from 'effect'

// =============================================================================
// Content Events
// =============================================================================

/**
 * Text content delta from streaming response
 */
export class TextDelta extends Schema.TaggedClass<TextDelta>()('TextDelta', {
  text: Schema.String,
  /** Accumulated text so far (optional, for convenience) */
  accumulated: Schema.NullOr(Schema.String),
}) {}

/**
 * Extended thinking content delta (Claude extended thinking)
 */
export class ThinkingDelta extends Schema.TaggedClass<ThinkingDelta>()('ThinkingDelta', {
  thinking: Schema.String,
  /** Accumulated thinking so far */
  accumulated: Schema.NullOr(Schema.String),
}) {}

// =============================================================================
// Tool Events
// =============================================================================

/**
 * Tool call initiated - contains tool name and call ID
 */
export class ToolCallStart extends Schema.TaggedClass<ToolCallStart>()('ToolCallStart', {
  toolCallId: Schema.String,
  toolName: Schema.String,
  /** MCP server that owns this tool */
  serverId: Schema.NullOr(Schema.String),
}) {}

/**
 * Tool call arguments streaming (partial JSON)
 */
export class ToolCallDelta extends Schema.TaggedClass<ToolCallDelta>()('ToolCallDelta', {
  toolCallId: Schema.String,
  /** Partial arguments JSON string */
  argsDelta: Schema.String,
}) {}

/**
 * Tool call finished - full arguments available
 */
export class ToolCallComplete extends Schema.TaggedClass<ToolCallComplete>()('ToolCallComplete', {
  toolCallId: Schema.String,
  toolName: Schema.String,
  /** Complete parsed arguments */
  args: Schema.Unknown,
  /** MCP server that owns this tool */
  serverId: Schema.NullOr(Schema.String),
}) {}

/**
 * Tool execution result received
 */
export class ToolResult extends Schema.TaggedClass<ToolResult>()('ToolResult', {
  toolCallId: Schema.String,
  toolName: Schema.String,
  /** Result content (can be text, JSON, or structured) */
  result: Schema.Unknown,
  /** Whether execution succeeded */
  isError: Schema.Boolean,
  /** Error message if isError is true */
  errorMessage: Schema.NullOr(Schema.String),
}) {}

// =============================================================================
// Lifecycle Events
// =============================================================================

/**
 * Stream started - contains request metadata
 */
export class StreamStart extends Schema.TaggedClass<StreamStart>()('StreamStart', {
  requestId: Schema.String,
  modelId: Schema.String,
  /** Provider name (anthropic, openai, claude-code) */
  provider: Schema.String,
  /** Timestamp when stream started */
  startedAt: Schema.Number,
}) {}

/**
 * Finish reason for stream completion
 */
export const FinishReason = Schema.Literal(
  'stop',
  'length',
  'tool_calls',
  'content_filter',
  'aborted',
  'error',
  'unknown'
)
export type FinishReason = typeof FinishReason.Type

/**
 * Token usage statistics
 */
export class TokenUsage extends Schema.Class<TokenUsage>('TokenUsage')({
  promptTokens: Schema.Number,
  completionTokens: Schema.Number,
  totalTokens: Schema.Number,
  /** Cache read tokens (Anthropic) */
  cacheReadTokens: Schema.NullOr(Schema.Number),
  /** Cache creation tokens (Anthropic) */
  cacheCreationTokens: Schema.NullOr(Schema.Number),
}) {}

/**
 * Stream completed successfully
 */
export class StreamComplete extends Schema.TaggedClass<StreamComplete>()('StreamComplete', {
  finishReason: FinishReason,
  /** Token usage (if available) */
  usage: Schema.NullOr(TokenUsage),
  /** Duration in milliseconds */
  durationMs: Schema.NullOr(Schema.Number),
}) {}

/**
 * Stream error (non-recoverable)
 */
export class StreamError extends Schema.TaggedClass<StreamError>()('StreamError', {
  error: Schema.String,
  /** Whether retry might succeed */
  retryable: Schema.Boolean,
  /** Original error details */
  cause: Schema.NullOr(Schema.Unknown),
}) {}

// =============================================================================
// Event Union
// =============================================================================

/**
 * Union of all stream events for exhaustive handling
 */
export const AIStreamEvent = Schema.Union(
  // Content
  TextDelta,
  ThinkingDelta,
  // Tool
  ToolCallStart,
  ToolCallDelta,
  ToolCallComplete,
  ToolResult,
  // Lifecycle
  StreamStart,
  StreamComplete,
  StreamError
)
export type AIStreamEvent = typeof AIStreamEvent.Type

// =============================================================================
// Stream State
// =============================================================================

/**
 * Stream status for UI state management
 */
export const StreamStatus = Schema.Literal('idle', 'connecting', 'streaming', 'complete', 'error')
export type StreamStatus = typeof StreamStatus.Type

/**
 * Aggregated stream state for consumers
 */
export class StreamState extends Schema.Class<StreamState>('StreamState')({
  /** Current stream status */
  status: StreamStatus,
  /** Accumulated text content */
  text: Schema.String,
  /** Accumulated thinking content */
  thinking: Schema.NullOr(Schema.String),
  /** Active tool calls (in progress) */
  pendingToolCalls: Schema.Array(ToolCallStart),
  /** Completed tool calls with results */
  completedToolCalls: Schema.Array(
    Schema.Struct({
      call: ToolCallComplete,
      result: Schema.NullOr(ToolResult),
    })
  ),
  /** Last error if status is 'error' */
  error: Schema.NullOr(Schema.String),
  /** Token usage (populated on completion) */
  usage: Schema.NullOr(TokenUsage),
  /** Stream metadata */
  metadata: Schema.NullOr(
    Schema.Struct({
      requestId: Schema.String,
      modelId: Schema.String,
      provider: Schema.String,
      startedAt: Schema.Number,
      completedAt: Schema.NullOr(Schema.Number),
    })
  ),
}) {
  /**
   * Initial empty stream state
   */
  static readonly Initial: StreamState = new StreamState({
    status: 'idle',
    text: '',
    thinking: undefined,
    pendingToolCalls: [],
    completedToolCalls: [],
    error: undefined,
    usage: undefined,
    metadata: undefined,
  })

  /**
   * Check if stream is active
   */
  get isActive(): boolean {
    return this.status === 'connecting' || this.status === 'streaming'
  }

  /**
   * Check if stream has tool calls
   */
  get hasToolCalls(): boolean {
    return this.pendingToolCalls.length > 0 || this.completedToolCalls.length > 0
  }
}

// =============================================================================
// Event Utilities
// =============================================================================

/**
 * Check if event is a content event
 */
export const isContentEvent = (event: AIStreamEvent): event is TextDelta | ThinkingDelta =>
  event._tag === 'TextDelta' || event._tag === 'ThinkingDelta'

/**
 * Check if event is a tool event
 */
export const isToolEvent = (
  event: AIStreamEvent
): event is ToolCallStart | ToolCallDelta | ToolCallComplete | ToolResult =>
  event._tag === 'ToolCallStart' ||
  event._tag === 'ToolCallDelta' ||
  event._tag === 'ToolCallComplete' ||
  event._tag === 'ToolResult'

/**
 * Check if event is a lifecycle event
 */
export const isLifecycleEvent = (
  event: AIStreamEvent
): event is StreamStart | StreamComplete | StreamError =>
  event._tag === 'StreamStart' || event._tag === 'StreamComplete' || event._tag === 'StreamError'

/**
 * Check if event indicates stream end
 */
export const isTerminalEvent = (event: AIStreamEvent): event is StreamComplete | StreamError =>
  event._tag === 'StreamComplete' || event._tag === 'StreamError'
