import * as Schema from "effect/Schema"

export const PermissionContractSchemaVersion = "pct.permission@1" as const

export const PermissionPersona = Schema.Literals([
  "pct-admin",
  "pct-runtime",
  "lnk-bridge",
  "projection-worker",
  "diagnostics-readonly",
])
export type PermissionPersona = typeof PermissionPersona.Type

export const PermissionResourceKind = Schema.Literals([
  "nats-subject",
  "jetstream-api",
  "kv-bucket",
  "micro-endpoint",
  "http-route",
  "eventlog-peer",
])
export type PermissionResourceKind = typeof PermissionResourceKind.Type

export const PermissionAction = Schema.Literals([
  "publish",
  "subscribe",
  "request",
  "respond",
  "read",
  "write",
  "delete",
  "admin",
])
export type PermissionAction = typeof PermissionAction.Type

export const PermissionEffect = Schema.Literals(["allow", "deny"])
export type PermissionEffect = typeof PermissionEffect.Type

export const PermissionRule = Schema.Struct({
  persona: PermissionPersona,
  resourceKind: PermissionResourceKind,
  resource: Schema.String,
  actions: Schema.Array(PermissionAction),
  effect: PermissionEffect,
  reason: Schema.String,
})
export type PermissionRule = typeof PermissionRule.Type

export const PermissionProfile = Schema.Struct({
  schemaVersion: Schema.Literal(PermissionContractSchemaVersion),
  profileId: Schema.String,
  description: Schema.optional(Schema.String),
  rules: Schema.Array(PermissionRule),
})
export type PermissionProfile = typeof PermissionProfile.Type

export const PermissionProbeExpectation = Schema.Struct({
  persona: PermissionPersona,
  action: PermissionAction,
  resourceKind: PermissionResourceKind,
  resource: Schema.String,
  expected: PermissionEffect,
  diagnosticCheckId: Schema.optional(Schema.String),
})
export type PermissionProbeExpectation = typeof PermissionProbeExpectation.Type

export const PermissionMatrix = Schema.Struct({
  schemaVersion: Schema.Literal(PermissionContractSchemaVersion),
  matrixId: Schema.String,
  profiles: Schema.Array(PermissionProfile),
  probes: Schema.Array(PermissionProbeExpectation),
})
export type PermissionMatrix = typeof PermissionMatrix.Type

export const MinimalPctRuntimePermissionProfile = PermissionProfile.make({
  schemaVersion: PermissionContractSchemaVersion,
  profileId: "pct-runtime-minimal@1",
  description: "Minimum first-cut PCT runtime grants for schema/control-plane request-reply and read-only diagnostics.",
  rules: [
    {
      persona: "pct-runtime",
      resourceKind: "micro-endpoint",
      resource: "pct.schema.get",
      actions: ["request", "respond"],
      effect: "allow",
      reason: "PCT owns schema.get semantics over the generic MSH micro host.",
    },
    {
      persona: "pct-runtime",
      resourceKind: "micro-endpoint",
      resource: "pct.capabilities.get",
      actions: ["request", "respond"],
      effect: "allow",
      reason: "PCT owns capabilities.get semantics over the generic MSH micro host.",
    },
    {
      persona: "diagnostics-readonly",
      resourceKind: "jetstream-api",
      resource: "$JS.API.INFO",
      actions: ["request", "read"],
      effect: "allow",
      reason: "Read-only substrate diagnostics must be possible without write authority.",
    },
  ],
})

export const DefaultPermissionMatrix = PermissionMatrix.make({
  schemaVersion: PermissionContractSchemaVersion,
  matrixId: "pct-lnk-msh-permissions@1",
  profiles: [MinimalPctRuntimePermissionProfile],
  probes: [
    {
      persona: "diagnostics-readonly",
      action: "write",
      resourceKind: "kv-bucket",
      resource: "lnk_metadata",
      expected: "deny",
      diagnosticCheckId: "lnk.mshBridge.metadataBucket",
    },
    {
      persona: "pct-runtime",
      action: "request",
      resourceKind: "micro-endpoint",
      resource: "pct.schema.get",
      expected: "allow",
      diagnosticCheckId: "pct.natsControl.info",
    },
  ],
})
