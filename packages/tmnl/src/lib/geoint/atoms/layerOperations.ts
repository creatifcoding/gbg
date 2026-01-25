/**
 * GEOINT Panel-Scoped Layer Operations
 *
 * Pure functions that mutate panel-scoped layer atoms.
 * All operations use geointRegistry for synchronous atom access.
 *
 * Pattern: get current state → compute new state → set new state
 *
 * @module geoint/atoms/layerOperations
 */

import { geointRegistry } from './index'
import type { PanelId, LayerVisibility } from './families'
import { getPanelAtoms } from './families'

// =============================================================================
// LAYER OPERATIONS FACTORY
// =============================================================================

/**
 * Create panel-scoped layer operations.
 *
 * Returns an object with layer manipulation methods that operate on
 * panel-specific atoms via geointRegistry.
 *
 * @example
 * ```typescript
 * const panelId = asPanelId('panel-1')
 * const ops = createLayerOperations(panelId)
 *
 * ops.toggleLayerPanel()        // Show/hide layer controls panel
 * ops.toggleLayer('tracks')     // Toggle tracks layer visibility
 * ops.showAllLayers()           // Enable all layers
 * ops.hideAllLayers()           // Disable all layers
 * ```
 */
export function createLayerOperations(panelId: PanelId) {
  const atoms = getPanelAtoms(panelId)

  return {
    /**
     * Toggle layer controls panel visibility.
     *
     * Cycles intelPanel between:
     * - 'default' → 'collapsed' (hide)
     * - 'collapsed' → 'default' (show)
     * - 'expanded' → 'default' (if expanded, collapse to default)
     *
     * Bound: `g l` key
     */
    toggleLayerPanel(): void {
      const current = geointRegistry.get(atoms.panelStateAtom)
      const newIntelPanelMode =
        current.intelPanel === 'default' ? 'collapsed' : 'default'

      geointRegistry.set(atoms.panelStateAtom, {
        ...current,
        intelPanel: newIntelPanelMode,
      })
    },

    /**
     * Toggle visibility of a specific layer.
     *
     * Flips the boolean flag for the specified layer in layerVisibilityAtom.
     *
     * @param layerId - Layer to toggle (tracks, pois, flights, features, imagery, weather, heatmap, labels)
     *
     * Bound: Various keys per layer (e.g., `g t` for tracks)
     */
    toggleLayer(layerId: keyof LayerVisibility): void {
      const current = geointRegistry.get(atoms.layerVisibilityAtom)

      geointRegistry.set(atoms.layerVisibilityAtom, {
        ...current,
        [layerId]: !current[layerId],
      })
    },

    /**
     * Show all layers.
     *
     * Sets all layer visibility flags to true.
     *
     * Bound: `g L` key (capital L)
     */
    showAllLayers(): void {
      const current = geointRegistry.get(atoms.layerVisibilityAtom)

      geointRegistry.set(atoms.layerVisibilityAtom, {
        ...current,
        tracks: true,
        pois: true,
        flights: true,
        features: true,
        imagery: true,
        weather: true,
        heatmap: true,
        labels: true,
      })
    },

    /**
     * Hide all layers.
     *
     * Sets all layer visibility flags to false.
     *
     * Bound: `g H` key (capital H)
     */
    hideAllLayers(): void {
      const current = geointRegistry.get(atoms.layerVisibilityAtom)

      geointRegistry.set(atoms.layerVisibilityAtom, {
        ...current,
        tracks: false,
        pois: false,
        flights: false,
        features: false,
        imagery: false,
        weather: false,
        heatmap: false,
        labels: false,
      })
    },

    /**
     * Cycle map style.
     *
     * TODO: Requires mapStyleFamily atom in families.ts
     *
     * Cycles through available map styles:
     * - satellite → streets → terrain → dark → satellite
     *
     * Bound: `g m` key
     */
    cycleMapStyle(): void {
      // TODO: Implement when mapStyleFamily is added to families.ts
      // const styles: MapStyle[] = ['satellite', 'streets', 'terrain', 'dark']
      // const current = geointRegistry.get(atoms.mapStyleAtom)
      // const currentIndex = styles.indexOf(current)
      // const nextIndex = (currentIndex + 1) % styles.length
      // geointRegistry.set(atoms.mapStyleAtom, styles[nextIndex])
      console.warn(
        'cycleMapStyle: mapStyleFamily not yet implemented in families.ts'
      )
    },

    /**
     * Get current layer visibility (read-only).
     */
    getLayerVisibility() {
      return geointRegistry.get(atoms.layerVisibilityAtom)
    },

    /**
     * Get current layer opacity (read-only).
     */
    getLayerOpacity() {
      return geointRegistry.get(atoms.layerOpacityAtom)
    },

    /**
     * Set layer opacity.
     *
     * @param layerId - Layer to adjust
     * @param opacity - Opacity value (0-1)
     */
    setLayerOpacity(
      layerId: keyof LayerVisibility,
      opacity: number
    ): void {
      const current = geointRegistry.get(atoms.layerOpacityAtom)

      geointRegistry.set(atoms.layerOpacityAtom, {
        ...current,
        [layerId]: Math.max(0, Math.min(1, opacity)), // Clamp to 0-1
      })
    },
  }
}

/**
 * Layer operations type (for type inference and testing).
 */
export type LayerOperations = ReturnType<typeof createLayerOperations>
