/**
 * @tmnl/pct/registry — Registry service hierarchy.
 *
 * The registry's read surface is the `Registry` service. Writes go
 * through `EventLog.write` directly (publishers see the registry as an
 * EventLog of registry events; consumers see it as a queryable Registry).
 *
 * @module @tmnl/pct/registry
 */

export { Registry, type RegistryShape } from "./Registry.js"

export {
  type RegistryState,
  Deprecation,
  OperationEntry,
  SchemaEntry,
  empty as emptyRegistryState,
  onOperationDeprecated,
  onOperationRegistered,
  onSchemaDeprecated,
  onSchemaRegistered,
} from "./RegistryState.js"

export type { Deprecation as DeprecationType } from "./RegistryState.js"

export {
  OperationDeprecatedPayload,
  OperationRegisteredPayload,
  RegistryGroup,
  SchemaDeprecatedPayload,
  SchemaRegisteredPayload,
} from "./RegistryEvents.js"

export { layerMemory } from "./Memory.js"
