/**
 * Entity stx Factory — one stx per GEOINT entity instance
 *
 * Each entity (flight, track, POI, etc.) gets its own stx with:
 *   - Machine: entity lifecycle (spawning → hydrated → live → stale → despawned)
 *   - Data: Legend-State observable with core entity fields + computed accessors
 *   - Effects: Fermion hydrate/refresh operations wired through stx.effects
 *
 * UI state (select, hover, pin) is direct Legend-State mutation on stx.data — no machine.
 * Lifecycle (spawn, track, despawn) routes through machine events.
 *
 * @module geoint/stx/entity-stx
 */

import { Effect } from 'effect'
import { Atom } from '@effect-atom/atom'
import * as AtomRegistry from '@effect-atom/atom/Registry'
import type { GeointEntityType } from '../kori/search-result-mapper'
import { stx, type StxConfigWithBindings } from '../../stx/stx'
import type { Stx } from '../../stx/types'
import { entityMachine, type EntityMachineContext, type EntityMachineEvent } from './entity-machine'
import {
  traitRegistry,
  despawnEntityTraits,
  clearAllTraitStores,
  geoPositionFermion,
  uiStateFermion,
} from '../fermion'

// ─────────────────────────────────────────────────────────────────────────────
// Entity Data Shape (Legend-State observable)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Observable data shape for each entity instance.
 *
 * Core identity + frequently-accessed display fields are stored here
 * as Legend-State observables for direct, fast React subscriptions.
 * Full trait data lives in Fermion atoms.
 */
export interface EntityData {
  /** Unique entity identifier (e.g. 'flight:abc123') */
  readonly entityId: string
  /** Entity type */
  readonly entityType: GeointEntityType
  /** Human-readable display label */
  displayLabel: string
  /** Category/sub-type label */
  category: string
  /** Canonical source ID when known (opensky, osm, openmeteo, etc.) */
  source: string | null

  // ── UI State (direct mutation, not through machine) ──
  selected: boolean
  hovered: boolean
  pinned: boolean
  expanded: boolean
  highlighted: boolean
  viewed: boolean

  // ── Position snapshot (synced from Fermion for quick rendering) ──
  longitude: number
  latitude: number
  altitude: number | null

  // ── Timestamps ──
  lastUpdated: number
  spawnedAt: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity stx Type
// ─────────────────────────────────────────────────────────────────────────────

export type EntityStx = Stx<
  typeof entityMachine,
  EntityData,
  EntityEffects,
  EntityComputed
>

// ─────────────────────────────────────────────────────────────────────────────
// Effects
// ─────────────────────────────────────────────────────────────────────────────

interface EntityEffects {
  /** Hydrate entity with trait data from search result / API response */
  hydrate: Effect.Effect<void, never, never>
  /** Refresh stale trait data */
  refresh: Effect.Effect<void, never, never>
  /** Despawn entity — cleanup all trait stores */
  despawn: Effect.Effect<void, never, never>
}

// ─────────────────────────────────────────────────────────────────────────────
// Computed
// ─────────────────────────────────────────────────────────────────────────────

interface EntityComputed {
  /** Is entity currently in a live tracking state? */
  isLive: boolean
  /** Is entity stale (TTL exceeded)? */
  isStale: boolean
  /** Trait names currently populated */
  traitNames: string[]
  /** Can this entity be tracked (has position + trackable type)? */
  isTrackable: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory Input
// ─────────────────────────────────────────────────────────────────────────────

export interface SpawnEntityInput {
  /** Unique entity identifier */
  entityId: string
  /** Entity type discriminator */
  entityType: GeointEntityType
  /** Human-readable display label */
  displayLabel: string
  /** Category/sub-type */
  category?: string
  /** Canonical source ID when known */
  source?: string
  /** Initial position (if known) */
  position?: {
    longitude: number
    latitude: number
    altitude?: number | null
  }
  /** Initial trait data to populate (trait name → data) */
  traits?: Record<string, unknown>
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity stx Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new entity stx instance.
 *
 * One call per entity spawn. Returns a fully-wired stx with:
 * - Machine: entity lifecycle
 * - Data: Legend-State observable with core fields + UI state
 * - Effects: Fermion hydrate/refresh/despawn
 * - Computed: derived state atoms
 */
export function createEntityStx(input: SpawnEntityInput): EntityStx {
  const {
    entityId,
    entityType,
    displayLabel,
    category = entityType,
    source,
    position,
    traits,
  } = input

  const now = Date.now()

  // ── Initial data ──
  const initialData: EntityData = {
    entityId,
    entityType,
    displayLabel,
    category,
    source: source ?? null,
    selected: false,
    hovered: false,
    pinned: false,
    expanded: false,
    highlighted: false,
    viewed: false,
    longitude: position?.longitude ?? 0,
    latitude: position?.latitude ?? 0,
    altitude: position?.altitude ?? null,
    lastUpdated: now,
    spawnedAt: now,
  }

  // ── Pre-populate Fermion stores with initial traits ──
  if (traits) {
    for (const [traitName, data] of Object.entries(traits)) {
      const fermion = traitRegistry.get(traitName)
      if (fermion && data) {
        fermion.set(entityId, data as any)
      }
    }
  }

  // Pre-populate UI state Fermion
  uiStateFermion.set(entityId, {
    _tag: 'UIState',
    selected: false,
    hovered: false,
    expanded: false,
    highlighted: false,
    pinned: false,
    viewed: false,
  })

  // Pre-populate position Fermion if given
  if (position) {
    geoPositionFermion.set(entityId, {
      _tag: 'GeoPosition',
      lon: position.longitude,
      lat: position.latitude,
    })
  }

  // ── Trait names initially populated ──
  const initialTraitIds = traits ? Object.keys(traits) : []
  if (position) initialTraitIds.push('GeoPosition')
  initialTraitIds.push('UIState')

  // ── Effects ──
  const effects: EntityEffects = {
    hydrate: Effect.sync(() => {
      // Already populated above. Future: fetch from API
    }),

    refresh: Effect.sync(() => {
      // Future: re-fetch stale traits from source
      // For now, just update timestamp
    }),

    despawn: Effect.sync(() => {
      despawnEntityTraits(entityId)
    }),
  }

  // ── Computed ──
  const computedConfig = {
    isLive: (get: any) => {
      // Check machine state via snapshot — returns true if 'live'
      const snapshot = get.machine?.()
      return snapshot?.value === 'live'
    },
    isStale: (get: any) => {
      const snapshot = get.machine?.()
      return snapshot?.value === 'stale'
    },
    traitNames: (_get: any) => {
      // Read from Fermion registry
      const names: string[] = []
      for (const [name, fermion] of traitRegistry) {
        if (fermion.has(entityId)) names.push(name)
      }
      return names
    },
    isTrackable: (get: any) => {
      const type = get.data.entityType?.get?.() ?? entityType
      return (type === 'flight' || type === 'track') &&
        (get.data.longitude?.get?.() !== 0 || get.data.latitude?.get?.() !== 0)
    },
  } as any

  // ── Create stx ──
  const entityStx = stx({
    machine: entityMachine,
    machineInput: { entityId, entityType },
    data: initialData,
    effects,
    computed: computedConfig,
  }) as unknown as EntityStx

  // ── Immediately hydrate if traits were provided ──
  if (traits && initialTraitIds.length > 0) {
    entityStx.send({ type: 'HYDRATE', traitIds: initialTraitIds })
  }

  return entityStx
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Store — Map<entityId, EntityStx>
// ─────────────────────────────────────────────────────────────────────────────

/** Global entity stx store. One stx per entity instance. */
const entityStxStore = new Map<string, EntityStx>()

/**
 * Spawn a new entity stx and register it in the store.
 * Returns existing stx if entity already spawned.
 */
export function spawnEntity(input: SpawnEntityInput): EntityStx {
  const existing = entityStxStore.get(input.entityId)
  if (existing) return existing

  const entityStx = createEntityStx(input)
  entityStxStore.set(input.entityId, entityStx)
  return entityStx
}

/**
 * Get an entity stx by ID. Returns undefined if not spawned.
 */
export function getEntityStx(entityId: string): EntityStx | undefined {
  return entityStxStore.get(entityId)
}

/**
 * Despawn an entity — send DESPAWN event, cleanup traits, remove from store.
 */
export function despawnEntity(entityId: string): void {
  const entityStx = entityStxStore.get(entityId)
  if (entityStx) {
    entityStx.send({ type: 'DESPAWN' })
    despawnEntityTraits(entityId)
    entityStxStore.delete(entityId)
  }
}

/**
 * Get all spawned entity IDs.
 */
export function getSpawnedEntityIds(): string[] {
  return Array.from(entityStxStore.keys())
}

/**
 * Get all spawned entity stx instances.
 */
export function getAllEntityStx(): Map<string, EntityStx> {
  return entityStxStore
}

/**
 * Clear all entities (full reset).
 */
export function clearAllEntities(): void {
  for (const [entityId, entityStx] of entityStxStore) {
    entityStx.send({ type: 'DESPAWN' })
  }
  entityStxStore.clear()
  // Also clear fermion trait stores
  clearAllTraitStores()
}

/**
 * Count of spawned entities.
 */
export function entityCount(): number {
  return entityStxStore.size
}

// ─────────────────────────────────────────────────────────────────────────────
// Atom-as-State: Reactive entity list for React
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shared registry for GEOINT entity state atoms.
 *
 * We keep this registry module-scoped so imperative operations (spawn/despawn,
 * select/hover) and React readers observe the same atom graph.
 */
export const geointEntityRegistry = AtomRegistry.make()

/**
 * Reactive atom tracking spawned entity IDs.
 * Updated by spawn/despawn operations.
 */
export const spawnedEntityIdsAtom = Atom.make<readonly string[]>([])

/**
 * Reactive atom tracking entity count.
 */
export const entityCountAtom = Atom.make<number>(0)

/**
 * Sync entity store state to atoms.
 * Call after spawn/despawn for React reactivity.
 */
export function syncEntityAtoms(): void {
  geointEntityRegistry.set(spawnedEntityIdsAtom, Array.from(entityStxStore.keys()))
  geointEntityRegistry.set(entityCountAtom, entityStxStore.size)
}
