/**
 * RegistryDelta — Flow B+ PCT-native delta-sync envelope.
 *
 * Flow B exchanges full Manifests. Flow B+ exchanges only registry
 * changes whose local applied revision is greater than the peer's last
 * observed revision. This is intentionally PCT-native: it mirrors the
 * registry event payloads and does NOT impersonate Effect-smol
 * EventLogRemote / RemoteEntry semantics. Flow C owns that migration.
 *
 * @module @tmnl/pct/registry/RegistryDelta
 */

import * as Effect from "effect-v4/Effect"
import * as Schema from "effect-v4/Schema"

import {
  OperationDeprecatedPayload,
  OperationRegisteredPayload,
  SchemaDeprecatedPayload,
  SchemaRegisteredPayload,
} from "./RegistryEvents.js"

// ─── Change entries ────────────────────────────────────────────────────────

/** Local registry revision assigned when this change was applied. */
const Revision = Schema.Number

export const DeltaSchemaRegistered = Schema.TaggedStruct(
  "DeltaSchemaRegistered",
  {
    revision: Revision,
    payload: SchemaRegisteredPayload,
  },
)
export type DeltaSchemaRegistered = typeof DeltaSchemaRegistered.Type

export const DeltaSchemaDeprecated = Schema.TaggedStruct(
  "DeltaSchemaDeprecated",
  {
    revision: Revision,
    payload: SchemaDeprecatedPayload,
  },
)
export type DeltaSchemaDeprecated = typeof DeltaSchemaDeprecated.Type

export const DeltaOperationRegistered = Schema.TaggedStruct(
  "DeltaOperationRegistered",
  {
    revision: Revision,
    payload: OperationRegisteredPayload,
  },
)
export type DeltaOperationRegistered = typeof DeltaOperationRegistered.Type

export const DeltaOperationDeprecated = Schema.TaggedStruct(
  "DeltaOperationDeprecated",
  {
    revision: Revision,
    payload: OperationDeprecatedPayload,
  },
)
export type DeltaOperationDeprecated = typeof DeltaOperationDeprecated.Type

export const RegistryDeltaChange = Schema.Union([
  DeltaSchemaRegistered,
  DeltaSchemaDeprecated,
  DeltaOperationRegistered,
  DeltaOperationDeprecated,
])
export type RegistryDeltaChange = typeof RegistryDeltaChange.Type

// ─── Delta envelope ────────────────────────────────────────────────────────

export const RegistryDelta = Schema.TaggedStruct("RegistryDelta", {
  /** Node that produced this delta. */
  nodeId: Schema.String,
  /** Optional advertised URL for the producing node. */
  nodeUrl: Schema.optional(Schema.String),
  /** Exclusive lower bound requested by the peer. */
  fromRevision: Schema.Number,
  /** Inclusive upper bound represented by this response. */
  toRevision: Schema.Number,
  /** ISO timestamp for the producing registry's latest applied change. */
  asOf: Schema.NullOr(Schema.String),
  /** True when `changes` contains the full requested revision range. */
  complete: Schema.Boolean,
  /** Applied changes with `revision > fromRevision`, ascending. */
  changes: Schema.Array(RegistryDeltaChange),
})
export type RegistryDelta = typeof RegistryDelta.Type

export const encode = Schema.encodeUnknownEffect(RegistryDelta)
export const decode = Schema.decodeUnknownEffect(RegistryDelta)
export const decodeUnsafe = Schema.decodeUnknownSync(RegistryDelta)

// ─── Constructors / projections ────────────────────────────────────────────

export const makeSchemaRegistered = (
  revision: number,
  payload: typeof SchemaRegisteredPayload.Type,
): DeltaSchemaRegistered =>
  DeltaSchemaRegistered.make({ revision, payload })

export const makeSchemaDeprecated = (
  revision: number,
  payload: typeof SchemaDeprecatedPayload.Type,
): DeltaSchemaDeprecated =>
  DeltaSchemaDeprecated.make({ revision, payload })

export const makeOperationRegistered = (
  revision: number,
  payload: typeof OperationRegisteredPayload.Type,
): DeltaOperationRegistered =>
  DeltaOperationRegistered.make({ revision, payload })

export const makeOperationDeprecated = (
  revision: number,
  payload: typeof OperationDeprecatedPayload.Type,
): DeltaOperationDeprecated =>
  DeltaOperationDeprecated.make({ revision, payload })

/** Convert a delta change back to the registry event name + payload. */
export const toRegistryEvent = (change: RegistryDeltaChange):
  | {
      readonly event: "SchemaRegistered"
      readonly payload: typeof SchemaRegisteredPayload.Type
    }
  | {
      readonly event: "SchemaDeprecated"
      readonly payload: typeof SchemaDeprecatedPayload.Type
    }
  | {
      readonly event: "OperationRegistered"
      readonly payload: typeof OperationRegisteredPayload.Type
    }
  | {
      readonly event: "OperationDeprecated"
      readonly payload: typeof OperationDeprecatedPayload.Type
    } => {
  switch (change._tag) {
    case "DeltaSchemaRegistered":
      return { event: "SchemaRegistered", payload: change.payload }
    case "DeltaSchemaDeprecated":
      return { event: "SchemaDeprecated", payload: change.payload }
    case "DeltaOperationRegistered":
      return { event: "OperationRegistered", payload: change.payload }
    case "DeltaOperationDeprecated":
      return { event: "OperationDeprecated", payload: change.payload }
  }
}

export const fromChanges = (options: {
  readonly nodeId: string
  readonly nodeUrl?: string
  readonly fromRevision: number
  readonly toRevision: number
  readonly asOf: string | null
  readonly complete?: boolean
  readonly changes: ReadonlyArray<RegistryDeltaChange>
}): RegistryDelta =>
  RegistryDelta.make({
    nodeId: options.nodeId,
    ...(options.nodeUrl !== undefined ? { nodeUrl: options.nodeUrl } : {}),
    fromRevision: options.fromRevision,
    toRevision: options.toRevision,
    asOf: options.asOf,
    complete: options.complete ?? true,
    changes: [...options.changes],
  })

/** Effect helper for callers that want explicit boundary validation. */
export const validate = (delta: unknown): Effect.Effect<RegistryDelta, unknown, unknown> =>
  decode(delta)
