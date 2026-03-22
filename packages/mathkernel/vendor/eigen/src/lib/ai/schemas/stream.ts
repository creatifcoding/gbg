/**
 * AI Stream Schemas
 *
 * Effect Schema definitions for AI streaming events.
 */

import { Schema } from 'effect'

// =============================================================================
// Stream Status
// =============================================================================

export const StreamStatus = Schema.Literal('idle', 'streaming', 'complete', 'error', 'aborted')
export type StreamStatus = typeof StreamStatus.Type

// =============================================================================
// Stream Events
// =============================================================================

/**
 * Text delta event (streaming response text)
 */
export const TextDeltaEvent = Schema.TaggedStruct('TextDelta', {
  text: Schema.String,
})
export type TextDeltaEvent = typeof TextDeltaEvent.Type

/**
 * Reasoning delta event (extended thinking)
 */
export const ReasoningDeltaEvent = Schema.TaggedStruct('ReasoningDelta', {
  text: Schema.String,
})
export type ReasoningDeltaEvent = typeof ReasoningDeltaEvent.Type

/**
 * Reasoning start event
 */
export const ReasoningStartEvent = Schema.TaggedStruct('ReasoningStart', {})
export type ReasoningStartEvent = typeof ReasoningStartEvent.Type

/**
 * Reasoning end event
 */
export const ReasoningEndEvent = Schema.TaggedStruct('ReasoningEnd', {})
export type ReasoningEndEvent = typeof ReasoningEndEvent.Type

/**
 * Tool call event
 */
export const ToolCallEvent = Schema.TaggedStruct('ToolCall', {
  toolCallId: Schema.String,
  toolName: Schema.String,
  args: Schema.Unknown,
})
export type ToolCallEvent = typeof ToolCallEvent.Type

/**
 * Tool result event
 */
export const ToolResultEvent = Schema.TaggedStruct('ToolResult', {
  toolCallId: Schema.String,
  toolName: Schema.optional(Schema.String),
  result: Schema.Unknown,
  isError: Schema.optional(Schema.Boolean),
})
export type ToolResultEvent = typeof ToolResultEvent.Type

/**
 * Stream error event
 */
export const StreamErrorEvent = Schema.TaggedStruct('StreamError', {
  error: Schema.String,
  code: Schema.optional(Schema.String),
})
export type StreamErrorEvent = typeof StreamErrorEvent.Type

/**
 * Stream complete event
 */
export const StreamCompleteEvent = Schema.TaggedStruct('StreamComplete', {
  finishReason: Schema.optional(Schema.String),
  usage: Schema.optional(
    Schema.Struct({
      promptTokens: Schema.Number,
      completionTokens: Schema.Number,
      totalTokens: Schema.Number,
    })
  ),
})
export type StreamCompleteEvent = typeof StreamCompleteEvent.Type

/**
 * Union of all stream events
 */
export const AIStreamEvent = Schema.Union(
  TextDeltaEvent,
  ReasoningDeltaEvent,
  ReasoningStartEvent,
  ReasoningEndEvent,
  ToolCallEvent,
  ToolResultEvent,
  StreamErrorEvent,
  StreamCompleteEvent
)
export type AIStreamEvent = typeof AIStreamEvent.Type

// =============================================================================
// Stream Metadata
// =============================================================================

export const StreamMetadata = Schema.Struct({
  requestId: Schema.String,
  provider: Schema.String,
  modelId: Schema.String,
  startedAt: Schema.Number,
  completedAt: Schema.optional(Schema.Number),
})
export type StreamMetadata = typeof StreamMetadata.Type

// =============================================================================
// Accumulated State
// =============================================================================

export const StreamState = Schema.Struct({
  status: StreamStatus,
  text: Schema.String,
  thinkingText: Schema.String,
  toolCalls: Schema.Array(ToolCallEvent),
  toolResults: Schema.Array(ToolResultEvent),
  error: Schema.optional(Schema.String),
  metadata: Schema.optional(StreamMetadata),
})
export type StreamState = typeof StreamState.Type

/**
 * Initial stream state
 */
export const INITIAL_STREAM_STATE: StreamState = {
  status: 'idle',
  text: '',
  thinkingText: '',
  toolCalls: [],
  toolResults: [],
  error: undefined,
  metadata: undefined,
}
