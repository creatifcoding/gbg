/**
 * AgentTaskLogEntry — rich structured log entry for agent task streams.
 *
 * TaggedClass so construction is `new AgentTaskLogEntry({...})`.
 * Schema-backed for JSONL codec, NATS transport, and UI rendering.
 *
 * Fields:
 * - timestamp:     DateTimeUtc — when the entry was emitted
 * - level:         LogLevel — severity
 * - source:        String — originating service / agent / component
 * - message:       String — human-readable log message
 * - spanId:        optional — OpenTelemetry span correlation
 * - traceId:       optional — OpenTelemetry trace correlation
 * - parentTaskId:  optional — links to parent in task DAG
 * - toolCallId:    optional — links to specific tool invocation
 * - metadata:      optional — arbitrary structured data
 * - payload:       optional — raw payload (e.g. response body, error object)
 *
 * @module agent-task/schemas/log-entry
 */

import { Schema } from 'effect'
import { LogLevel } from './log-level'

// ---------------------------------------------------------------------------
// Fields (extracted for reuse by codec / tests)
// ---------------------------------------------------------------------------

export const AgentTaskLogEntryFields = {
  /** Unique entry ID (nanoid or uuid) */
  id: Schema.String,

  /** When this entry was emitted */
  timestamp: Schema.DateTimeUtc,

  /** Severity level */
  level: LogLevel,

  /** Originating service / agent / component name */
  source: Schema.String,

  /** Human-readable log message */
  message: Schema.String,

  /** OpenTelemetry span ID for trace correlation */
  spanId: Schema.optional(Schema.String),

  /** OpenTelemetry trace ID for trace correlation */
  traceId: Schema.optional(Schema.String),

  /** Parent task ID — links this log entry to its parent in the task DAG */
  parentTaskId: Schema.optional(Schema.String),

  /** Tool call ID — links to the specific tool invocation that produced this entry */
  toolCallId: Schema.optional(Schema.String),

  /** Arbitrary structured metadata (e.g. { latency: 120, node: 'us-east-1' }) */
  metadata: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  ),

  /** Raw payload — full response body, error object, etc. */
  payload: Schema.optional(Schema.Unknown),
}

// ---------------------------------------------------------------------------
// TaggedClass
// ---------------------------------------------------------------------------

export class AgentTaskLogEntry extends Schema.TaggedClass<AgentTaskLogEntry>()(
  'AgentTaskLogEntry',
  AgentTaskLogEntryFields,
) {}

/** Schema alias for codec derivation / AST introspection. */
export const AgentTaskLogEntrySchema = AgentTaskLogEntry
