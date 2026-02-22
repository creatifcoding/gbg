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
// Union (for Worker.makeSerialized / WorkerRunner.layerSerialized)
// ─────────────────────────────────────────────────────────────────────────────

export const PtyWorkerMessage = Schema.Union(PtySpawn, PtyWrite, PtyResize, PtyKill)
export type PtyWorkerMessage = typeof PtyWorkerMessage.Type
