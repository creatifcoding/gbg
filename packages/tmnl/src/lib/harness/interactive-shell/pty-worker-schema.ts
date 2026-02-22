/**
 * PTY Worker Schema — TaggedRequest definitions for Worker thread communication.
 *
 * Defines the typed RPC contract between the main harness thread and the
 * PTY worker thread. Each request has Schema-backed payload, success, and
 * failure types.
 *
 * @module harness/interactive-shell/pty-worker-schema
 */

import { Schema } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Response types
// ─────────────────────────────────────────────────────────────────────────────

export class PtySpawnResult extends Schema.Class<PtySpawnResult>('PtySpawnResult')({
  sessionId: Schema.String,
  pid: Schema.optional(Schema.Number),
}) {}

export class PtyOutputChunk extends Schema.Class<PtyOutputChunk>('PtyOutputChunk')({
  sessionId: Schema.String,
  data: Schema.String,
}) {}

export class PtyExitResult extends Schema.Class<PtyExitResult>('PtyExitResult')({
  sessionId: Schema.String,
  exitCode: Schema.Number,
  signal: Schema.optional(Schema.Number),
}) {}

export class PtyWorkerError extends Schema.TaggedError<PtyWorkerError>()(
  'PtyWorkerError',
  {
    message: Schema.String,
    sessionId: Schema.optional(Schema.String),
  },
) {}

// ─────────────────────────────────────────────────────────────────────────────
// Requests (Schema.TaggedRequest)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spawn a new PTY session.
 * Returns a Stream of PtyOutputChunk (ongoing data) with PtySpawnResult as first emission.
 */
export class PtySpawn extends Schema.TaggedRequest<PtySpawn>()('PtySpawn', {
  failure: PtyWorkerError,
  success: PtyOutputChunk,
  payload: {
    sessionId: Schema.String,
    shell: Schema.String,
    args: Schema.Array(Schema.String),
    cwd: Schema.String,
    cols: Schema.Number,
    rows: Schema.Number,
    env: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
  },
}) {}

/**
 * Write raw input to a PTY session.
 */
export class PtyWrite extends Schema.TaggedRequest<PtyWrite>()('PtyWrite', {
  failure: PtyWorkerError,
  success: Schema.Void,
  payload: {
    sessionId: Schema.String,
    data: Schema.String,
  },
}) {}

/**
 * Resize a PTY session.
 */
export class PtyResize extends Schema.TaggedRequest<PtyResize>()('PtyResize', {
  failure: PtyWorkerError,
  success: Schema.Void,
  payload: {
    sessionId: Schema.String,
    cols: Schema.Number,
    rows: Schema.Number,
  },
}) {}

/**
 * Kill a PTY session.
 */
export class PtyKill extends Schema.TaggedRequest<PtyKill>()('PtyKill', {
  failure: PtyWorkerError,
  success: Schema.Void,
  payload: {
    sessionId: Schema.String,
    signal: Schema.optional(Schema.Number),
  },
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Screen reading (executeEffect — returns Effect, not Stream)
// ─────────────────────────────────────────────────────────────────────────────

/** Mode for screen dump: viewport (visible), tail (last N), slice (range) */
export const ScreenDumpMode = Schema.Literal('viewport', 'tail', 'slice')
export type ScreenDumpMode = typeof ScreenDumpMode.Type

/** Result of a screen dump request */
export class PtyScreenDumpResult extends Schema.Class<PtyScreenDumpResult>('PtyScreenDumpResult')({
  lines: Schema.Array(Schema.String),
  totalLines: Schema.Number,
  truncated: Schema.Boolean,
  cursorRow: Schema.optional(Schema.Number),
  cursorCol: Schema.optional(Schema.Number),
}) {}

/**
 * Dump rendered terminal screen from xterm-headless buffer.
 * Returns Effect<PtyScreenDumpResult> (single value, not Stream).
 */
export class PtyDumpScreen extends Schema.TaggedRequest<PtyDumpScreen>()('PtyDumpScreen', {
  failure: PtyWorkerError,
  success: PtyScreenDumpResult,
  payload: {
    sessionId: Schema.String,
    /** viewport: visible area, tail: last N lines, slice: offset+limit range */
    mode: ScreenDumpMode,
    /** Number of lines to return (tail/slice mode) */
    lines: Schema.optional(Schema.Number),
    /** Line offset for slice mode (0-indexed) */
    offset: Schema.optional(Schema.Number),
    /** Max characters before truncation */
    maxChars: Schema.optional(Schema.Number),
    /** If true, include ANSI color codes in output */
    ansi: Schema.optional(Schema.Boolean),
  },
}) {}

/** Result of a raw output read */
export class PtyRawOutputResult extends Schema.Class<PtyRawOutputResult>('PtyRawOutputResult')({
  text: Schema.String,
  totalLines: Schema.Number,
  totalChars: Schema.Number,
  sliceLineCount: Schema.Number,
}) {}

/**
 * Read raw output buffer with optional pagination / incremental reads.
 * Returns Effect<PtyRawOutputResult> (single value, not Stream).
 */
export class PtyReadOutput extends Schema.TaggedRequest<PtyReadOutput>()('PtyReadOutput', {
  failure: PtyWorkerError,
  success: PtyRawOutputResult,
  payload: {
    sessionId: Schema.String,
    /** If true, only return output since last read (incremental) */
    drain: Schema.optional(Schema.Boolean),
    /** Line offset (0-indexed) */
    offset: Schema.optional(Schema.Number),
    /** Max lines to return */
    limit: Schema.optional(Schema.Number),
    /** If true, strip ANSI escape codes (default: true) */
    stripAnsi: Schema.optional(Schema.Boolean),
  },
}) {}

// ─────────────────────────────────────────────────────────────────────────────
// Union (for Worker.makeSerialized / WorkerRunner.layerSerialized)
// ─────────────────────────────────────────────────────────────────────────────

export const PtyWorkerMessage = Schema.Union(
  PtySpawn,
  PtyWrite,
  PtyResize,
  PtyKill,
  PtyDumpScreen,
  PtyReadOutput,
)
export type PtyWorkerMessage = typeof PtyWorkerMessage.Type
