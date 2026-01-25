/**
 * GEOINT Panel-Scoped Operations Factory
 *
 * Unified operations factory that merges all panel-scoped operation modules.
 * This is the "hydration" step that creates a complete operations object.
 *
 * Pattern: Individual modules → Merge → Unified operations
 *
 * @module geoint/atoms/operations
 */

import type { PanelId } from './families'
import { createMapOperations } from './mapOperations'
import { createSearchOperations } from './searchOperations'
import { createLayerOperations } from './layerOperations'
import { createSelectionOperations } from './selectionOperations'
import { createViewOperations } from './viewOperations'

// =============================================================================
// UNIFIED OPERATIONS FACTORY
// =============================================================================

/**
 * Create unified panel-scoped operations.
 *
 * Merges all operation modules (map, search, layer, selection, view) into
 * a single operations object. This is the "hydration" step that prepares
 * operations for binding to hotkeys.
 *
 * All operations are panel-scoped via atom families and use geointRegistry
 * for synchronous state mutations.
 *
 * @param panelId - Panel identifier (slug:uuid format)
 * @returns Unified operations object with all methods
 *
 * @example
 * ```typescript
 * const identity = createPanelIdentity('geoint-main')
 * const panelId = panelIdentityToId(identity)
 * const ops = createGeointOperations(panelId)
 *
 * // All operations available on single object
 * ops.zoomIn()              // Map operation
 * ops.clearSearch()         // Search operation
 * ops.toggleLayer('tracks') // Layer operation
 * ops.selectAll()           // Selection operation
 * ops.fitToSelection()      // View operation
 * ```
 */
export function createGeointOperations(panelId: PanelId) {
  // Create individual operation modules
  const mapOps = createMapOperations(panelId)
  const searchOps = createSearchOperations(panelId)
  const layerOps = createLayerOperations(panelId)
  const selectionOps = createSelectionOperations(panelId)
  const viewOps = createViewOperations(panelId)

  // Merge all modules into unified operations object
  return {
    ...mapOps,
    ...searchOps,
    ...layerOps,
    ...selectionOps,
    ...viewOps,
  }
}

/**
 * Unified operations type.
 *
 * Combines all operation types from individual modules.
 * Use for type annotations and testing.
 */
export type GeointOperations = ReturnType<typeof createGeointOperations>

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Export individual operation types for granular testing
export type { MapOperations } from './mapOperations'
export type { SearchOperations } from './searchOperations'
export type { LayerOperations } from './layerOperations'
export type { SelectionOperations } from './selectionOperations'
export type { ViewOperations, GeoBounds } from './viewOperations'

// Export individual factory functions for custom composition
export {
  createMapOperations,
  createSearchOperations,
  createLayerOperations,
  createSelectionOperations,
  createViewOperations,
}

// Export view utilities for external use
export { calculateBounds, boundsToViewport } from './viewOperations'
