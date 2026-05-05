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
 *   └── EventLogRemote  ← peer sync (federated registries)
 *
 * Implementations are provided by per-storage layer modules
 * (`Registry.layerMemory`, `Registry.layerSqlite` (future)).
 *
 * @module @tmnl/pct/registry/Registry
 */

import * as Context from "effect-v4/Context"
import type * as Effect from "effect-v4/Effect"

import type { OperationEntry, SchemaEntry } from "./RegistryState.js"

// ─── Service shape ──────────────────────────────────────────────────────────

export interface RegistryShape {
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

  /**
   * Subscribe to live registry changes. Returns a Stream of registry
   * events as they're applied; useful for clients implementing
   * `/capabilities/stream` or hot-reloading SDKs.
   *
   * (Wired in a later pass — currently a stub returning empty stream.)
   */
  // readonly changes: Stream.Stream<RegistryChange, never, Scope.Scope>
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
