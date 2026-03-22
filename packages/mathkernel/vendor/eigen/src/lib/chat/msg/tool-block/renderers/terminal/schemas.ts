/**
 * Tool Streaming Schemas — Effect Schema definitions for the streaming pipeline.
 *
 * ToolStreamLine: Individual chunk from server (seq-ordered, ANSI-safe)
 * ToolStreamState: Per-toolCallId accumulator (ledger + pendingChunk + phase)
 * ToolStreamChunk: Server→client chunk contract (mirrors ToolStreamChunkPayload)
 *
 * @module chat/msg/tool-block/renderers/terminal/schemas
 */

import { Schema } from 'effect'
import type { SortedMap } from 'effect'

// =============================================================================
// ToolStreamLine — single chunk from server
// =============================================================================

export const ToolStreamLine = Schema.TaggedStruct('ToolStreamLine', {
  /** Monotonic sequence number (server-assigned, per tool call) */
  seq: Schema.Number,
  /** Raw text chunk — may contain ANSI escape sequences */
  chunk: Schema.String,
  /** Stream origin */
  kind: Schema.Literal('stdout', 'stderr'),
  /** Client-side receive timestamp */
  receivedAt: Schema.Number,
})
export type ToolStreamLine = typeof ToolStreamLine.Type

// =============================================================================
// ToolStreamPhase — lifecycle state of a streaming tool
// =============================================================================

export const ToolStreamPhase = Schema.Literal('idle', 'streaming', 'complete', 'error')
export type ToolStreamPhase = typeof ToolStreamPhase.Type

// =============================================================================
// ToolStreamState — per-toolCallId accumulator
// =============================================================================

/**
 * Runtime-only state (not serialized). The `ledger` is a SortedMap<number, ToolStreamLine>
 * which doesn't serialize cleanly through Schema, so we define the interface directly
 * and use Schema for the serializable portions.
 */
export interface ToolStreamState {
  readonly toolCallId: string
  readonly toolName: string
  /** Ordered replay log: seq → ToolStreamLine. For replay on late-join/reconnect. */
  readonly ledger: SortedMap.SortedMap<number, ToolStreamLine>
  /** Latest chunk that needs to be term.write()'d into restty. Consumed after write. */
  readonly pendingChunk: string | null
  /** Cumulative bytes received */
  readonly totalBytes: number
  /** Timestamp of first chunk */
  readonly startedAt: number
  /** Timestamp of most recent chunk */
  readonly lastChunkAt: number
  /** Lifecycle phase */
  readonly phase: ToolStreamPhase
}

// =============================================================================
// ToolStreamChunk — server→client chunk contract
// =============================================================================

export const ToolStreamChunk = Schema.Struct({
  toolCallId: Schema.String,
  /** Monotonic per tool call */
  seq: Schema.Number,
  /** Raw text (may include ANSI) */
  chunk: Schema.String,
  /** Stream origin */
  kind: Schema.Literal('stdout', 'stderr'),
})
export type ToolStreamChunk = typeof ToolStreamChunk.Type

// =============================================================================
// Factory: empty initial state
// =============================================================================

import { SortedMap, Order } from 'effect'

export const EMPTY_TOOL_STREAM_STATE = (toolCallId: string, toolName = 'unknown'): ToolStreamState => ({
  toolCallId,
  toolName,
  ledger: SortedMap.empty<number, ToolStreamLine>(Order.number),
  pendingChunk: null,
  totalBytes: 0,
  startedAt: 0,
  lastChunkAt: 0,
  phase: 'idle',
})
