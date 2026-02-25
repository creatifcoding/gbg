/**
 * GEOINT Panel-Scoped Map Operations
 *
 * Pure functions that mutate panel-scoped viewport atoms.
 * All operations use geointRegistry for synchronous atom access.
 *
 * Pattern: get current state → compute new state → set new state
 *
 * @module geoint/atoms/mapOperations
 */

import { geointRegistry } from './index'
import type { PanelId, ViewportState } from './families'
import { getPanelAtoms } from './families'

// =============================================================================
// CONSTANTS
// =============================================================================

const MIN_ZOOM = 0
const MAX_ZOOM = 22
const ZOOM_STEP = 1

const DEFAULT_VIEWPORT: ViewportState = {
  longitude: -122.42,
  latitude: 37.78,
  zoom: 12,
  pitch: 0,
  bearing: 0,
}

// =============================================================================
// MAP OPERATIONS FACTORY
// =============================================================================

/**
 * Create panel-scoped map operations.
 *
 * @deprecated Use `MapController` from `geoint/map` instead.
 * MapController consolidates all map operations into a single class.
 * ```typescript
 * import { MapController } from '@/lib/geoint/map'
 * const controller = new MapController(panelId)
 * controller.zoomIn()
 * ```
 */
export function createMapOperations(panelId: PanelId) {
  const atoms = getPanelAtoms(panelId)

  return {
    /**
     * Increment viewport zoom by 1 (clamped to MAX_ZOOM).
     *
     * Bound: `=` key
     */
    zoomIn(): void {
      const current = geointRegistry.get(atoms.viewportAtom)
      geointRegistry.set(atoms.viewportAtom, {
        ...current,
        zoom: Math.min(current.zoom + ZOOM_STEP, MAX_ZOOM),
      })
    },

    /**
     * Decrement viewport zoom by 1 (clamped to MIN_ZOOM).
     *
     * Bound: `-` key
     */
    zoomOut(): void {
      const current = geointRegistry.get(atoms.viewportAtom)
      geointRegistry.set(atoms.viewportAtom, {
        ...current,
        zoom: Math.max(current.zoom - ZOOM_STEP, MIN_ZOOM),
      })
    },

    /**
     * Reset viewport to default state (San Francisco, zoom 12).
     *
     * Bound: `0` key
     */
    resetView(): void {
      geointRegistry.set(atoms.viewportAtom, DEFAULT_VIEWPORT)
    },

    /**
     * Set viewport to specific values (partial update).
     *
     * Useful for programmatic viewport changes (e.g., fitToSelection).
     *
     * @example
     * ```typescript
     * ops.setViewport({ zoom: 15, longitude: -95.0, latitude: 35.0 })
     * ```
     */
    setViewport(viewport: Partial<ViewportState>): void {
      const current = geointRegistry.get(atoms.viewportAtom)
      geointRegistry.set(atoms.viewportAtom, {
        ...current,
        ...viewport,
      })
    },

    /**
     * Get current viewport state (read-only).
     *
     * Use for calculations (e.g., fitToSelection needs current zoom).
     */
    getViewport(): ViewportState {
      return geointRegistry.get(atoms.viewportAtom)
    },
  }
}

/**
 * Map operations type (for type inference and testing).
 */
export type MapOperations = ReturnType<typeof createMapOperations>
