/**
 * Registry — the live, queryable view of the registry's materialized state.
 *
 * `Registry` is a `Context.Service` that exposes pure-read methods over
 * the materialized `RegistryState`. Writes go through `EventLog.write`
 * (which fires the registry events handled by the layer); the resulting
 * state mutation is observable here on the next read.
 *
 * # Service hierarchy (per `PCT.md` Implementation §)
 *
 *   Registry            ← this service, the read surface
 *   ├── EventLog        ← write surface (effect/unstable/eventlog)
 *   ├── EventJournal    ← persistence (memory or SQL)
 *   ├── Identity        ← node identity for federation/signing
 *   └── EventLogRemote  ← peer sync (federated registries; Phase 3.6)
 *
 * Implementations are provided by per-storage layer modules
 * (`Registry.layerMemory`, `Registry.layerSqlite` (future)).
 *
 * # Consistency
 *
 * `snapshot` is the authoritative read for cross-cutting state — it
 * returns the entire `RegistryState` atomically (one Ref.get). Use it
 * when you need a coherent view across schemas + operations + revision
 * (e.g. constructing a Manifest). The per-method getters
 * (`getSchema`, `listSchemas`, etc.) each do their own read; concurrent
 * mutations between calls may surface inconsistent data.
 *
 * @module @tmnl/pct/registry/Registry
 */

import * as Context from "effect-v4/Context"
import type * as Effect from "effect-v4/Effect"

import type {
  OperationEntry,
  RegistryState,
  SchemaEntry,
} from "./RegistryState.js"

// ─── Service shape ──────────────────────────────────────────────────────────

export interface RegistryShape {
  /**
   * Atomic snapshot of the entire registry state. Single read; coherent
   * across schemas, operations, revision, and asOf.
   *
   * Prefer `snapshot` over per-method reads when you need cross-cutting
   * consistency (manifests, federation diff, etc.).
   */
  readonly snapshot: Effect.Effect<RegistryState>

  /**
   * Look up a schema by Schema-Id (`{schemaId}@{version}`). Returns
   * `undefined` if not registered.
   */
  readonly getSchema: (schemaId: string) => Effect.Effect<SchemaEntry | undefined>

  /**
   * Look up an operation by Schema-Id (`{name}@{version}`).
   */
  readonly getOperation: (
    schemaId: string,
  ) => Effect.Effect<OperationEntry | undefined>

  /**
   * List all schemas, optionally filtered to a base schemaId
   * (returns all versions of that schema).
   */
  readonly listSchemas: (filter?: {
    readonly schemaId?: string
    readonly includeDeprecated?: boolean
  }) => Effect.Effect<ReadonlyArray<SchemaEntry>>

  /**
   * List all operations, optionally filtered.
   */
  readonly listOperations: (filter?: {
    readonly name?: string
    readonly includeDeprecated?: boolean
  }) => Effect.Effect<ReadonlyArray<OperationEntry>>

  /**
   * The current registry revision. Monotonic; clients can use this for
   * conditional fetches via `If-Revision` (informative).
   */
  readonly revision: Effect.Effect<number>
}

// ─── Service tag ────────────────────────────────────────────────────────────

/**
 * The Registry service. Implementations are provided by per-storage
 * layers (`Registry.layerMemory`, etc.). Consumers `yield* Registry`
 * to access the read surface.
 */
export class Registry extends Context.Service<Registry, RegistryShape>()(
  "@tmnl/pct/registry/Registry",
) {}
