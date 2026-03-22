/**
 * GEOINT Entity Atoms
 *
 * Atom.family definitions for per-entity reactive state.
 * Entities are connected to live data streams - traits update as data flows.
 *
 * Architecture:
 * - Atom.family for per-entity UI state
 * - Stream subscriptions for data trait updates
 * - Registry-based synchronous access for React callbacks
 * - Effect HashSet for immutable collections
 *
 * @module geoint/kori/entity-atoms
 */

import { HashSet, HashMap, Option, pipe } from 'effect'
import { Atom, Registry, RegistryContext } from '@effect-atom/atom-react'
import type { Writable } from '@effect-atom/atom/Atom'
import React from 'react'

import type { GeointEntityType } from './search-result-mapper'

// ─────────────────────────────────────────────────────────────────────────────
// Module-level Registry (Singleton)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GEOINT entity registry for synchronous atom access.
 * Use registry.get()/set() in React callbacks.
 * Use Atom.get()/set() in Effect.gen().
 */
export const geointRegistry = Registry.make()

/**
 * Provider for GEOINT entity registry.
 * Wrap GEOINT components with this so useAtomValue reads from geointRegistry.
 */
export function GeointRegistryProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return React.createElement(RegistryContext.Provider, { value: geointRegistry as any }, children)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity UI State Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Per-entity UI state (mirrors UIState trait for reactive access).
 */
export interface EntityUIState {
  readonly selected: boolean
  readonly hovered: boolean
  readonly expanded: boolean
  readonly highlighted: boolean
  readonly pinned: boolean
  readonly viewed: boolean
}

/**
 * Default UI state for new entities.
 */
export const DEFAULT_ENTITY_UI_STATE: EntityUIState = {
  selected: false,
  hovered: false,
  expanded: false,
  highlighted: false,
  pinned: false,
  viewed: false,
}

/**
 * Per-entity animation state.
 */
export interface EntityAnimationState {
  readonly phase: 'idle' | 'entering' | 'exiting' | 'morphing' | 'moving' | 'pulsing' | 'highlighting'
  readonly progress: number
  readonly isAnimating: boolean
}

/**
 * Default animation state.
 */
export const DEFAULT_ENTITY_ANIMATION_STATE: EntityAnimationState = {
  phase: 'idle',
  progress: 0,
  isAnimating: false,
}

/**
 * Per-entity position (for map markers, derived from GeoPosition trait).
 */
export interface EntityPosition {
  readonly lon: number
  readonly lat: number
  readonly altitudeM?: number
}

/**
 * Live entity data (updated via streams).
 */
export interface EntityLiveData {
  readonly entityId: string
  readonly entityType: GeointEntityType
  readonly position: EntityPosition
  readonly heading?: number
  readonly speed?: number
  readonly label: string
  readonly lastUpdated: Date
  /** Tracks if entity has live stream connection */
  readonly isLive: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Atom Family Definitions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Atom family cache for entity UI state.
 * Key: entityId
 */
const entityUIStateCache = new Map<string, Writable<EntityUIState, EntityUIState>>()

/**
 * Get or create UI state atom for an entity.
 * This is the Atom.family pattern - one atom per entity.
 */
export function entityUIStateFamily(entityId: string): Writable<EntityUIState, EntityUIState> {
  let atom = entityUIStateCache.get(entityId)
  if (!atom) {
    atom = Atom.make<EntityUIState>(DEFAULT_ENTITY_UI_STATE)
    entityUIStateCache.set(entityId, atom)
  }
  return atom
}

/**
 * Atom family cache for entity animation state.
 */
const entityAnimationCache = new Map<string, Writable<EntityAnimationState, EntityAnimationState>>()

/**
 * Get or create animation state atom for an entity.
 */
export function entityAnimationFamily(entityId: string): Writable<EntityAnimationState, EntityAnimationState> {
  let atom = entityAnimationCache.get(entityId)
  if (!atom) {
    atom = Atom.make<EntityAnimationState>(DEFAULT_ENTITY_ANIMATION_STATE)
    entityAnimationCache.set(entityId, atom)
  }
  return atom
}

/**
 * Atom family cache for entity live data.
 */
const entityLiveDataCache = new Map<string, Writable<EntityLiveData | null, EntityLiveData | null>>()

/**
 * Get or create live data atom for an entity.
 * Returns null if entity hasn't been hydrated yet.
 */
export function entityLiveDataFamily(entityId: string): Writable<EntityLiveData | null, EntityLiveData | null> {
  let atom = entityLiveDataCache.get(entityId)
  if (!atom) {
    atom = Atom.make<EntityLiveData | null>(null)
    entityLiveDataCache.set(entityId, atom)
  }
  return atom
}

// ─────────────────────────────────────────────────────────────────────────────
// Selection Management (HashSet for immutable collections)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set of currently selected entity IDs.
 */
export const selectedEntityIds = Atom.make(HashSet.empty<string>())

/**
 * Currently hovered entity ID (single).
 */
export const hoveredEntityId = Atom.make(Option.none<string>())

/**
 * Set of pinned entity IDs (persist across searches).
 */
export const pinnedEntityIds = Atom.make(HashSet.empty<string>())

/**
 * Set of currently visible entity IDs (in viewport).
 */
export const visibleEntityIds = Atom.make(HashSet.empty<string>())

/**
 * Set of entity IDs with active streams.
 */
export const liveEntityIds = Atom.make(HashSet.empty<string>())

/**
 * All known entity IDs → entity type mapping.
 */
export const entityTypeMap = Atom.make(HashMap.empty<string, GeointEntityType>())

// ─────────────────────────────────────────────────────────────────────────────
// Operations (Synchronous via Registry)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Entity atom operations for synchronous React callbacks.
 */
export const entityOps = {
  // ─────────────────────────────────────────────────────────────────────────
  // Selection
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Select an entity (adds to selection).
   */
  select: (entityId: string) => {
    // Update global selection set
    geointRegistry.update(selectedEntityIds, (ids) => HashSet.add(ids, entityId))

    // Update entity's UI state atom
    const uiAtom = entityUIStateFamily(entityId)
    geointRegistry.update(uiAtom, (state) => ({ ...state, selected: true }))
  },

  /**
   * Deselect an entity.
   */
  deselect: (entityId: string) => {
    geointRegistry.update(selectedEntityIds, (ids) => HashSet.remove(ids, entityId))

    const uiAtom = entityUIStateFamily(entityId)
    geointRegistry.update(uiAtom, (state) => ({ ...state, selected: false }))
  },

  /**
   * Toggle selection state.
   */
  toggleSelect: (entityId: string) => {
    const uiAtom = entityUIStateFamily(entityId)
    const current = geointRegistry.get(uiAtom)
    if (current.selected) {
      entityOps.deselect(entityId)
    } else {
      entityOps.select(entityId)
    }
  },

  /**
   * Select only this entity (clear others).
   */
  selectOnly: (entityId: string) => {
    // Clear all existing selections
    const currentIds = geointRegistry.get(selectedEntityIds)
    HashSet.forEach(currentIds, (id) => {
      const uiAtom = entityUIStateFamily(id)
      geointRegistry.update(uiAtom, (state) => ({ ...state, selected: false }))
    })

    // Select only this one
    geointRegistry.set(selectedEntityIds, HashSet.make(entityId))
    const uiAtom = entityUIStateFamily(entityId)
    geointRegistry.update(uiAtom, (state) => ({ ...state, selected: true }))
  },

  /**
   * Clear all selections.
   */
  clearSelection: () => {
    const currentIds = geointRegistry.get(selectedEntityIds)
    HashSet.forEach(currentIds, (id) => {
      const uiAtom = entityUIStateFamily(id)
      geointRegistry.update(uiAtom, (state) => ({ ...state, selected: false }))
    })
    geointRegistry.set(selectedEntityIds, HashSet.empty<string>())
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Hover
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Set hovered entity.
   */
  hover: (entityId: string) => {
    // Clear previous hover
    const prevId = geointRegistry.get(hoveredEntityId)
    pipe(
      prevId,
      Option.filter((id) => id !== entityId),
      Option.map((id) => {
        const prevAtom = entityUIStateFamily(id)
        geointRegistry.update(prevAtom, (state) => ({ ...state, hovered: false }))
      })
    )

    // Set new hover
    geointRegistry.set(hoveredEntityId, Option.some(entityId))
    const uiAtom = entityUIStateFamily(entityId)
    geointRegistry.update(uiAtom, (state) => ({ ...state, hovered: true }))
  },

  /**
   * Clear hover state.
   */
  unhover: (entityId?: string) => {
    const currentId = geointRegistry.get(hoveredEntityId)

    pipe(
      currentId,
      Option.filter((id) => !entityId || id === entityId),
      Option.map((id) => {
        const uiAtom = entityUIStateFamily(id)
        geointRegistry.update(uiAtom, (state) => ({ ...state, hovered: false }))
        geointRegistry.set(hoveredEntityId, Option.none<string>())
      })
    )
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Pin
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Pin an entity (persists across searches).
   */
  pin: (entityId: string) => {
    geointRegistry.update(pinnedEntityIds, (ids) => HashSet.add(ids, entityId))
    const uiAtom = entityUIStateFamily(entityId)
    geointRegistry.update(uiAtom, (state) => ({ ...state, pinned: true }))
  },

  /**
   * Unpin an entity.
   */
  unpin: (entityId: string) => {
    geointRegistry.update(pinnedEntityIds, (ids) => HashSet.remove(ids, entityId))
    const uiAtom = entityUIStateFamily(entityId)
    geointRegistry.update(uiAtom, (state) => ({ ...state, pinned: false }))
  },

  /**
   * Toggle pin state.
   */
  togglePin: (entityId: string) => {
    const uiAtom = entityUIStateFamily(entityId)
    const current = geointRegistry.get(uiAtom)
    if (current.pinned) {
      entityOps.unpin(entityId)
    } else {
      entityOps.pin(entityId)
    }
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Expand/Collapse
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Expand entity details.
   */
  expand: (entityId: string) => {
    const uiAtom = entityUIStateFamily(entityId)
    geointRegistry.update(uiAtom, (state) => ({ ...state, expanded: true }))
  },

  /**
   * Collapse entity details.
   */
  collapse: (entityId: string) => {
    const uiAtom = entityUIStateFamily(entityId)
    geointRegistry.update(uiAtom, (state) => ({ ...state, expanded: false }))
  },

  /**
   * Toggle expand state.
   */
  toggleExpand: (entityId: string) => {
    const uiAtom = entityUIStateFamily(entityId)
    geointRegistry.update(uiAtom, (state) => ({ ...state, expanded: !state.expanded }))
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Live Data Updates (from streams)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Update entity live data (called from stream handlers).
   */
  updateLiveData: (entityId: string, data: Partial<EntityLiveData>) => {
    const atom = entityLiveDataFamily(entityId)
    geointRegistry.update(atom, (current) => {
      if (!current) return null
      return {
        ...current,
        ...data,
        lastUpdated: new Date(),
      }
    })
  },

  /**
   * Initialize entity live data (called on spawn).
   */
  initializeLiveData: (data: EntityLiveData) => {
    const atom = entityLiveDataFamily(data.entityId)
    geointRegistry.set(atom, data)

    // Track entity type
    geointRegistry.update(entityTypeMap, (map) => HashMap.set(map, data.entityId, data.entityType))
  },

  /**
   * Mark entity as having live stream.
   */
  markLive: (entityId: string) => {
    geointRegistry.update(liveEntityIds, (ids) => HashSet.add(ids, entityId))
    const atom = entityLiveDataFamily(entityId)
    geointRegistry.update(atom, (data) => (data ? { ...data, isLive: true } : null))
  },

  /**
   * Mark entity as no longer live.
   */
  markStale: (entityId: string) => {
    geointRegistry.update(liveEntityIds, (ids) => HashSet.remove(ids, entityId))
    const atom = entityLiveDataFamily(entityId)
    geointRegistry.update(atom, (data) => (data ? { ...data, isLive: false } : null))
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Animation
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Start entering animation.
   */
  startEntering: (entityId: string) => {
    const atom = entityAnimationFamily(entityId)
    geointRegistry.set(atom, {
      phase: 'entering',
      progress: 0,
      isAnimating: true,
    })
  },

  /**
   * Start exiting animation.
   */
  startExiting: (entityId: string) => {
    const atom = entityAnimationFamily(entityId)
    geointRegistry.set(atom, {
      phase: 'exiting',
      progress: 0,
      isAnimating: true,
    })
  },

  /**
   * Update animation progress.
   */
  updateAnimationProgress: (entityId: string, progress: number) => {
    const atom = entityAnimationFamily(entityId)
    geointRegistry.update(atom, (state) => ({
      ...state,
      progress: Math.min(1, Math.max(0, progress)),
    }))
  },

  /**
   * Complete animation (return to idle).
   */
  completeAnimation: (entityId: string) => {
    const atom = entityAnimationFamily(entityId)
    geointRegistry.set(atom, DEFAULT_ENTITY_ANIMATION_STATE)
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Dispose an entity's atoms.
   */
  disposeEntity: (entityId: string) => {
    // Remove from caches
    entityUIStateCache.delete(entityId)
    entityAnimationCache.delete(entityId)
    entityLiveDataCache.delete(entityId)

    // Remove from global sets
    geointRegistry.update(selectedEntityIds, (ids) => HashSet.remove(ids, entityId))
    geointRegistry.update(pinnedEntityIds, (ids) => HashSet.remove(ids, entityId))
    geointRegistry.update(visibleEntityIds, (ids) => HashSet.remove(ids, entityId))
    geointRegistry.update(liveEntityIds, (ids) => HashSet.remove(ids, entityId))
    geointRegistry.update(entityTypeMap, (map) => HashMap.remove(map, entityId))

    // Clear hover if this entity
    const currentHover = geointRegistry.get(hoveredEntityId)
    pipe(
      currentHover,
      Option.filter((id) => id === entityId),
      Option.map(() => geointRegistry.set(hoveredEntityId, Option.none<string>()))
    )
  },

  /**
   * Clear all entities (e.g., on new search).
   * Preserves pinned entities.
   */
  clearNonPinned: () => {
    const pinned = geointRegistry.get(pinnedEntityIds)

    // Clear non-pinned from UI state cache
    for (const entityId of entityUIStateCache.keys()) {
      if (!HashSet.has(pinned, entityId)) {
        entityUIStateCache.delete(entityId)
        entityAnimationCache.delete(entityId)
        entityLiveDataCache.delete(entityId)
      }
    }

    // Clear selection (except pinned)
    geointRegistry.update(selectedEntityIds, (ids) =>
      pipe(
        ids,
        HashSet.filter((id) => HashSet.has(pinned, id))
      )
    )

    // Clear live set (except pinned)
    geointRegistry.update(liveEntityIds, (ids) =>
      pipe(
        ids,
        HashSet.filter((id) => HashSet.has(pinned, id))
      )
    )

    // Clear hover if not pinned
    const currentHover = geointRegistry.get(hoveredEntityId)
    pipe(
      currentHover,
      Option.filter((id) => !HashSet.has(pinned, id)),
      Option.map(() => geointRegistry.set(hoveredEntityId, Option.none<string>()))
    )

    // Clear type map except pinned
    geointRegistry.update(entityTypeMap, (map) =>
      pipe(
        map,
        HashMap.filter((_, id) => HashSet.has(pinned, id))
      )
    )
  },

  /**
   * Clear ALL entities (including pinned).
   */
  clearAll: () => {
    entityUIStateCache.clear()
    entityAnimationCache.clear()
    entityLiveDataCache.clear()
    geointRegistry.set(selectedEntityIds, HashSet.empty<string>())
    geointRegistry.set(pinnedEntityIds, HashSet.empty<string>())
    geointRegistry.set(visibleEntityIds, HashSet.empty<string>())
    geointRegistry.set(liveEntityIds, HashSet.empty<string>())
    geointRegistry.set(hoveredEntityId, Option.none<string>())
    geointRegistry.set(entityTypeMap, HashMap.empty<string, GeointEntityType>())
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Queries
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Get entity type for an entity ID.
   */
  getEntityType: (entityId: string): Option.Option<GeointEntityType> => {
    const map = geointRegistry.get(entityTypeMap)
    return HashMap.get(map, entityId)
  },

  /**
   * Check if entity is selected.
   */
  isSelected: (entityId: string): boolean => {
    return HashSet.has(geointRegistry.get(selectedEntityIds), entityId)
  },

  /**
   * Check if entity is pinned.
   */
  isPinned: (entityId: string): boolean => {
    return HashSet.has(geointRegistry.get(pinnedEntityIds), entityId)
  },

  /**
   * Check if entity is live.
   */
  isLive: (entityId: string): boolean => {
    return HashSet.has(geointRegistry.get(liveEntityIds), entityId)
  },

  /**
   * Get selection count.
   */
  selectionCount: (): number => {
    return HashSet.size(geointRegistry.get(selectedEntityIds))
  },

  /**
   * Get all selected entity IDs as array.
   */
  getSelectedIds: (): readonly string[] => {
    return HashSet.toValues(geointRegistry.get(selectedEntityIds))
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Panel UI Atoms
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Search panel UI state.
 */
export interface SearchPanelUIState {
  readonly query: string
  readonly isExpanded: boolean
  readonly showFilters: boolean
  readonly showTimeRange: boolean
}

/**
 * Default search panel UI state.
 */
export const DEFAULT_SEARCH_PANEL_UI_STATE: SearchPanelUIState = {
  query: '',
  isExpanded: true,
  showFilters: false,
  showTimeRange: false,
}

/**
 * Search panel UI atom.
 */
export const searchPanelUIAtom = Atom.make<SearchPanelUIState>(DEFAULT_SEARCH_PANEL_UI_STATE)

/**
 * Time range mode.
 */
export type TimeRangeMode = 'live' | 'historical'

/**
 * Time range state.
 */
export interface TimeRangeState {
  readonly mode: TimeRangeMode
  readonly rangeStart: number // timestamp
  readonly rangeEnd: number // timestamp
}

/**
 * Default time range state (last 24h).
 */
export const DEFAULT_TIME_RANGE_STATE: TimeRangeState = {
  mode: 'live',
  rangeStart: Date.now() - 24 * 60 * 60 * 1000,
  rangeEnd: Date.now(),
}

/**
 * Time range atom.
 */
export const timeRangeAtom = Atom.make<TimeRangeState>(DEFAULT_TIME_RANGE_STATE)

/**
 * Collapsible section state (keyed by section ID).
 */
const collapsibleSectionCache = new Map<string, Writable<boolean, boolean>>()

/**
 * Get or create collapsible section atom.
 */
export function collapsibleSectionFamily(sectionId: string, defaultOpen = false): Writable<boolean, boolean> {
  let atom = collapsibleSectionCache.get(sectionId)
  if (!atom) {
    atom = Atom.make<boolean>(defaultOpen)
    collapsibleSectionCache.set(sectionId, atom)
  }
  return atom
}

/**
 * Search panel UI operations.
 */
export const searchPanelOps = {
  setQuery: (query: string) => {
    geointRegistry.update(searchPanelUIAtom, (state) => ({ ...state, query }))
  },

  clearQuery: () => {
    geointRegistry.update(searchPanelUIAtom, (state) => ({ ...state, query: '' }))
  },

  toggleExpanded: () => {
    geointRegistry.update(searchPanelUIAtom, (state) => ({ ...state, isExpanded: !state.isExpanded }))
  },

  setExpanded: (isExpanded: boolean) => {
    geointRegistry.update(searchPanelUIAtom, (state) => ({ ...state, isExpanded }))
  },

  toggleFilters: () => {
    geointRegistry.update(searchPanelUIAtom, (state) => ({ ...state, showFilters: !state.showFilters }))
  },

  toggleTimeRange: () => {
    geointRegistry.update(searchPanelUIAtom, (state) => ({ ...state, showTimeRange: !state.showTimeRange }))
  },

  setTimeMode: (mode: TimeRangeMode) => {
    geointRegistry.update(timeRangeAtom, (state) => ({ ...state, mode }))
  },

  setTimeRange: (start: number, end: number) => {
    geointRegistry.update(timeRangeAtom, (state) => ({
      ...state,
      rangeStart: start,
      rangeEnd: end,
    }))
  },

  toggleSection: (sectionId: string) => {
    const atom = collapsibleSectionFamily(sectionId)
    geointRegistry.update(atom, (isOpen) => !isOpen)
  },

  setSection: (sectionId: string, isOpen: boolean) => {
    const atom = collapsibleSectionFamily(sectionId)
    geointRegistry.set(atom, isOpen)
  },

  /**
   * Reset search panel to defaults.
   */
  reset: () => {
    geointRegistry.set(searchPanelUIAtom, DEFAULT_SEARCH_PANEL_UI_STATE)
    geointRegistry.set(timeRangeAtom, DEFAULT_TIME_RANGE_STATE)
    collapsibleSectionCache.clear()
  },
}
