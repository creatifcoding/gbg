/**
 * Entity Operations — high-level commands that bridge search, Fermion, and entity stx
 *
 * These operations are the "public API" for the GEOINT entity system.
 * They compose:
 *   - entity-stx (spawn/despawn lifecycle)
 *   - trait Fermions (data population)
 *   - search result mapping (Kori trait extraction)
 *
 * Used by: GEOINT panel, harness tools, code-mode SDK
 *
 * @module geoint/stx/entity-ops
 */

import { Effect } from 'effect'
import { Atom } from '@effect-atom/atom'
import type { GeointEntityType } from '../kori/search-result-mapper'
import {
  spawnEntity,
  getEntityStx,
  despawnEntity,
  getSpawnedEntityIds,
  getAllEntityStx,
  syncEntityAtoms,
  geointEntityRegistry,
  type EntityStx,
  type SpawnEntityInput,
} from './entity-stx'
import {
  geoPositionFermion,
  uiStateFermion,
  getEntityTraitNames,
  traitRegistry,
} from '../fermion'

// ─────────────────────────────────────────────────────────────────────────────
// Entity Selection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reactive atom: currently selected entity ID (single selection).
 */
export const selectedEntityIdAtom = Atom.make<string | null>(null)

/**
 * Reactive atom: set of selected entity IDs (multi-selection).
 */
export const selectedEntityIdsAtom = Atom.make<ReadonlySet<string>>(new Set())

/**
 * Select an entity (single selection mode).
 * Deselects previous selection.
 */
export function selectEntity(entityId: string | null): void {
  // Deselect previous
  const prev = geointEntityRegistry.get(selectedEntityIdAtom)
  if (prev && prev !== entityId) {
    const prevStx = getEntityStx(prev)
    if (prevStx) {
      prevStx.data.selected.set(false)
    }
  }

  // Select new
  if (entityId) {
    const stx = getEntityStx(entityId)
    if (stx) {
      stx.data.selected.set(true)
      stx.data.viewed.set(true)
    }
  }

  geointEntityRegistry.set(selectedEntityIdAtom, entityId)
}

/**
 * Toggle entity selection in multi-select mode.
 */
export function toggleEntitySelection(entityId: string): void {
  const stx = getEntityStx(entityId)
  if (!stx) return

  const isSelected = stx.data.selected.get()
  stx.data.selected.set(!isSelected)

  const current = geointEntityRegistry.get(selectedEntityIdsAtom)
  const next = new Set(current)
  if (isSelected) {
    next.delete(entityId)
  } else {
    next.add(entityId)
  }
  geointEntityRegistry.set(selectedEntityIdsAtom, next)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Hover
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reactive atom: currently hovered entity ID.
 */
export const hoveredEntityIdAtom = Atom.make<string | null>(null)

/**
 * Set hover state on entity (direct Legend-State mutation).
 */
export function hoverEntity(entityId: string | null): void {
  // Clear previous hover
  const prev = geointEntityRegistry.get(hoveredEntityIdAtom)
  if (prev && prev !== entityId) {
    const prevStx = getEntityStx(prev)
    if (prevStx) {
      prevStx.data.hovered.set(false)
    }
  }

  // Set new hover
  if (entityId) {
    const stx = getEntityStx(entityId)
    if (stx) {
      stx.data.hovered.set(true)
    }
  }

  geointEntityRegistry.set(hoveredEntityIdAtom, entityId)
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Pin
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Toggle pin state on entity.
 */
export function toggleEntityPin(entityId: string): void {
  const stx = getEntityStx(entityId)
  if (!stx) return
  stx.data.pinned.set(!stx.data.pinned.get())
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Spawn from Search Result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Spawn entity from a search result payload.
 *
 * Maps search result fields to entity data + initial traits.
 * Returns the spawned EntityStx.
 */
export function spawnFromSearchResult(result: {
  entityId: string
  entityType: GeointEntityType
  displayLabel: string
  category?: string
  source?: string
  position?: { longitude: number; latitude: number; altitude?: number | null }
  traits?: Record<string, unknown>
}): EntityStx {
  const entityStx = spawnEntity({
    entityId: result.entityId,
    entityType: result.entityType,
    displayLabel: result.displayLabel,
    category: result.category,
    source: result.source,
    position: result.position,
    traits: result.traits,
  })

  syncEntityAtoms()
  return entityStx
}

/**
 * Batch spawn multiple entities from search results.
 */
export function batchSpawnFromSearch(results: Array<{
  entityId: string
  entityType: GeointEntityType
  displayLabel: string
  category?: string
  source?: string
  position?: { longitude: number; latitude: number; altitude?: number | null }
  traits?: Record<string, unknown>
}>): EntityStx[] {
  const spawned = results.map((r) => spawnEntity({
    entityId: r.entityId,
    entityType: r.entityType,
    displayLabel: r.displayLabel,
    category: r.category,
    source: r.source,
    position: r.position,
    traits: r.traits,
  }))

  syncEntityAtoms()
  return spawned
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Tracking
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start live tracking for an entity.
 */
export function startTracking(entityId: string): boolean {
  const stx = getEntityStx(entityId)
  if (!stx) return false

  stx.send({ type: 'START_TRACKING' })
  return stx.actor!.getSnapshot().value === 'live'
}

/**
 * Stop live tracking for an entity.
 */
export function stopTracking(entityId: string): void {
  const stx = getEntityStx(entityId)
  if (!stx) return
  stx.send({ type: 'STOP_TRACKING' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity Query
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get entity summary for display (panel list, tooltip, etc.)
 */
export function getEntitySummary(entityId: string) {
  const stx = getEntityStx(entityId)
  if (!stx) return null

  const data = stx.data.get()
  const snapshot = stx.actor?.getSnapshot()

  return {
    entityId: data.entityId,
    entityType: data.entityType,
    displayLabel: data.displayLabel,
    category: data.category,
    source: data.source,
    state: snapshot?.value ?? 'unknown',
    selected: data.selected,
    hovered: data.hovered,
    pinned: data.pinned,
    position: {
      longitude: data.longitude,
      latitude: data.latitude,
      altitude: data.altitude,
    },
    traitNames: getEntityTraitNames(entityId),
    lastUpdated: data.lastUpdated,
  }
}

/**
 * Get all entity summaries (for panel entity list).
 */
export function getAllEntitySummaries() {
  const ids = getSpawnedEntityIds()
  return ids.map(getEntitySummary).filter(Boolean)
}

/**
 * Find entities by type.
 */
export function getEntitiesByType(type: GeointEntityType): EntityStx[] {
  const result: EntityStx[] = []
  for (const [, stx] of getAllEntityStx()) {
    if (stx.data.entityType.get() === type) {
      result.push(stx)
    }
  }
  return result
}

/**
 * Find entities within a bounding box.
 */
export function getEntitiesInBounds(bounds: {
  west: number
  east: number
  south: number
  north: number
}): EntityStx[] {
  const result: EntityStx[] = []
  for (const [, stx] of getAllEntityStx()) {
    const lon = stx.data.longitude.get()
    const lat = stx.data.latitude.get()
    if (
      lon >= bounds.west && lon <= bounds.east &&
      lat >= bounds.south && lat <= bounds.north
    ) {
      result.push(stx)
    }
  }
  return result
}
