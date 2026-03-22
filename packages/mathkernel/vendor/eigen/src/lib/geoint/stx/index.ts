/**
 * GEOINT stx Module
 *
 * Entity lifecycle state management — one stx per entity instance.
 * Combines XState machine (lifecycle), Legend-State (data), and
 * Fermion (trait atoms) into a unified per-entity state surface.
 *
 * @module geoint/stx
 */

// Machine
export { entityMachine, type EntityMachineContext, type EntityMachineEvent } from './entity-machine'

// Entity stx factory + store
export {
  createEntityStx,
  spawnEntity,
  getEntityStx,
  despawnEntity,
  getSpawnedEntityIds,
  getAllEntityStx,
  clearAllEntities,
  entityCount,
  spawnedEntityIdsAtom,
  entityCountAtom,
  syncEntityAtoms,
  type EntityStx,
  type EntityData,
  type SpawnEntityInput,
} from './entity-stx'

// Entity operations (high-level commands)
export {
  selectEntity,
  toggleEntitySelection,
  hoverEntity,
  toggleEntityPin,
  spawnFromSearchResult,
  batchSpawnFromSearch,
  startTracking,
  stopTracking,
  getEntitySummary,
  getAllEntitySummaries,
  getEntitiesByType,
  getEntitiesInBounds,
  selectedEntityIdAtom,
  selectedEntityIdsAtom,
  hoveredEntityIdAtom,
} from './entity-ops'
