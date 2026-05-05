/**
 * RegistryState — the materialized view folded from RegistryEvents.
 *
 * This is the **live** registry view. It's a pure data structure (no
 * effects) so callers can introspect it cheaply: handlers update a
 * `Ref<RegistryState>` from event handlers, and read paths just call
 * `Ref.get`.
 *
 * @module @tmnl/pct/registry/RegistryState
 */

// ─── Materialized entry types ───────────────────────────────────────────────

export interface SchemaEntry {
  readonly schemaId: string
  readonly version: string
  /** SchemaRepresentation.Document JSON; reconstruct via toSchema. */
  readonly schemaDocument: unknown
  readonly registeredAt: number
  readonly originNodeId: string
  readonly description?: string
  readonly deprecated: {
    readonly at: number
    readonly successor: string | null
    readonly reason: string
    readonly originNodeId: string
  } | null
}

export interface OperationEntry {
  readonly name: string
  readonly version: string
  readonly kind: "pure" | "query" | "mutation" | "stream" | "duplex"
  readonly inputSchemaId: string
  readonly outputSchemaId: string
  readonly errorSchemaIds: ReadonlyArray<string>
  readonly registeredAt: number
  readonly originNodeId: string
  readonly description?: string
  readonly deprecated: {
    readonly at: number
    readonly successor: string | null
    readonly reason: string
    readonly originNodeId: string
  } | null
}

// ─── Aggregate state ────────────────────────────────────────────────────────

export interface RegistryState {
  /** Key: `{schemaId}@{version}`. */
  readonly schemas: ReadonlyMap<string, SchemaEntry>
  /** Key: `{name}@{version}`. */
  readonly operations: ReadonlyMap<string, OperationEntry>
  /** Monotonic revision counter, bumped on every applied event. */
  readonly revision: number
  /** ISO-8601 timestamp of the last applied event. */
  readonly asOf: string | null
}

export const empty = (): RegistryState => ({
  schemas: new Map(),
  operations: new Map(),
  revision: 0,
  asOf: null,
})

// ─── Folders (event payload → next state) ───────────────────────────────────

/**
 * Apply a SchemaRegistered payload to state. Idempotent on duplicate
 * primary key (last-writer-wins: subsequent registrations of the same
 * (schemaId, version) overwrite the entry, preserving deprecation flags).
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
  const next = new Map(state.schemas)
  next.set(key, {
    schemaId: payload.schemaId,
    version: payload.version,
    schemaDocument: payload.schemaDocument,
    registeredAt: payload.registeredAt,
    originNodeId: payload.originNodeId,
    ...(payload.description !== undefined
      ? { description: payload.description }
      : {}),
    deprecated: existing?.deprecated ?? null,
  })
  return {
    ...state,
    schemas: next,
    revision: state.revision + 1,
    asOf: new Date(payload.registeredAt).toISOString(),
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
  const next = new Map(state.schemas)
  next.set(key, {
    ...existing,
    deprecated: {
      at: payload.deprecatedAt,
      successor: payload.successor,
      reason: payload.reason,
      originNodeId: payload.originNodeId,
    },
  })
  return {
    ...state,
    schemas: next,
    revision: state.revision + 1,
    asOf: new Date(payload.deprecatedAt).toISOString(),
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
  const next = new Map(state.operations)
  next.set(key, {
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
  })
  return {
    ...state,
    operations: next,
    revision: state.revision + 1,
    asOf: new Date(payload.registeredAt).toISOString(),
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
  const next = new Map(state.operations)
  next.set(key, {
    ...existing,
    deprecated: {
      at: payload.deprecatedAt,
      successor: payload.successor,
      reason: payload.reason,
      originNodeId: payload.originNodeId,
    },
  })
  return {
    ...state,
    operations: next,
    revision: state.revision + 1,
    asOf: new Date(payload.deprecatedAt).toISOString(),
  }
}
