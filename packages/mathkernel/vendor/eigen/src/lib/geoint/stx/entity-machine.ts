/**
 * Entity Lifecycle State Machine
 *
 * Governs the lifecycle of a GEOINT entity:
 *   spawning → hydrated → live → stale → despawned
 *
 * Machine is a minimal coordinator:
 *   - Validates transitions (guards)
 *   - Routes lifecycle events
 *   - UI state (select/hover/pin) is NOT managed here — direct Legend-State mutations
 *
 * @module geoint/stx/entity-machine
 */

import { setup, assign } from 'xstate'
import type { GeointEntityType } from '../kori/search-result-mapper'

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

export interface EntityMachineContext {
  /** Unique entity identifier (e.g. 'flight:abc123') */
  readonly entityId: string
  /** Entity type discriminator */
  readonly entityType: GeointEntityType
  /** Trait IDs currently populated for this entity */
  readonly traitIds: readonly string[]
  /** Timestamp of last data update */
  readonly lastUpdated: number
  /** Timestamp when entity was spawned */
  readonly spawnedAt: number
  /** TTL in ms — entity goes stale after this idle period */
  readonly ttlMs: number
  /** Error message if any operation failed */
  readonly error: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Events
// ─────────────────────────────────────────────────────────────────────────────

export type EntityMachineEvent =
  | { readonly type: 'HYDRATE'; readonly traitIds: readonly string[] }
  | { readonly type: 'START_TRACKING' }
  | { readonly type: 'STOP_TRACKING' }
  | { readonly type: 'DATA_UPDATE'; readonly traitIds?: readonly string[] }
  | { readonly type: 'MARK_STALE' }
  | { readonly type: 'REFRESH' }
  | { readonly type: 'DESPAWN' }
  | { readonly type: 'ERROR'; readonly message: string }

// ─────────────────────────────────────────────────────────────────────────────
// TTL defaults per entity type
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_TTL: Record<GeointEntityType, number> = {
  flight: 30_000,    // 30s — fast-moving
  track: 60_000,     // 1min — periodic updates
  poi: 3_600_000,    // 1hr — mostly static
  weather: 900_000,  // 15min — weather updates
  imagery: 86_400_000, // 24hr — static captures
  feature: 86_400_000, // 24hr — static features
}

// ─────────────────────────────────────────────────────────────────────────────
// Machine Definition
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entity lifecycle machine.
 *
 * States:
 *   spawning   — entity created, awaiting trait hydration
 *   hydrated   — traits populated, not actively tracked
 *   live       — receiving real-time data stream updates
 *   stale      — TTL exceeded without update, needs refresh or despawn
 *   despawned  — terminal, entity removed from store
 *   errored    — recoverable error state, can retry
 */
export const entityMachine = setup({
  types: {
    context: {} as EntityMachineContext,
    events: {} as EntityMachineEvent,
  },
  guards: {
    /** Entity has position data (required for tracking) */
    hasPosition: ({ context }) =>
      context.traitIds.includes('GeoPosition') || context.traitIds.includes('GeoPosition3D'),

    /** Entity type supports live tracking */
    isTrackable: ({ context }) =>
      context.entityType === 'flight' || context.entityType === 'track',

    /** TTL exceeded since last update */
    isExpired: ({ context }) =>
      Date.now() - context.lastUpdated > context.ttlMs,
  },
  actions: {
    recordUpdate: assign({
      lastUpdated: () => Date.now(),
    }),
    mergeTraits: assign({
      traitIds: ({ context, event }) => {
        if (event.type === 'HYDRATE') {
          // Union of existing + new trait IDs
          const set = new Set([...context.traitIds, ...event.traitIds])
          return Array.from(set)
        }
        if (event.type === 'DATA_UPDATE' && event.traitIds) {
          const set = new Set([...context.traitIds, ...event.traitIds])
          return Array.from(set)
        }
        return context.traitIds
      },
      lastUpdated: () => Date.now(),
    }),
    recordError: assign({
      error: ({ event }) =>
        event.type === 'ERROR' ? event.message : null,
    }),
    clearError: assign({
      error: () => null,
    }),
  },
}).createMachine({
  id: 'geoint-entity',
  initial: 'spawning',
  context: ({ input }: { input: { entityId: string; entityType: GeointEntityType } }) => ({
    entityId: input.entityId,
    entityType: input.entityType,
    traitIds: [],
    lastUpdated: Date.now(),
    spawnedAt: Date.now(),
    ttlMs: DEFAULT_TTL[input.entityType] ?? 60_000,
    error: null,
  }),
  states: {
    spawning: {
      on: {
        HYDRATE: {
          target: 'hydrated',
          actions: 'mergeTraits',
        },
        DESPAWN: 'despawned',
        ERROR: {
          target: 'errored',
          actions: 'recordError',
        },
      },
    },

    hydrated: {
      on: {
        START_TRACKING: {
          target: 'live',
          guard: { type: 'hasPosition' },
        },
        DATA_UPDATE: {
          target: 'hydrated',
          actions: 'mergeTraits',
        },
        HYDRATE: {
          target: 'hydrated',
          actions: 'mergeTraits',
        },
        MARK_STALE: 'stale',
        DESPAWN: 'despawned',
        ERROR: {
          target: 'errored',
          actions: 'recordError',
        },
      },
    },

    live: {
      on: {
        DATA_UPDATE: {
          target: 'live',
          actions: 'mergeTraits',
        },
        STOP_TRACKING: 'hydrated',
        MARK_STALE: 'stale',
        DESPAWN: 'despawned',
        ERROR: {
          target: 'errored',
          actions: 'recordError',
        },
      },
    },

    stale: {
      on: {
        REFRESH: {
          target: 'hydrated',
          actions: ['clearError', 'recordUpdate'],
        },
        START_TRACKING: {
          target: 'live',
          guard: { type: 'hasPosition' },
          actions: ['clearError', 'recordUpdate'],
        },
        DATA_UPDATE: {
          target: 'hydrated',
          actions: 'mergeTraits',
        },
        HYDRATE: {
          target: 'hydrated',
          actions: 'mergeTraits',
        },
        DESPAWN: 'despawned',
      },
    },

    errored: {
      on: {
        REFRESH: {
          target: 'hydrated',
          actions: ['clearError', 'recordUpdate'],
        },
        HYDRATE: {
          target: 'hydrated',
          actions: ['clearError', 'mergeTraits'],
        },
        DESPAWN: 'despawned',
      },
    },

    despawned: {
      type: 'final',
    },
  },
})

export type EntityMachine = typeof entityMachine
