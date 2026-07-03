import * as Schema from "effect/Schema"

export const FaultScenarioSchemaVersion = "pct.fault@1" as const

export const FaultTargetLayer = Schema.Literals([
  "msh",
  "lnk",
  "pct",
  "projection-worker",
  "outbox",
  "nats",
])
export type FaultTargetLayer = typeof FaultTargetLayer.Type

export const FaultOperation = Schema.Literals([
  "core.request",
  "jetstream.publish",
  "kv.get",
  "kv.update",
  "consumer.fetch",
  "consumer.next",
  "ack",
  "connection.status",
  "lnk.append",
  "lnk.read",
  "projection.tick",
  "outbox.publish",
])
export type FaultOperation = typeof FaultOperation.Type

export const FaultKind = Schema.Literals([
  "timeout",
  "disconnect",
  "reconnect",
  "permission-denied",
  "not-found",
  "decode-error",
  "duplicate-ack",
  "closed-iterator",
  "publish-accepted-then-lost-metadata",
  "fail-n-times-then-succeed",
  "poison-message",
])
export type FaultKind = typeof FaultKind.Type

export const FaultInjectionMode = Schema.Literals([
  "mock",
  "local-nats-bounce",
  "kubernetes-hook",
])
export type FaultInjectionMode = typeof FaultInjectionMode.Type

export const FaultExpectationKind = Schema.Literals([
  "recovers",
  "fails-fast",
  "parks-work",
  "dead-letters",
  "requires-operator",
])
export type FaultExpectationKind = typeof FaultExpectationKind.Type

export const FaultStep = Schema.Struct({
  stepId: Schema.String,
  atMs: Schema.Int,
  targetLayer: FaultTargetLayer,
  operation: FaultOperation,
  fault: FaultKind,
  mode: FaultInjectionMode,
  failCount: Schema.optional(Schema.Int),
  durationMs: Schema.optional(Schema.Int),
  description: Schema.optional(Schema.String),
})
export type FaultStep = typeof FaultStep.Type

export const FaultExpectation = Schema.Struct({
  stepId: Schema.String,
  expectation: FaultExpectationKind,
  maxRecoveryMs: Schema.optional(Schema.Int),
  invariant: Schema.String,
})
export type FaultExpectation = typeof FaultExpectation.Type

export const FaultScenario = Schema.Struct({
  schemaVersion: Schema.Literal(FaultScenarioSchemaVersion),
  scenarioId: Schema.String,
  description: Schema.String,
  mode: FaultInjectionMode,
  steps: Schema.Array(FaultStep),
  expectations: Schema.Array(FaultExpectation),
})
export type FaultScenario = typeof FaultScenario.Type

export const FaultRunStatus = Schema.Literals([
  "planned",
  "running",
  "passed",
  "failed",
  "aborted",
])
export type FaultRunStatus = typeof FaultRunStatus.Type

export const FaultRunReport = Schema.Struct({
  schemaVersion: Schema.Literal(FaultScenarioSchemaVersion),
  runId: Schema.String,
  scenarioId: Schema.String,
  status: FaultRunStatus,
  startedAt: Schema.String,
  completedAt: Schema.optional(Schema.String),
  observedFailures: Schema.Array(Schema.String),
  satisfiedExpectations: Schema.Array(Schema.String),
  unsatisfiedExpectations: Schema.Array(Schema.String),
})
export type FaultRunReport = typeof FaultRunReport.Type

export const LocalNatsBounceScenario = FaultScenario.make({
  schemaVersion: FaultScenarioSchemaVersion,
  scenarioId: "local-nats-bounce@1",
  description: "Local NATS bounce should surface status telemetry and preserve durable PCT/LNK/projection invariants.",
  mode: "local-nats-bounce",
  steps: [
    {
      stepId: "disconnect-nats",
      atMs: 5_000,
      targetLayer: "nats",
      operation: "connection.status",
      fault: "disconnect",
      mode: "local-nats-bounce",
      durationMs: 2_000,
      description: "Stop or bounce local nats-server during active workload.",
    },
    {
      stepId: "reconnect-nats",
      atMs: 7_000,
      targetLayer: "nats",
      operation: "connection.status",
      fault: "reconnect",
      mode: "local-nats-bounce",
      description: "Allow clients to reconnect and resume bounded work.",
    },
  ],
  expectations: [
    {
      stepId: "disconnect-nats",
      expectation: "parks-work",
      maxRecoveryMs: 10_000,
      invariant: "No acknowledged LNK append is duplicated or silently lost while disconnected.",
    },
    {
      stepId: "reconnect-nats",
      expectation: "recovers",
      maxRecoveryMs: 10_000,
      invariant: "Projection checkpoints remain monotonic after reconnect.",
    },
  ],
})
