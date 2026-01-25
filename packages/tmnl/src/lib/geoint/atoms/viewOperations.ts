/**
 * GEOINT Panel-Scoped View Operations
 *
 * Pure functions that manipulate viewport state based on result bounds.
 * All operations use geointRegistry for synchronous atom access.
 *
 * Pattern: get current state → compute new state → set new state
 *
 * @module geoint/atoms/viewOperations
 */

import { geointRegistry } from './index'
import type { PanelId, ViewportState } from './families'
import { getPanelAtoms } from './families'
import type { SearchResultItem } from '../schemas'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Geographic bounding box.
 */
export interface GeoBounds {
  readonly minLon: number
  readonly minLat: number
  readonly maxLon: number
  readonly maxLat: number
}

// =============================================================================
// VIEW OPERATIONS FACTORY
// =============================================================================

/**
 * Create panel-scoped view operations.
 *
 * Returns an object with viewport manipulation methods that operate on
 * panel-specific atoms via geointRegistry.
 *
 * @example
 * ```typescript
 * const panelId = asPanelId('panel-1')
 * const ops = createViewOperations(panelId)
 *
 * ops.fitToSelection()      // Fit viewport to selected results
 * ops.fitToAll()            // Fit viewport to all results
 * ```
 */
export function createViewOperations(panelId: PanelId) {
  const atoms = getPanelAtoms(panelId)

  return {
    /**
     * Fit viewport to selected results.
     *
     * Calculates bounding box of selected results and adjusts viewport
     * to show all selected items.
     *
     * If no results selected, does nothing.
     *
     * Bound: `Ctrl+F` key (when selection exists)
     */
    fitToSelection(): void {
      const selectedResults = geointRegistry.get(atoms.selectedResultsAtom)

      if (selectedResults.length === 0) {
        console.warn('fitToSelection: no results selected')
        return
      }

      const bounds = calculateBounds(selectedResults)
      if (!bounds) {
        console.warn('fitToSelection: could not calculate bounds')
        return
      }

      const viewport = boundsToViewport(bounds)
      geointRegistry.set(atoms.viewportAtom, viewport)
    },

    /**
     * Fit viewport to all results.
     *
     * Calculates bounding box of all results and adjusts viewport
     * to show everything.
     *
     * If no results, does nothing.
     *
     * Bound: `Ctrl+Shift+F` key
     */
    fitToAll(): void {
      const allResults = geointRegistry.get(atoms.resultsAtom)

      if (allResults.length === 0) {
        console.warn('fitToAll: no results to fit')
        return
      }

      const bounds = calculateBounds(allResults)
      if (!bounds) {
        console.warn('fitToAll: could not calculate bounds')
        return
      }

      const viewport = boundsToViewport(bounds)
      geointRegistry.set(atoms.viewportAtom, viewport)
    },

    /**
     * Fit viewport to custom bounds.
     *
     * @param bounds - Geographic bounding box
     */
    fitToBounds(bounds: GeoBounds): void {
      const viewport = boundsToViewport(bounds)
      geointRegistry.set(atoms.viewportAtom, viewport)
    },

    /**
     * Get bounds of selected results (read-only).
     */
    getSelectionBounds(): GeoBounds | null {
      const selectedResults = geointRegistry.get(atoms.selectedResultsAtom)
      return calculateBounds(selectedResults)
    },

    /**
     * Get bounds of all results (read-only).
     */
    getAllResultsBounds(): GeoBounds | null {
      const allResults = geointRegistry.get(atoms.resultsAtom)
      return calculateBounds(allResults)
    },
  }
}

/**
 * View operations type (for type inference and testing).
 */
export type ViewOperations = ReturnType<typeof createViewOperations>

// =============================================================================
// BOUNDS UTILITIES
// =============================================================================

/**
 * Calculate geographic bounding box from search results.
 *
 * Extracts position data from each result and computes min/max lat/lon.
 *
 * @param results - Search result items
 * @returns Bounding box or null if results have no positions
 */
export function calculateBounds(
  results: readonly SearchResultItem[]
): GeoBounds | null {
  if (results.length === 0) return null

  const positions = results
    .map(extractPosition)
    .filter((pos): pos is { lon: number; lat: number } => pos !== null)

  if (positions.length === 0) return null

  const lons = positions.map((p) => p.lon)
  const lats = positions.map((p) => p.lat)

  return {
    minLon: Math.min(...lons),
    minLat: Math.min(...lats),
    maxLon: Math.max(...lons),
    maxLat: Math.max(...lats),
  }
}

/**
 * Convert bounding box to viewport state.
 *
 * Calculates center point and appropriate zoom level to fit bounds.
 *
 * @param bounds - Geographic bounding box
 * @returns Viewport state with center and zoom
 */
export function boundsToViewport(bounds: GeoBounds): ViewportState {
  // Calculate center point
  const centerLon = (bounds.minLon + bounds.maxLon) / 2
  const centerLat = (bounds.minLat + bounds.maxLat) / 2

  // Calculate zoom level based on bounds extent
  const lonExtent = bounds.maxLon - bounds.minLon
  const latExtent = bounds.maxLat - bounds.minLat
  const maxExtent = Math.max(lonExtent, latExtent)

  // Rough zoom calculation (adjust multiplier for desired padding)
  // Larger extent → lower zoom, smaller extent → higher zoom
  const zoom = calculateZoomLevel(maxExtent)

  return {
    longitude: centerLon,
    latitude: centerLat,
    zoom,
    pitch: 0,
    bearing: 0,
  }
}

/**
 * Calculate zoom level from extent.
 *
 * Uses logarithmic scale to map extent to zoom level (0-22).
 * Smaller extents → higher zoom (closer view).
 *
 * @param extent - Max of lon/lat extent in degrees
 * @returns Zoom level (0-22)
 */
function calculateZoomLevel(extent: number): number {
  // Base zoom calculation
  // extent = 180 → zoom ≈ 0 (world view)
  // extent = 1 → zoom ≈ 8
  // extent = 0.01 → zoom ≈ 14
  // extent = 0.001 → zoom ≈ 18

  if (extent <= 0) return 22 // Max zoom for invalid extent

  const zoom = Math.log2(360 / extent) - 1

  // Clamp to valid range and subtract padding
  return Math.max(0, Math.min(20, zoom - 1)) // -1 for padding
}

/**
 * Extract position from search result.
 *
 * Handles different result types (Track, POI, Flight, etc.) which may
 * have position data in different fields.
 *
 * Position3D is a tuple: [longitude, latitude, altitude]
 *
 * @param result - Search result item
 * @returns Position or null if not available
 */
function extractPosition(
  result: SearchResultItem
): { lon: number; lat: number } | null {
  // Type narrowing based on _tag
  switch (result._tag) {
    case 'SearchResultTrack':
    case 'SearchResultPoi':
    case 'SearchResultFlight':
      // These types have position field as [lon, lat, alt] tuple
      if ('position' in result && result.position) {
        return {
          lon: result.position[0], // longitude
          lat: result.position[1], // latitude
        }
      }
      break

    case 'SearchResultFeature':
      // Features may have geometry with coordinates
      // TODO: Extract from geometry field when available
      break

    case 'SearchResultWeather':
    case 'SearchResultImagery':
      // These may have bounding boxes or center points
      // TODO: Extract from appropriate fields
      break
  }

  return null
}
