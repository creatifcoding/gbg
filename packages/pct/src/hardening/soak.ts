import * as Schema from "effect/Schema"

/** Schema version for the first soak artifact contract. */
export const SoakArtifactSchemaVersion = "pct.soak@1" as const

export const SoakTier = Schema.Literals([
  "local-process",
  "external-nats",
  "docker-compose",
  "kubernetes",
])
export type SoakTier = typeof SoakTier.Type

export const SoakRunStatus = Schema.Literals([
  "planned",
  "running",
  "passed",
  "failed",
  "aborted",
])
export type SoakRunStatus = typeof SoakRunStatus.Type

export const SoakNodeRole = Schema.Literals([
  "producer",
  "worker",
  "verifier",
  "control-plane",
  "nats",
])
export type SoakNodeRole = typeof SoakNodeRole.Type

export const SoakEventKind = Schema.Literals([
  "run.started",
  "run.completed",
  "node.started",
  "node.stopped",
  "message.produced",
  "frame.emitted",
  "verifier.sampled",
  "verifier.failed",
  "fault.injected",
])
export type SoakEventKind = typeof SoakEventKind.Type

export const SoakMetricName = Schema.Literals([
  "messagesProduced",
  "messagesRead",
  "framesEmitted",
  "duplicatesDetected",
  "gapsDetected",
  "schemaFailures",
  "reconnects",
  "latencyP50Ms",
  "latencyP95Ms",
  "latencyP99Ms",
])
export type SoakMetricName = typeof SoakMetricName.Type

export const SoakMetric = Schema.Struct({
  name: SoakMetricName,
  value: Schema.Number,
  unit: Schema.optional(Schema.String),
})
export type SoakMetric = typeof SoakMetric.Type

export const SoakStreamContract = Schema.Struct({
  streamId: Schema.String,
  schemaId: Schema.String,
  messageKind: Schema.String,
})
export type SoakStreamContract = typeof SoakStreamContract.Type

export const SoakFrameContract = Schema.Struct({
  projectionId: Schema.String,
  streamId: Schema.String,
  schemaId: Schema.String,
  table: Schema.String,
  requiredParts: Schema.Array(Schema.String),
})
export type SoakFrameContract = typeof SoakFrameContract.Type

export const SoakWorkload = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  streams: Schema.Array(SoakStreamContract),
  frames: Schema.Array(SoakFrameContract),
  durationMs: Schema.Int,
  producerCount: Schema.Int,
  workerCount: Schema.Int,
})
export type SoakWorkload = typeof SoakWorkload.Type

export const SoakNode = Schema.Struct({
  nodeId: Schema.String,
  role: SoakNodeRole,
  processId: Schema.optional(Schema.Int),
  host: Schema.optional(Schema.String),
})
export type SoakNode = typeof SoakNode.Type

export const SoakRunConfig = Schema.Struct({
  schemaVersion: Schema.Literal(SoakArtifactSchemaVersion),
  runId: Schema.String,
  tier: SoakTier,
  startedAt: Schema.String,
  status: SoakRunStatus,
  workload: SoakWorkload,
  nodes: Schema.Array(SoakNode),
  artifactDir: Schema.String,
})
export type SoakRunConfig = typeof SoakRunConfig.Type

export const SoakEvent = Schema.Struct({
  schemaVersion: Schema.Literal(SoakArtifactSchemaVersion),
  runId: Schema.String,
  eventId: Schema.String,
  kind: SoakEventKind,
  at: Schema.String,
  nodeId: Schema.optional(Schema.String),
  streamId: Schema.optional(Schema.String),
  frameId: Schema.optional(Schema.String),
  sequence: Schema.optional(Schema.Int),
  metrics: Schema.optional(Schema.Array(SoakMetric)),
  message: Schema.optional(Schema.String),
})
export type SoakEvent = typeof SoakEvent.Type

export const SoakVerifierSummary = Schema.Struct({
  checkedMessages: Schema.Int,
  checkedFrames: Schema.Int,
  duplicatesDetected: Schema.Int,
  gapsDetected: Schema.Int,
  schemaFailures: Schema.Int,
  firstFailure: Schema.optional(Schema.String),
})
export type SoakVerifierSummary = typeof SoakVerifierSummary.Type

export const SoakRunSummary = Schema.Struct({
  schemaVersion: Schema.Literal(SoakArtifactSchemaVersion),
  runId: Schema.String,
  tier: SoakTier,
  status: SoakRunStatus,
  startedAt: Schema.String,
  completedAt: Schema.optional(Schema.String),
  durationMs: Schema.Int,
  workload: SoakWorkload,
  metrics: Schema.Array(SoakMetric),
  verifier: SoakVerifierSummary,
  eventLogPath: Schema.String,
})
export type SoakRunSummary = typeof SoakRunSummary.Type

export const VitalsSoakWorkload = SoakWorkload.make({
  name: "vitals-frame-soak",
  description: "Deterministic vitals workload over pure source streams and a coherent vitals frame projection.",
  streams: [
    {
      streamId: "vitals.heart_rate",
      schemaId: "vitals.heart_rate@1.0.0",
      messageKind: "heart_rate",
    },
    {
      streamId: "vitals.spo2",
      schemaId: "vitals.spo2@1.0.0",
      messageKind: "spo2",
    },
    {
      streamId: "vitals.temperature",
      schemaId: "vitals.temperature@1.0.0",
      messageKind: "temperature",
    },
  ],
  frames: [
    {
      projectionId: "vitals.snapshot@1.0.0",
      streamId: "frames.vitals.snapshot",
      schemaId: "frames.vitals.snapshot@1.0.0",
      table: "vitals_snapshot_frames",
      requiredParts: ["heartRate", "spo2", "temperature"],
    },
  ],
  durationMs: 60_000,
  producerCount: 3,
  workerCount: 1,
})
