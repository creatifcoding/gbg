/**
 * ProjectionWorker contracts.
 *
 * These schemas describe the generic frame assembly runtime without binding it
 * to a concrete transport, database client, or scheduler. PCT owns these
 * contracts; an LNK-owned runtime can execute them, and a NATS micro host can
 * expose them, while MSH remains substrate-only.
 *
 * @module @tmnl/pct/frames/ProjectionWorker
 */

import * as Schema from "effect/Schema"

import { FrameProjectionSpec, ProjectionPlan } from "./FrameProjectionSpec.js"

// ─── Runtime vocabulary ────────────────────────────────────────────────────

export const ProjectionRunMode = Schema.Literals([
  "run-once",
  "tail",
])
export type ProjectionRunMode = typeof ProjectionRunMode.Type

export const ProjectionWorkerStatus = Schema.Literals([
  "idle",
  "starting",
  "running",
  "stopping",
  "stopped",
  "failed",
])
export type ProjectionWorkerStatus = typeof ProjectionWorkerStatus.Type

export const ProjectionTimeoutOutcome = Schema.Literals([
  "none",
  "emitted-partial",
  "dropped-partial",
  "dead-lettered",
])
export type ProjectionTimeoutOutcome = typeof ProjectionTimeoutOutcome.Type

export const ProjectionOutputKind = Schema.Literals([
  "timescale-frame-row",
  "lnk-frame-stream",
])
export type ProjectionOutputKind = typeof ProjectionOutputKind.Type

// ─── Source message and frame parts ─────────────────────────────────────────

export const ProjectionSourceMessage = Schema.Struct({
  /** Projection id that selected this source binding. */
  projectionId: Schema.String,
  /** Pure source stream id, e.g. `vitals.heart_rate`. */
  streamId: Schema.String,
  /** Durable source offset, opaque to PCT. */
  offset: Schema.String,
  /** PCT schema id expected/observed for the payload. */
  schemaId: Schema.String,
  /** Stable part key from FrameSourceBinding.as. */
  partKey: Schema.String,
  /** Observation time extracted from the payload as ISO/string timestamp. */
  observedAt: Schema.String,
  /** Entity key extracted from the configured key paths. */
  entityKey: Schema.Unknown,
  /** Raw decoded source payload. */
  payload: Schema.Unknown,
  /** Runtime receive timestamp in epoch millis. */
  receivedAt: Schema.Number,
})
export type ProjectionSourceMessage = typeof ProjectionSourceMessage.Type

export const FramePartProvenance = Schema.Struct({
  partKey: Schema.String,
  sourceStreamId: Schema.String,
  sourceOffset: Schema.String,
  sourceSchemaId: Schema.String,
  observedAt: Schema.String,
  receivedAt: Schema.Number,
})
export type FramePartProvenance = typeof FramePartProvenance.Type

export const FramePart = Schema.Struct({
  projectionId: Schema.String,
  frameId: Schema.String,
  frameTime: Schema.String,
  deadlineAt: Schema.String,
  partKey: Schema.String,
  entityKey: Schema.Unknown,
  payload: Schema.Unknown,
  provenance: FramePartProvenance,
})
export type FramePart = typeof FramePart.Type

export const FrameCompleteness = Schema.Struct({
  complete: Schema.Boolean,
  missingParts: Schema.Array(Schema.String),
  imputedParts: Schema.Array(Schema.String),
})
export type FrameCompleteness = typeof FrameCompleteness.Type

export const FrameAssemblyState = Schema.Struct({
  projectionId: Schema.String,
  frameId: Schema.String,
  frameTime: Schema.String,
  deadlineAt: Schema.String,
  entityKey: Schema.Unknown,
  parts: Schema.Array(FramePart),
  completeness: FrameCompleteness,
  provenance: Schema.Array(FramePartProvenance),
  updatedAt: Schema.Number,
})
export type FrameAssemblyState = typeof FrameAssemblyState.Type

// ─── Materialized output contracts ──────────────────────────────────────────

export const MaterializedFrame = Schema.Struct({
  projectionId: Schema.String,
  projectionVersion: Schema.String,
  outputSchemaId: Schema.String,
  frameId: Schema.String,
  frameTime: Schema.String,
  entityKey: Schema.Unknown,
  complete: Schema.Boolean,
  missingParts: Schema.Array(Schema.String),
  imputedParts: Schema.Array(Schema.String),
  payload: Schema.Unknown,
  provenance: Schema.Array(FramePartProvenance),
  frameRevision: Schema.Int,
  emittedAt: Schema.Number,
})
export type MaterializedFrame = typeof MaterializedFrame.Type

export const ProjectionOutputReceipt = Schema.Struct({
  kind: ProjectionOutputKind,
  projectionId: Schema.String,
  frameId: Schema.String,
  /** Table name for Timescale rows or stream id for LNK frame events. */
  target: Schema.String,
  /** Idempotency key used by the writer. */
  idempotencyKey: Schema.String,
  writtenAt: Schema.Number,
})
export type ProjectionOutputReceipt = typeof ProjectionOutputReceipt.Type

export const ProjectionDeadLetter = Schema.Struct({
  projectionId: Schema.String,
  frameId: Schema.String,
  reason: Schema.String,
  state: FrameAssemblyState,
  recordedAt: Schema.Number,
})
export type ProjectionDeadLetter = typeof ProjectionDeadLetter.Type

// ─── Worker lifecycle contracts ────────────────────────────────────────────

export const ProjectionWorkerConfig = Schema.Struct({
  workerId: Schema.String,
  spec: FrameProjectionSpec,
  plan: ProjectionPlan,
  mode: ProjectionRunMode,
  /** Bounded batch/tick size for runOnce/tail pulls. */
  maxMessagesPerTick: Schema.Int,
  /** Milliseconds between idle tail polls. */
  idlePollMs: Schema.Int,
})
export type ProjectionWorkerConfig = typeof ProjectionWorkerConfig.Type

export const ProjectionWorkerSnapshot = Schema.Struct({
  workerId: Schema.String,
  projectionId: Schema.String,
  status: ProjectionWorkerStatus,
  mode: ProjectionRunMode,
  startedAt: Schema.NullOr(Schema.Number),
  stoppedAt: Schema.NullOr(Schema.Number),
  lastTickAt: Schema.NullOr(Schema.Number),
  processedMessages: Schema.Number,
  emittedFrames: Schema.Number,
  duplicateParts: Schema.Number,
  failedFrames: Schema.Number,
  lastError: Schema.NullOr(Schema.String),
})
export type ProjectionWorkerSnapshot = typeof ProjectionWorkerSnapshot.Type

export const ProjectionTickResult = Schema.Struct({
  projectionId: Schema.String,
  workerId: Schema.String,
  processedMessages: Schema.Number,
  acceptedParts: Schema.Number,
  duplicateParts: Schema.Number,
  completedFrames: Schema.Array(MaterializedFrame),
  partialFrames: Schema.Array(MaterializedFrame),
  deadLetters: Schema.Array(ProjectionDeadLetter),
  outputReceipts: Schema.Array(ProjectionOutputReceipt),
  timeoutOutcome: ProjectionTimeoutOutcome,
  startedAt: Schema.Number,
  finishedAt: Schema.Number,
})
export type ProjectionTickResult = typeof ProjectionTickResult.Type

export const ProjectionWorkerRunSummary = Schema.Struct({
  workerId: Schema.String,
  projectionId: Schema.String,
  status: ProjectionWorkerStatus,
  ticks: Schema.Array(ProjectionTickResult),
  processedMessages: Schema.Number,
  emittedFrames: Schema.Number,
  duplicateParts: Schema.Number,
  failedFrames: Schema.Number,
  startedAt: Schema.Number,
  finishedAt: Schema.NullOr(Schema.Number),
})
export type ProjectionWorkerRunSummary = typeof ProjectionWorkerRunSummary.Type
