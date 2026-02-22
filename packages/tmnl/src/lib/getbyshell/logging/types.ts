/**
 * Shell Logging — Schema types for journald bridge.
 *
 * Structured log entries sent from Effect Logger → Tauri IPC → Rust → journald.
 */

import { Schema } from 'effect'

/** Log level matching Rust's log crate levels */
export const ShellLogLevel = Schema.Literal(
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
)
export type ShellLogLevel = typeof ShellLogLevel.Type

/** A structured log entry sent over Tauri IPC */
export class ShellLogEntry extends Schema.Class<ShellLogEntry>('ShellLogEntry')({
  /** ISO timestamp */
  timestamp: Schema.String,
  /** Log level */
  level: ShellLogLevel,
  /** Human-readable message */
  message: Schema.String,
  /** Effect fiber ID (for tracing concurrent operations) */
  fiberId: Schema.optional(Schema.String),
  /** Active span names (breadcrumb trail) */
  spans: Schema.optional(Schema.Array(Schema.String)),
  /** Key-value annotations (arbitrary metadata) */
  annotations: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),
  /** Source module/component */
  source: Schema.optional(Schema.String),
  /** Error cause (serialized) */
  cause: Schema.optional(Schema.String),
}) {}

/** Batch of log entries for efficient IPC */
export class ShellLogBatch extends Schema.Class<ShellLogBatch>('ShellLogBatch')({
  entries: Schema.Array(ShellLogEntry),
}) {}
