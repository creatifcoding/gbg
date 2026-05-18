/**
 * In-memory implementation of the `Registry` service.
 *
 * Wires the Registry shape to a `Ref<RegistryState>` updated by
 * EventLog handlers folding the registry's event log. Persistence is
 * via `EventJournal.layerMemory` — events live for the process lifetime.
 *
 * This is the test/dev default. Production uses SQL-backed EventJournal
 * (a future layer module).
 *
 * @module @tmnl/pct/registry/Memory
 */

import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as Ref from "effect-v4/Ref"
import * as EventJournal from "effect-v4/unstable/eventlog/EventJournal"
import * as EventLog from "effect-v4/unstable/eventlog/EventLog"
import * as EventLogEncryption from "effect-v4/unstable/eventlog/EventLogEncryption"

import { Registry } from "./Registry.js"
import { RegistryGroup } from "./RegistryEvents.js"
import {
  empty,
  onOperationDeprecated,
  onOperationRegistered,
  onSchemaDeprecated,
  onSchemaRegistered,
  type RegistryState,
} from "./RegistryState.js"

const schema = EventLog.schema(RegistryGroup)

// ─── EventLog handler layer ────────────────────────────────────────────────

/**
 * The handler layer folds registry events into the materialized state ref.
 * Internal — exposed for `layer` composition.
 */
const handlerLayer = (stateRef: Ref.Ref<RegistryState>) =>
  EventLog.group(RegistryGroup, (handlers) =>
    handlers
      .handle("SchemaRegistered", ({ payload }) =>
        Ref.update(stateRef, (s) => onSchemaRegistered(s, payload)),
      )
      .handle("SchemaDeprecated", ({ payload }) =>
        Ref.update(stateRef, (s) => onSchemaDeprecated(s, payload)),
      )
      .handle("OperationRegistered", ({ payload }) =>
        Ref.update(stateRef, (s) =>
          onOperationRegistered(s, {
            ...payload,
            errorSchemaIds: [...payload.errorSchemaIds],
          }),
        ),
      )
      .handle("OperationDeprecated", ({ payload }) =>
        Ref.update(stateRef, (s) => onOperationDeprecated(s, payload)),
      ),
  ).pipe(Layer.provide(EventLog.layerRegistry))

// ─── Registry implementation ───────────────────────────────────────────────

const makeImpl = (stateRef: Ref.Ref<RegistryState>) =>
  Registry.of({
    snapshot: Ref.get(stateRef),

    getSchema: (schemaId) =>
      Effect.map(Ref.get(stateRef), (s) => s.schemas.get(schemaId)),

    getOperation: (schemaId) =>
      Effect.map(Ref.get(stateRef), (s) => s.operations.get(schemaId)),

    listSchemas: (filter) =>
      Effect.map(Ref.get(stateRef), (s) => filterSchemas(s, filter)),

    listOperations: (filter) =>
      Effect.map(Ref.get(stateRef), (s) => filterOperations(s, filter)),

    deltaSince: (fromRevision) =>
      Effect.map(Ref.get(stateRef), (s) =>
        s.changelog.filter((change) => change.revision > fromRevision),
      ),

    revision: Effect.map(Ref.get(stateRef), (s) => s.revision),
  })

const filterSchemas = (
  state: RegistryState,
  filter: { schemaId?: string; includeDeprecated?: boolean } | undefined,
): ReadonlyArray<
  RegistryState["schemas"] extends ReadonlyMap<string, infer V> ? V : never
> => {
  const all = Array.from(state.schemas.values())
  return all.filter((entry) => {
    if (filter?.schemaId !== undefined && entry.schemaId !== filter.schemaId) {
      return false
    }
    if (filter?.includeDeprecated !== true && entry.deprecated !== null) {
      return false
    }
    return true
  })
}

const filterOperations = (
  state: RegistryState,
  filter: { name?: string; includeDeprecated?: boolean } | undefined,
): ReadonlyArray<
  RegistryState["operations"] extends ReadonlyMap<string, infer V> ? V : never
> => {
  const all = Array.from(state.operations.values())
  return all.filter((entry) => {
    if (filter?.name !== undefined && entry.name !== filter.name) {
      return false
    }
    if (filter?.includeDeprecated !== true && entry.deprecated !== null) {
      return false
    }
    return true
  })
}

// ─── Layers ────────────────────────────────────────────────────────────────

/**
 * Registry layer requiring external journal + identity.
 *
 * Provides:
 *   - `Registry`            — read surface (snapshot, getSchema, list*)
 *   - `EventLog.EventLog`   — write surface (used by publish helpers)
 *
 * Requires (from outside):
 *   - `EventLog.Identity`        — the node's keypair
 *   - `EventJournal.EventJournal` — the persistence substrate
 *
 * Use this for production composition, where the identity is shared
 * with `Pact.Identity` (so Notary's `originNodeId` matches the
 * cryptographic identity that signs events).
 *
 * Typical composition:
 *
 *   ```ts
 *   const App = SomeServiceLayer.pipe(
 *     Layer.provide(Registry.layer),                  // Registry + EventLog
 *     Layer.provide(EventJournal.layerMemory),        // Journal substrate
 *     Layer.provide(Identity.layerEphemeral),         // Pact.Identity + EventLog.Identity
 *   )
 *   ```
 */
export const layer = Layer.unwrap(
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<RegistryState>(empty())
    const registryLayer = Layer.succeed(Registry, makeImpl(stateRef))
    const logLayer = EventLog.layer(schema, handlerLayer(stateRef))
    return Layer.merge(registryLayer, logLayer)
  }),
)

/**
 * Self-contained Registry layer for tests. Provides Registry +
 * EventLog with a fresh internal `EventLog.Identity` and an
 * in-memory `EventJournal`.
 *
 * Use this when the caller doesn't need Pact.Identity (e.g. low-level
 * EventLog.write tests). For production composition or Notary tests,
 * use `Registry.layer` + provide identity/journal externally.
 */
const internalIdentityLayer = Layer.effect(
  EventLog.Identity,
  EventLog.makeIdentity,
).pipe(Layer.provide(EventLogEncryption.layerSubtle))

export const layerMemory = layer.pipe(
  Layer.provide(EventJournal.layerMemory),
  Layer.provide(internalIdentityLayer),
)
