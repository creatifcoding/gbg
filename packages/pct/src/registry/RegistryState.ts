/**
 * RegistryState — the materialized view folded from RegistryEvents.
 *
 * # Schema discipline
 *
 * Per the project's AGENTS.md: entities that flow through the system are
 * `Schema.TaggedStruct`. `SchemaEntry`, `OperationEntry`, and the
 * `Deprecation` substructure are all tagged so that:
 *
 *   - They round-trip through JSON cleanly (Schema-encodable).
 *   - Wire receivers can pattern-match on `_tag` without out-of-band info.
 *   - Equal/Hash work across collections.
 *
 * Event payloads (in `RegistryEvents.ts`) stay `Schema.Struct` because
 * the EventGroup tag is one level up (matches Effect's canonical
 * `EventLog.test.ts` idiom).
 *
 * # Federation conflict resolution (the precedence rule)
 *
 * Registry state is materialized from an event log that may receive
 * concurrent writes from multiple federated nodes. To converge to a
 * deterministic state regardless of arrival order, **folders apply a
 * total ordering** on conflicting events:
 *
 *   1. **Wallclock first**: the event with later `registeredAt` /
 *      `deprecatedAt` wins.
 *   2. **NodeId tiebreak**: when timestamps tie (same millisecond, e.g.
 *      coordinated batch publishes), lex-greater `originNodeId` wins.
 *
 * Folders SKIP events whose precedence is lower than the existing
 * entry's. This preserves the audit trail (the journal still has both
 * events) while guaranteeing deterministic state convergence.
 *
 * @module @tmnl/pct/registry/RegistryState
 */

import * as Schema from "effect-v4/Schema"

// ─── Tagged sub-structure: Deprecation flag ─────────────────────────────────

export const Deprecation = Schema.TaggedStruct("Deprecation", {
  at: Schema.Number,
  successor: Schema.NullOr(Schema.String),
  reason: Schema.String,
  originNodeId: Schema.String,
})
export type Deprecation = typeof Deprecation.Type

// ─── Materialized entries ───────────────────────────────────────────────────

export const SchemaEntry = Schema.TaggedStruct("SchemaEntry", {
  schemaId: Schema.String,
  version: Schema.String,
  /** SchemaRepresentation.Document JSON; reconstruct via toSchema. */
  schemaDocument: Schema.Unknown,
  registeredAt: Schema.Number,
  originNodeId: Schema.String,
  description: Schema.optional(Schema.String),
  deprecated: Schema.NullOr(Deprecation),
})
export type SchemaEntry = typeof SchemaEntry.Type

export const OperationEntry = Schema.TaggedStruct("OperationEntry", {
  name: Schema.String,
  version: Schema.String,
  kind: Schema.Literals(["pure", "query", "mutation", "stream", "duplex"]),
  inputSchemaId: Schema.String,
  outputSchemaId: Schema.String,
  errorSchemaIds: Schema.Array(Schema.String),
  registeredAt: Schema.Number,
  originNodeId: Schema.String,
  description: Schema.optional(Schema.String),
  deprecated: Schema.NullOr(Deprecation),
})
export type OperationEntry = typeof OperationEntry.Type

// ─── Aggregate state ────────────────────────────────────────────────────────

export interface RegistryState {
  /** Key: `{schemaId}@{version}`. */
  readonly schemas: ReadonlyMap<string, SchemaEntry>
  /** Key: `{name}@{version}`. */
  readonly operations: ReadonlyMap<string, OperationEntry>
  /** Monotonic revision counter, bumped on every applied event. */
  readonly revision: number
  /**
   * Wall-clock millis of the most recent applied event. `null` for an
   * empty registry. Read-side translates to ISO-8601 on demand.
   */
  readonly asOfMs: number | null
}

export const empty = (): RegistryState => ({
  schemas: new Map(),
  operations: new Map(),
  revision: 0,
  asOfMs: null,
})

// ─── Precedence (federation conflict resolution) ────────────────────────────

/**
 * Compare two `(timestamp, originNodeId)` pairs using the registry's
 * total order: timestamp first, lex `originNodeId` as tiebreak.
 *
 * Returns positive when `a` outranks `b`, negative when `b` outranks
 * `a`, zero on full tie. Folders apply incoming events only when the
 * incoming pair STRICTLY OUTRANKS the existing entry's; ties result in
 * idempotent no-op (existing wins).
 */
const comparePrecedence = (
  a: { readonly at: number; readonly nodeId: string },
  b: { readonly at: number; readonly nodeId: string },
): number => {
  if (a.at !== b.at) return a.at - b.at
  // Lex compare. localeCompare returns -1/0/1 (in modern engines).
  return a.nodeId.localeCompare(b.nodeId)
}

/** True iff incoming should overwrite existing per precedence rule. */
const shouldApply = (
  existing: { readonly at: number; readonly nodeId: string } | null,
  incoming: { readonly at: number; readonly nodeId: string },
): boolean =>
  existing === null ? true : comparePrecedence(incoming, existing) > 0

// ─── Folders (event payload → next state) ───────────────────────────────────

/**
 * Apply a SchemaRegistered payload. Skips out-of-order events per the
 * precedence rule. Preserves any existing deprecation marker (so a late
 * re-registration after deprecation doesn't un-deprecate).
 */
export const onSchemaRegistered = (
  state: RegistryState,
  payload: {
    schemaId: string
    version: string
    schemaDocument: unknown
    registeredAt: number
    originNodeId: string
    description?: string | undefined
  },
): RegistryState => {
  const key = `${payload.schemaId}@${payload.version}`
  const existing = state.schemas.get(key)
  const existingPrec = existing
    ? { at: existing.registeredAt, nodeId: existing.originNodeId }
    : null
  if (
    !shouldApply(existingPrec, {
      at: payload.registeredAt,
      nodeId: payload.originNodeId,
    })
  ) {
    return state
  }
  const next = new Map(state.schemas)
  next.set(
    key,
    SchemaEntry.make({
      schemaId: payload.schemaId,
      version: payload.version,
      schemaDocument: payload.schemaDocument,
      registeredAt: payload.registeredAt,
      originNodeId: payload.originNodeId,
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      deprecated: existing?.deprecated ?? null,
    }),
  )
  return {
    ...state,
    schemas: next,
    revision: state.revision + 1,
    asOfMs: Math.max(state.asOfMs ?? 0, payload.registeredAt),
  }
}

export const onSchemaDeprecated = (
  state: RegistryState,
  payload: {
    schemaId: string
    version: string
    successor: string | null
    deprecatedAt: number
    reason: string
    originNodeId: string
  },
): RegistryState => {
  const key = `${payload.schemaId}@${payload.version}`
  const existing = state.schemas.get(key)
  if (existing === undefined) return state
  // Only apply if this deprecation is newer than any existing one.
  const existingPrec = existing.deprecated
    ? { at: existing.deprecated.at, nodeId: existing.deprecated.originNodeId }
    : null
  if (
    !shouldApply(existingPrec, {
      at: payload.deprecatedAt,
      nodeId: payload.originNodeId,
    })
  ) {
    return state
  }
  const next = new Map(state.schemas)
  next.set(
    key,
    SchemaEntry.make({
      ...existing,
      deprecated: Deprecation.make({
        at: payload.deprecatedAt,
        successor: payload.successor,
        reason: payload.reason,
        originNodeId: payload.originNodeId,
      }),
    }),
  )
  return {
    ...state,
    schemas: next,
    revision: state.revision + 1,
    asOfMs: Math.max(state.asOfMs ?? 0, payload.deprecatedAt),
  }
}

export const onOperationRegistered = (
  state: RegistryState,
  payload: {
    name: string
    version: string
    kind: "pure" | "query" | "mutation" | "stream" | "duplex"
    inputSchemaId: string
    outputSchemaId: string
    errorSchemaIds: ReadonlyArray<string>
    registeredAt: number
    originNodeId: string
    description?: string | undefined
  },
): RegistryState => {
  const key = `${payload.name}@${payload.version}`
  const existing = state.operations.get(key)
  const existingPrec = existing
    ? { at: existing.registeredAt, nodeId: existing.originNodeId }
    : null
  if (
    !shouldApply(existingPrec, {
      at: payload.registeredAt,
      nodeId: payload.originNodeId,
    })
  ) {
    return state
  }
  const next = new Map(state.operations)
  next.set(
    key,
    OperationEntry.make({
      name: payload.name,
      version: payload.version,
      kind: payload.kind,
      inputSchemaId: payload.inputSchemaId,
      outputSchemaId: payload.outputSchemaId,
      errorSchemaIds: payload.errorSchemaIds,
      registeredAt: payload.registeredAt,
      originNodeId: payload.originNodeId,
      ...(payload.description !== undefined
        ? { description: payload.description }
        : {}),
      deprecated: existing?.deprecated ?? null,
    }),
  )
  return {
    ...state,
    operations: next,
    revision: state.revision + 1,
    asOfMs: Math.max(state.asOfMs ?? 0, payload.registeredAt),
  }
}

export const onOperationDeprecated = (
  state: RegistryState,
  payload: {
    name: string
    version: string
    successor: string | null
    deprecatedAt: number
    reason: string
    originNodeId: string
  },
): RegistryState => {
  const key = `${payload.name}@${payload.version}`
  const existing = state.operations.get(key)
  if (existing === undefined) return state
  const existingPrec = existing.deprecated
    ? { at: existing.deprecated.at, nodeId: existing.deprecated.originNodeId }
    : null
  if (
    !shouldApply(existingPrec, {
      at: payload.deprecatedAt,
      nodeId: payload.originNodeId,
    })
  ) {
    return state
  }
  const next = new Map(state.operations)
  next.set(
    key,
    OperationEntry.make({
      ...existing,
      deprecated: Deprecation.make({
        at: payload.deprecatedAt,
        successor: payload.successor,
        reason: payload.reason,
        originNodeId: payload.originNodeId,
      }),
    }),
  )
  return {
    ...state,
    operations: next,
    revision: state.revision + 1,
    asOfMs: Math.max(state.asOfMs ?? 0, payload.deprecatedAt),
  }
}

// ─── Read helpers ──────────────────────────────────────────────────────────

/**
 * Translate the registry's `asOfMs` to ISO-8601 (or null for empty).
 *
 * Allocates one Date per call; cache at higher layers if hot.
 */
export const asOfIso = (state: RegistryState): string | null =>
  state.asOfMs === null ? null : new Date(state.asOfMs).toISOString()
