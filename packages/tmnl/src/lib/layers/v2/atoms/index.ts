/**
 * Layer System v2 — Atoms (Atom-as-State Doctrine)
 *
 * These atoms ARE the source of truth for layer state.
 * Services mutate atoms directly via registry.set().
 * React components subscribe via useAtomValue().
 *
 * NO Effect.Ref anywhere. Atoms own the state.
 *
 * Pattern:
 * - Module-level Registry singleton for synchronous mutations
 * - Atom.make() for state definition
 * - registry.get/set for direct synchronous access
 * - React uses useAtomValue() which handles registry internally
 *
 * @experimental v2 API - Wrapper-free layer system
 */

import { Atom } from "@effect-atom/atom"
import * as Registry from "@effect-atom/atom/Registry"
import type { LayerInstance, PointerEventsBehavior, PositionMode } from "../types"
import { Z_INDEX_GAP } from "../types"

// ─────────────────────────────────────────────────────────────────────────────
// Module-Level Registry (Singleton for Synchronous Access)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Layer Registry Singleton
 *
 * Provides synchronous get/set access to atoms.
 * React's useAtomValue uses its own registry internally.
 */
export const layerRegistry = Registry.make()

// ─────────────────────────────────────────────────────────────────────────────
// Core State Atoms (Writable)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Layers Map Atom
 *
 * The single source of truth for all layers.
 * Maps layer ID → LayerInstance.
 *
 * Services call registry.set() to mutate.
 * React calls useAtomValue() to subscribe.
 */
export const layersMapAtom = Atom.make<ReadonlyMap<string, LayerInstance>>(
  new Map()
)

/**
 * Layer ID Counter Atom
 *
 * Simple incrementing counter for generating unique IDs.
 * Cheaper than nanoid/uuid for internal layer IDs.
 */
export const layerIdCounterAtom = Atom.make<number>(0)

// ─────────────────────────────────────────────────────────────────────────────
// Derived Atoms (Read-only, Computed)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sorted Layers Atom
 *
 * Layers sorted by z-index (ascending).
 * Computed from layersMapAtom.
 */
export const sortedLayersAtom = Atom.make<readonly LayerInstance[]>((get) => {
  const map = get(layersMapAtom)
  return Array.from(map.values()).sort((a, b) => a.zIndex - b.zIndex)
})

/**
 * Visible Layers Atom
 *
 * Only visible layers, sorted by z-index.
 */
export const visibleLayersAtom = Atom.make<readonly LayerInstance[]>((get) => {
  const sorted = get(sortedLayersAtom)
  return sorted.filter((layer) => layer.visible)
})

/**
 * Layer Count Atom
 *
 * Total number of registered layers.
 */
export const layerCountAtom = Atom.make<number>((get) => {
  const map = get(layersMapAtom)
  return map.size
})

/**
 * Max Z-Index Atom
 *
 * The highest z-index currently in use.
 * Returns 0 if no layers exist.
 */
export const maxZIndexAtom = Atom.make<number>((get) => {
  const sorted = get(sortedLayersAtom)
  if (sorted.length === 0) return 0
  return sorted[sorted.length - 1].zIndex
})

/**
 * Min Z-Index Atom
 *
 * The lowest z-index currently in use.
 * Returns 0 if no layers exist.
 */
export const minZIndexAtom = Atom.make<number>((get) => {
  const sorted = get(sortedLayersAtom)
  if (sorted.length === 0) return 0
  return sorted[0].zIndex
})

/**
 * Visual Hash Atom
 *
 * Hash of visible layer order for render optimization.
 * Only changes when visible layer order actually changes.
 */
export const visualHashAtom = Atom.make<string>((get) => {
  const visible = get(visibleLayersAtom)
  return visible.map((l) => `${l.id}:${l.zIndex}`).join("|")
})

// ─────────────────────────────────────────────────────────────────────────────
// Layer Family (Individual Layer Access)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Layer Family
 *
 * Access individual layers by ID.
 * Returns LayerInstance | null.
 *
 * Usage: layerFamily("layer-123")
 */
export const layerFamily = Atom.family(
  (id: string): Atom.Atom<LayerInstance | null> =>
    Atom.make((get) => {
      const map = get(layersMapAtom)
      return map.get(id) ?? null
    })
)

// ─────────────────────────────────────────────────────────────────────────────
// Mutation Utilities (Synchronous via Registry)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a new layer ID
 *
 * Increments counter and returns "layer-{n}"
 */
export function generateLayerId(): string {
  const current = layerRegistry.get(layerIdCounterAtom)
  layerRegistry.set(layerIdCounterAtom, current + 1)
  return `layer-${current + 1}`
}

/**
 * Add a layer to the map
 *
 * @param layer - The layer instance to add
 */
export function addLayer(layer: LayerInstance): void {
  const map = layerRegistry.get(layersMapAtom)
  const newMap = new Map(map)
  newMap.set(layer.id, layer)
  layerRegistry.set(layersMapAtom, newMap)
}

/**
 * Remove a layer from the map
 *
 * @param id - The layer ID to remove
 */
export function removeLayer(id: string): void {
  const map = layerRegistry.get(layersMapAtom)
  const newMap = new Map(map)
  newMap.delete(id)
  layerRegistry.set(layersMapAtom, newMap)
}

/**
 * Update a layer's properties
 *
 * @param id - The layer ID to update
 * @param update - Partial update (id and name immutable)
 */
export function updateLayer(
  id: string,
  update: Partial<Omit<LayerInstance, "id" | "name">>
): void {
  const map = layerRegistry.get(layersMapAtom)
  const existing = map.get(id)
  if (!existing) return

  const newMap = new Map(map)
  newMap.set(id, { ...existing, ...update })
  layerRegistry.set(layersMapAtom, newMap)
}

/**
 * Get a layer by ID
 *
 * @param id - The layer ID
 * @returns LayerInstance or null
 */
export function getLayer(id: string): LayerInstance | null {
  const map = layerRegistry.get(layersMapAtom)
  return map.get(id) ?? null
}

/**
 * Get all layers as array (unsorted)
 */
export function getAllLayers(): LayerInstance[] {
  const map = layerRegistry.get(layersMapAtom)
  return Array.from(map.values())
}

/**
 * Get layers sorted by z-index
 */
export function getSortedLayers(): readonly LayerInstance[] {
  return layerRegistry.get(sortedLayersAtom)
}

// ─────────────────────────────────────────────────────────────────────────────
// Z-Index Operations (Smart Gap Algorithm)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculate new z-index for bringing a layer to front
 *
 * Uses gap algorithm to minimize future reassignments.
 *
 * @param currentMaxZ - Current maximum z-index
 * @returns New z-index value
 */
export function calculateFrontZIndex(currentMaxZ: number): number {
  return currentMaxZ + Z_INDEX_GAP
}

/**
 * Calculate new z-index for sending a layer to back
 *
 * @param currentMinZ - Current minimum z-index
 * @returns New z-index value
 */
export function calculateBackZIndex(currentMinZ: number): number {
  return currentMinZ - Z_INDEX_GAP
}

/**
 * Bring a layer to front
 *
 * Sets layer z-index to max + gap.
 *
 * @param id - Layer ID to bring to front
 */
export function bringToFront(id: string): void {
  const layer = getLayer(id)
  if (!layer) return

  const allLayers = getAllLayers()
  if (allLayers.length <= 1) return // Single layer - no change needed

  const maxZ = layerRegistry.get(maxZIndexAtom)

  // Only update if not already at front
  if (layer.zIndex < maxZ) {
    updateLayer(id, { zIndex: calculateFrontZIndex(maxZ) })
  }
}

/**
 * Send a layer to back
 *
 * Sets layer z-index to min - gap.
 *
 * @param id - Layer ID to send to back
 */
export function sendToBack(id: string): void {
  const layer = getLayer(id)
  if (!layer) return

  const allLayers = getAllLayers()
  if (allLayers.length <= 1) return // Single layer - no change needed

  const minZ = layerRegistry.get(minZIndexAtom)

  // Only update if not already at back
  if (layer.zIndex > minZ) {
    updateLayer(id, { zIndex: calculateBackZIndex(minZ) })
  }
}

/**
 * Set layer visibility
 *
 * @param id - Layer ID
 * @param visible - New visibility state
 */
export function setVisible(id: string, visible: boolean): void {
  updateLayer(id, { visible })
}

/**
 * Set layer pointer events behavior
 *
 * @param id - Layer ID
 * @param behavior - New pointer events behavior
 */
export function setPointerEvents(id: string, behavior: PointerEventsBehavior): void {
  updateLayer(id, { pointerEvents: behavior })
}

/**
 * Set layer z-index directly
 *
 * @param id - Layer ID
 * @param zIndex - New z-index value
 */
export function setZIndex(id: string, zIndex: number): void {
  updateLayer(id, { zIndex })
}

/**
 * Set layer position mode
 *
 * @param id - Layer ID
 * @param positionMode - New position mode
 */
export function setPositionMode(id: string, positionMode: PositionMode): void {
  updateLayer(id, { positionMode })
}

// ─────────────────────────────────────────────────────────────────────────────
// Reset Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Reset all layer state
 *
 * Clears the layers map and resets ID counter.
 * Use for testing or cleanup.
 */
export function resetAllLayers(): void {
  layerRegistry.set(layersMapAtom, new Map())
  layerRegistry.set(layerIdCounterAtom, 0)
}
