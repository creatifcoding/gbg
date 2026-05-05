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
 * Identity layer: a freshly-generated keypair via WebCrypto.
 * Suitable for tests and ephemeral nodes; production should use a
 * persistent identity layer.
 */
const identityLayer = Layer.effect(EventLog.Identity, EventLog.makeIdentity).pipe(
  Layer.provide(EventLogEncryption.layerSubtle),
)

/**
 * The full Registry layer backed by an in-memory event journal and a
 * fresh identity. Provides:
 *   - `Registry` (read surface — what consumers `yield*`)
 *   - `EventLog.EventLog` (write surface — what publishers use)
 *   - `EventLog.Registry` (EventLog's internal handler registry)
 *   - `EventLog.Identity` (this node's identity)
 *
 * Consumers that need to write events (e.g. the publish endpoint)
 * `yield* EventLog.EventLog` and call `log.write({ schema, event, payload })`.
 * Consumers that need to read state `yield* Registry` and call
 * `getSchema`, `listOperations`, etc.
 *
 * The provided-types union is left to inference so additional services
 * required by EventLog (Identity, internal Registry) flow through cleanly.
 */
export const layerMemory = Layer.unwrap(
  Effect.gen(function* () {
    const stateRef = yield* Ref.make<RegistryState>(empty())
    const registryLayer = Layer.succeed(Registry, makeImpl(stateRef))
    const logLayer = EventLog.layer(schema, handlerLayer(stateRef)).pipe(
      Layer.provide(EventJournal.layerMemory),
      Layer.provide(identityLayer),
    )
    return Layer.merge(registryLayer, logLayer)
  }),
)
