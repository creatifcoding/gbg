/**
 * RegistryEvents — the EventGroup that backs a pct registry.
 *
 * Every state change in the registry is one of these events. Folded
 * state (held by handlers in the EventLog) is the live registry view;
 * the journal is the audit trail.
 *
 * Per `PCT.md` §7 the registry exposes two write surfaces:
 *   - `SchemaRegistered`     — a new schema (or new version) is published
 *   - `SchemaDeprecated`     — a schema/version is flagged for removal
 *   - `OperationRegistered`  — declares an operation tying a name+version
 *                              to its input/output/error schemas + kind
 *   - `OperationDeprecated`  — flags an operation/version for removal
 *
 * Each event has a primaryKey for journal-level dedup; receivers' folded
 * state is last-writer-wins on primaryKey collisions (per EventLog
 * semantics).
 *
 * @module @tmnl/pct/registry/RegistryEvents
 */

import * as EventGroup from "effect-v4/unstable/eventlog/EventGroup"
import * as Schema from "effect-v4/Schema"

// ─── Payload schemas ────────────────────────────────────────────────────────

/**
 * `SchemaRegistered` — a new schema (or a new version of an existing
 * schema) becomes available in the registry.
 *
 * `schemaDocument` is `Schema.Unknown` because EventLog payloads must
 * round-trip via MsgPack. The actual content is a
 * `SchemaRepresentation.Document` JSON value, which the handler decodes
 * via `Schema.decodeUnknownSync(SchemaRepresentation.DocumentFromJson)`
 * to reconstruct a usable Schema.
 */
export const SchemaRegisteredPayload = Schema.Struct({
  /** "{namespace}/{name}" — e.g. "orders/Order" */
  schemaId: Schema.String,
  /** semver — e.g. "1.2.0" */
  version: Schema.String,
  /** SchemaRepresentation.Document encoded as JSON. */
  schemaDocument: Schema.Unknown,
  /** Wall-clock millis at registration time. */
  registeredAt: Schema.Number,
  /** Origin node id (registry node that issued this event). */
  originNodeId: Schema.String,
  /** Optional human-readable description (carried into capabilities). */
  description: Schema.optional(Schema.String),
})

/**
 * `SchemaDeprecated` — flags a (schemaId, version) as removal candidate.
 * The schema entry remains queryable; deprecation is metadata, not erasure.
 */
export const SchemaDeprecatedPayload = Schema.Struct({
  schemaId: Schema.String,
  version: Schema.String,
  /** semver of replacement, or null if this is end-of-line. */
  successor: Schema.NullOr(Schema.String),
  deprecatedAt: Schema.Number,
  reason: Schema.String,
  originNodeId: Schema.String,
})

/**
 * `OperationRegistered` — declares an operation. Ties a (name, version)
 * to a procedure kind and to its input/output/error Schema-Ids. The
 * Schema-Ids reference SchemaRegistered events.
 */
export const OperationRegisteredPayload = Schema.Struct({
  /** e.g. "orders.create" */
  name: Schema.String,
  /** e.g. "2.1.4" */
  version: Schema.String,
  /** ProcedureKind: "pure" | "query" | "mutation" | "stream" | "duplex" */
  kind: Schema.Literals(["pure", "query", "mutation", "stream", "duplex"]),
  /** "{schemaId}@{version}" pointing to a SchemaRegistered event. */
  inputSchemaId: Schema.String,
  outputSchemaId: Schema.String,
  errorSchemaIds: Schema.Array(Schema.String),
  registeredAt: Schema.Number,
  originNodeId: Schema.String,
  description: Schema.optional(Schema.String),
})

/**
 * `OperationDeprecated` — flags an operation version as removal candidate.
 */
export const OperationDeprecatedPayload = Schema.Struct({
  name: Schema.String,
  version: Schema.String,
  successor: Schema.NullOr(Schema.String),
  deprecatedAt: Schema.Number,
  reason: Schema.String,
  originNodeId: Schema.String,
})

// ─── EventGroup ─────────────────────────────────────────────────────────────

/**
 * The full registry event group. Handlers fold this into a queryable
 * registry view (`Pact.Registry`).
 */
export const RegistryGroup = EventGroup.empty
  .add({
    tag: "SchemaRegistered",
    primaryKey: (p) => `schema:${p.schemaId}@${p.version}`,
    payload: SchemaRegisteredPayload,
  })
  .add({
    tag: "SchemaDeprecated",
    primaryKey: (p) => `schema:${p.schemaId}@${p.version}`,
    payload: SchemaDeprecatedPayload,
  })
  .add({
    tag: "OperationRegistered",
    primaryKey: (p) => `op:${p.name}@${p.version}`,
    payload: OperationRegisteredPayload,
  })
  .add({
    tag: "OperationDeprecated",
    primaryKey: (p) => `op:${p.name}@${p.version}`,
    payload: OperationDeprecatedPayload,
  })

export type RegistryGroup = typeof RegistryGroup
