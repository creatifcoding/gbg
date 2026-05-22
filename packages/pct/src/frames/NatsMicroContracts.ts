/**
 * ProjectionWorker NATS micro operation contracts.
 *
 * These are PCT-owned wire contracts for a semantic ProjectionWorker service
 * hosted over MSH's generic micro endpoint seam. MSH sees only schemas,
 * subjects, and bytes; projection policy stays here / in the worker runtime.
 *
 * @module @tmnl/pct/frames/NatsMicroContracts
 */

import * as Schema from "effect-v4/Schema"

import { ProjectionPlan } from "./FrameProjectionSpec.js"
import {
  ProjectionRunMode,
  ProjectionWorkerRunSummary,
  ProjectionWorkerSnapshot,
  ProjectionWorkerStatus,
} from "./ProjectionWorker.js"

// ─── Subject/options resolution ─────────────────────────────────────────────

export interface ProjectionWorkerNatsOptions {
  readonly subjectRoot?: string
  readonly serviceName?: string
  readonly serviceVersion?: string
  readonly serviceDescription?: string
  readonly queue?: string
  readonly metadata?: Record<string, string>
}

export interface ResolvedProjectionWorkerNatsOptions {
  readonly subjectRoot: string
  readonly serviceName: string
  readonly serviceVersion: string
  readonly serviceDescription: string
  readonly queue: string | undefined
  readonly metadata: Record<string, string>
  readonly subjects: {
    readonly plan: string
    readonly start: string
    readonly stop: string
    readonly status: string
    readonly runOnce: string
    readonly tail: string
  }
}

export const DEFAULT_PROJECTION_WORKER_NATS_OPTIONS = {
  subjectRoot: "pct.v1.projection",
  serviceName: "pct-projection-worker",
  serviceVersion: "0.1.0",
  serviceDescription: "PCT/LNK ProjectionWorker control plane",
} as const

export const resolveProjectionWorkerNatsOptions = (
  options: ProjectionWorkerNatsOptions = {},
): ResolvedProjectionWorkerNatsOptions => {
  const subjectRoot = options.subjectRoot ?? DEFAULT_PROJECTION_WORKER_NATS_OPTIONS.subjectRoot
  return {
    subjectRoot,
    serviceName: options.serviceName ?? DEFAULT_PROJECTION_WORKER_NATS_OPTIONS.serviceName,
    serviceVersion: options.serviceVersion ?? DEFAULT_PROJECTION_WORKER_NATS_OPTIONS.serviceVersion,
    serviceDescription:
      options.serviceDescription ?? DEFAULT_PROJECTION_WORKER_NATS_OPTIONS.serviceDescription,
    queue: options.queue,
    metadata: {
      domain: "pct",
      role: "projection-worker",
      boundary: "semantic-worker-over-msh-micro-substrate",
      subjectRoot,
      ...(options.metadata ?? {}),
    },
    subjects: {
      plan: `${subjectRoot}.plan`,
      start: `${subjectRoot}.start`,
      stop: `${subjectRoot}.stop`,
      status: `${subjectRoot}.status`,
      runOnce: `${subjectRoot}.run_once`,
      tail: `${subjectRoot}.tail`,
    },
  }
}

// ─── Shared request fragments ───────────────────────────────────────────────

export const ProjectionWorkerSelector = Schema.Struct({
  projectionId: Schema.optional(Schema.String),
  workerId: Schema.optional(Schema.String),
})
export type ProjectionWorkerSelector = typeof ProjectionWorkerSelector.Type

export const ProjectionWorkerStartMode = Schema.Literals([
  "create-if-absent",
  "replace-existing",
  "fail-if-running",
])
export type ProjectionWorkerStartMode = typeof ProjectionWorkerStartMode.Type

// ─── projection.plan ────────────────────────────────────────────────────────

export const ProjectionPlanRequest = Schema.Struct({
  projectionId: Schema.String,
  includeDdl: Schema.optional(Schema.Boolean),
})
export type ProjectionPlanRequest = typeof ProjectionPlanRequest.Type

export const ProjectionPlanResponse = Schema.Struct({
  projectionId: Schema.String,
  plan: ProjectionPlan,
  generatedAt: Schema.Number,
})
export type ProjectionPlanResponse = typeof ProjectionPlanResponse.Type

// ─── projection.start ───────────────────────────────────────────────────────

export const ProjectionStartRequest = Schema.Struct({
  projectionId: Schema.String,
  workerId: Schema.optional(Schema.String),
  mode: Schema.optional(ProjectionRunMode),
  startMode: Schema.optional(ProjectionWorkerStartMode),
  maxMessagesPerTick: Schema.optional(Schema.Int),
  idlePollMs: Schema.optional(Schema.Int),
})
export type ProjectionStartRequest = typeof ProjectionStartRequest.Type

export const ProjectionStartResponse = Schema.Struct({
  worker: ProjectionWorkerSnapshot,
  started: Schema.Boolean,
})
export type ProjectionStartResponse = typeof ProjectionStartResponse.Type

// ─── projection.stop ────────────────────────────────────────────────────────

export const ProjectionStopRequest = Schema.Struct({
  workerId: Schema.String,
  reason: Schema.optional(Schema.String),
})
export type ProjectionStopRequest = typeof ProjectionStopRequest.Type

export const ProjectionStopResponse = Schema.Struct({
  workerId: Schema.String,
  projectionId: Schema.String,
  status: ProjectionWorkerStatus,
  stoppedAt: Schema.Number,
})
export type ProjectionStopResponse = typeof ProjectionStopResponse.Type

// ─── projection.status ──────────────────────────────────────────────────────

export const ProjectionStatusRequest = ProjectionWorkerSelector
export type ProjectionStatusRequest = typeof ProjectionStatusRequest.Type

export const ProjectionStatusResponse = Schema.Struct({
  workers: Schema.Array(ProjectionWorkerSnapshot),
  reportedAt: Schema.Number,
})
export type ProjectionStatusResponse = typeof ProjectionStatusResponse.Type

// ─── projection.run_once ────────────────────────────────────────────────────

export const ProjectionRunOnceRequest = Schema.Struct({
  projectionId: Schema.String,
  workerId: Schema.optional(Schema.String),
  maxMessages: Schema.optional(Schema.Int),
  dryRun: Schema.optional(Schema.Boolean),
})
export type ProjectionRunOnceRequest = typeof ProjectionRunOnceRequest.Type

export const ProjectionRunOnceResponse = Schema.Struct({
  summary: ProjectionWorkerRunSummary,
})
export type ProjectionRunOnceResponse = typeof ProjectionRunOnceResponse.Type

// ─── projection.tail ────────────────────────────────────────────────────────

export const ProjectionTailRequest = Schema.Struct({
  projectionId: Schema.String,
  workerId: Schema.optional(Schema.String),
  maxMessagesPerTick: Schema.optional(Schema.Int),
  idlePollMs: Schema.optional(Schema.Int),
})
export type ProjectionTailRequest = typeof ProjectionTailRequest.Type

export const ProjectionTailResponse = Schema.Struct({
  worker: ProjectionWorkerSnapshot,
  status: ProjectionWorkerStatus,
})
export type ProjectionTailResponse = typeof ProjectionTailResponse.Type

// ─── Operation manifest ─────────────────────────────────────────────────────

export const ProjectionWorkerNatsOperation = Schema.Struct({
  operation: Schema.Literals([
    "projection.plan",
    "projection.start",
    "projection.stop",
    "projection.status",
    "projection.run_once",
    "projection.tail",
  ]),
  subject: Schema.String,
  request: Schema.String,
  response: Schema.String,
})
export type ProjectionWorkerNatsOperation = typeof ProjectionWorkerNatsOperation.Type

export const projectionWorkerNatsOperations = (
  options: ProjectionWorkerNatsOptions = {},
): ReadonlyArray<ProjectionWorkerNatsOperation> => {
  const resolved = resolveProjectionWorkerNatsOptions(options)
  return [
    {
      operation: "projection.plan",
      subject: resolved.subjects.plan,
      request: "ProjectionPlanRequest",
      response: "ProjectionPlanResponse",
    },
    {
      operation: "projection.start",
      subject: resolved.subjects.start,
      request: "ProjectionStartRequest",
      response: "ProjectionStartResponse",
    },
    {
      operation: "projection.stop",
      subject: resolved.subjects.stop,
      request: "ProjectionStopRequest",
      response: "ProjectionStopResponse",
    },
    {
      operation: "projection.status",
      subject: resolved.subjects.status,
      request: "ProjectionStatusRequest",
      response: "ProjectionStatusResponse",
    },
    {
      operation: "projection.run_once",
      subject: resolved.subjects.runOnce,
      request: "ProjectionRunOnceRequest",
      response: "ProjectionRunOnceResponse",
    },
    {
      operation: "projection.tail",
      subject: resolved.subjects.tail,
      request: "ProjectionTailRequest",
      response: "ProjectionTailResponse",
    },
  ]
}
