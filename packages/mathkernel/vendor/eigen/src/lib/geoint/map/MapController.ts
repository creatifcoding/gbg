/**
 * MapController — Unified GEOINT Map Operations Abstraction
 *
 * Panel-scoped controller that consolidates 5 fragmented operation factories
 * into a single coherent API. One MapController per PanelId.
 *
 * Architecture (Hybrid C — Class + Effect):
 * - Sync ops (zoom, toggle, select): direct atom mutations via geointRegistry
 * - Async ops (flyTo, projection, screenshot): delegate to Effect services
 * - Pure computation (haversine, bearing, area): standalone geodesic.ts
 *
 * @module geoint/map/MapController
 */

import { geointRegistry } from '../atoms/index'
import type { PanelId } from '../atoms/families'
import { getPanelAtoms, type GeointPanelAtoms } from '../atoms/families'
import type { SearchResultItem } from '../schemas'

import {
  type ViewportState,
  type FlyToTarget,
  type MapStyle,
  type LayerKey,
  type GeoBounds,
  type DistanceResult,
  type BearingResult,
  type AreaResult,
  type MapControllerStatus,
  type DrawingMode,
  type MarkerOptions,
  MIN_ZOOM,
  MAX_ZOOM,
  ZOOM_STEP,
  DEFAULT_VIEWPORT,
  MAP_STYLE_ORDER,
} from './schemas'

import {
  computeDistance,
  computeBearing,
  computeArea,
  metersPerPixel as geodesicMetersPerPixel,
  calculateGeoBounds,
  boundsToViewport as geodesicBoundsToViewport,
  type GeoCoordInput,
} from './geodesic'

import type { LayerVisibility } from '../atoms/index'
import { extractSearchResultPosition } from '../utils/extractPosition'

// =============================================================================
// MapController Class
// =============================================================================

/**
 * Unified, panel-scoped map controller.
 *
 * Absorbs functionality from:
 * - createMapOperations()      → Viewport domain
 * - createViewOperations()     → View domain (fitTo*)
 * - createLayerOperations()    → Layers domain
 * - createSelectionOperations() → Selection domain
 * - createSearchOperations()   → Search atom ops
 *
 * Adds new capabilities:
 * - Camera: flyTo, flyToBounds, flyToEntity, cancelAnimation
 * - Measurement: measureDistance, measureBearing, measureArea
 * - Export: toGeoJSON, captureScreenshot
 * - Annotation stubs: addMarker, startDrawing
 *
 * @example
 * ```typescript
 * const controller = new MapController(panelId)
 *
 * // Sync ops (instant atom mutations)
 * controller.zoomIn()
 * controller.toggleLayer('flights')
 * controller.selectAll()
 *
 * // Async ops (camera animation)
 * await controller.flyTo({ longitude: -74.006, latitude: 40.7128, zoom: 14 })
 *
 * // Pure computation
 * const dist = controller.measureDistance(nyc, london)
 * ```
 */
export class MapController {
  /** Panel ID this controller is scoped to */
  readonly panelId: PanelId

  /** Panel-scoped atoms (memoized) */
  private readonly atoms: GeointPanelAtoms

  constructor(panelId: PanelId) {
    this.panelId = panelId
    this.atoms = getPanelAtoms(panelId)
  }

  // ===========================================================================
  // Domain 1: Viewport (6 methods)
  // ===========================================================================

  /**
   * Get current viewport state.
   */
  getViewport(): ViewportState {
    return geointRegistry.get(this.atoms.viewportAtom)
  }

  /**
   * Set viewport (partial merge with current state).
   */
  setViewport(viewport: Partial<ViewportState>): void {
    const current = geointRegistry.get(this.atoms.viewportAtom)
    geointRegistry.set(this.atoms.viewportAtom, {
      ...current,
      ...viewport,
    })
  }

  /**
   * Zoom in by ZOOM_STEP (clamped to MAX_ZOOM).
   * Hotkey: `=`
   */
  zoomIn(): void {
    const current = geointRegistry.get(this.atoms.viewportAtom)
    geointRegistry.set(this.atoms.viewportAtom, {
      ...current,
      zoom: Math.min(current.zoom + ZOOM_STEP, MAX_ZOOM),
    })
  }

  /**
   * Zoom out by ZOOM_STEP (clamped to MIN_ZOOM).
   * Hotkey: `-`
   */
  zoomOut(): void {
    const current = geointRegistry.get(this.atoms.viewportAtom)
    geointRegistry.set(this.atoms.viewportAtom, {
      ...current,
      zoom: Math.max(current.zoom - ZOOM_STEP, MIN_ZOOM),
    })
  }

  /**
   * Reset viewport to home (custom or default).
   * Hotkey: `0`
   */
  resetView(): void {
    const home = geointRegistry.get(this.atoms.homeViewportAtom)
    geointRegistry.set(this.atoms.viewportAtom, home ?? DEFAULT_VIEWPORT)
  }

  /**
   * Set current viewport as the home position.
   * Future resetView() calls will return here instead of DEFAULT_VIEWPORT.
   */
  setHome(): void {
    const current = geointRegistry.get(this.atoms.viewportAtom)
    geointRegistry.set(this.atoms.homeViewportAtom, { ...current })
  }

  // ===========================================================================
  // Domain 2: Camera (5 methods — Phase 2 async delegation)
  // ===========================================================================

  /**
   * Animate camera to target position.
   * Sets panel flyTo target atom consumed by GeointMap's DeckGL interpolator.
   *
   * If no map consumer is mounted, falls back to direct viewport mutation after timeout.
   *
   * @returns Target viewport state
   */
  async flyTo(target: FlyToTarget): Promise<ViewportState> {
    const current = geointRegistry.get(this.atoms.viewportAtom)
    const next: ViewportState = {
      longitude: target.longitude,
      latitude: target.latitude,
      zoom: target.zoom ?? current.zoom,
      pitch: target.pitch ?? current.pitch,
      bearing: target.bearing ?? current.bearing,
    }

    // Start animation cycle
    geointRegistry.set(this.atoms.isAnimatingAtom, true)
    geointRegistry.set(this.atoms.flyToTargetAtom, {
      longitude: next.longitude,
      latitude: next.latitude,
      zoom: next.zoom,
      pitch: next.pitch,
      bearing: next.bearing,
      transitionDuration: target.transitionDuration,
      easing: target.easing,
    })

    // Fallback: if no map consumer clears animation state, snap after timeout.
    const fallbackMs = target.transitionDuration ?? 1200
    setTimeout(() => {
      if (geointRegistry.get(this.atoms.isAnimatingAtom)) {
        geointRegistry.set(this.atoms.viewportAtom, next)
        geointRegistry.set(this.atoms.isAnimatingAtom, false)
        geointRegistry.set(this.atoms.flyToTargetAtom, null)
      }
    }, fallbackMs)

    return next
  }

  /**
   * Animate camera to fit geographic bounds.
   *
   * @returns Resulting viewport state
   */
  async flyToBounds(bounds: GeoBounds): Promise<ViewportState> {
    const vp = geodesicBoundsToViewport(bounds)
    return this.flyTo({
      longitude: vp.longitude,
      latitude: vp.latitude,
      zoom: vp.zoom,
    })
  }

  /**
   * Fly to a specific entity by ID.
   * Looks up entity position from results, reads CameraBehavior trait.
   *
   * Phase 2: Will use positioningOps + CameraBehavior trait lookup.
   */
  async flyToEntity(entityId: string): Promise<ViewportState | null> {
    const results = geointRegistry.get(this.atoms.resultsAtom)
    const entity = results.find((r) => r.id === entityId)
    if (!entity) return null

    const pos = extractSearchResultPosition(entity)
    if (!pos) return null

    return this.flyTo({
      longitude: pos.lon,
      latitude: pos.lat,
      zoom: 16,
    })
  }

  /**
   * Fly to fit multiple entities.
   *
   * @param entityIds - Array of entity IDs to include
   * @returns Resulting viewport state, or null if no entities found
   */
  async flyToEntities(entityIds: string[]): Promise<ViewportState | null> {
    const results = geointRegistry.get(this.atoms.resultsAtom)
    const entities = results.filter((r) => entityIds.includes(r.id))
    const positions = entities
      .map(extractSearchResultPosition)
      .filter((p): p is { lon: number; lat: number } => p !== null)

    if (positions.length === 0) return null

    const coords: GeoCoordInput[] = positions.map((p) => ({
      longitude: p.lon,
      latitude: p.lat,
    }))
    const bounds = calculateGeoBounds(coords)
    if (!bounds) return null

    return this.flyToBounds(bounds)
  }

  /**
   * Cancel in-flight camera animation.
   * Clears animation state and pending fly-to target.
   * Hotkey: `Escape` (during animation)
   */
  cancelAnimation(): void {
    geointRegistry.set(this.atoms.isAnimatingAtom, false)
    geointRegistry.set(this.atoms.flyToTargetAtom, null)
  }

  // ===========================================================================
  // Domain 3: Layers (9 methods)
  // ===========================================================================

  /**
   * Toggle layer controls panel visibility.
   * Hotkey: `g l`
   */
  toggleLayerPanel(): void {
    const current = geointRegistry.get(this.atoms.panelStateAtom)
    const newIntelPanelMode = current.intelPanel === 'default' ? 'collapsed' : 'default'

    geointRegistry.set(this.atoms.panelStateAtom, {
      ...current,
      intelPanel: newIntelPanelMode,
    })
  }

  /**
   * Toggle visibility of a specific layer.
   * Hotkey: `g t` (tracks), `g p` (pois), etc.
   */
  toggleLayer(layerId: LayerKey): void {
    const current = geointRegistry.get(this.atoms.layerVisibilityAtom)
    const key = layerId as keyof LayerVisibility
    geointRegistry.set(this.atoms.layerVisibilityAtom, {
      ...current,
      [key]: !current[key],
    })
  }

  /**
   * Show all layers.
   * Hotkey: `g L`
   */
  showAllLayers(): void {
    geointRegistry.set(this.atoms.layerVisibilityAtom, {
      tracks: true,
      pois: true,
      flights: true,
      features: true,
      imagery: true,
      weather: true,
      heatmap: true,
      labels: true,
    })
  }

  /**
   * Hide all layers.
   * Hotkey: `g H`
   */
  hideAllLayers(): void {
    geointRegistry.set(this.atoms.layerVisibilityAtom, {
      tracks: false,
      pois: false,
      flights: false,
      features: false,
      imagery: false,
      weather: false,
      heatmap: false,
      labels: false,
    })
  }

  /**
   * Set layer opacity (clamped 0-1).
   */
  setLayerOpacity(layerId: LayerKey, opacity: number): void {
    const current = geointRegistry.get(this.atoms.layerOpacityAtom)
    geointRegistry.set(this.atoms.layerOpacityAtom, {
      ...current,
      [layerId]: Math.max(0, Math.min(1, opacity)),
    })
  }

  /**
   * Get layer visibility map.
   */
  getLayerVisibility(): LayerVisibility {
    return geointRegistry.get(this.atoms.layerVisibilityAtom)
  }

  /**
   * Cycle map basemap style.
   * Rotates through MAP_STYLE_ORDER: dark → satellite → streets → terrain → light → dark
   * Hotkey: `g m`
   */
  cycleMapStyle(): void {
    const current = geointRegistry.get(this.atoms.mapStyleAtom)
    const currentIndex = MAP_STYLE_ORDER.indexOf(current)
    const nextIndex = (currentIndex + 1) % MAP_STYLE_ORDER.length
    geointRegistry.set(this.atoms.mapStyleAtom, MAP_STYLE_ORDER[nextIndex])
  }

  /**
   * Set map basemap style directly.
   */
  setMapStyle(style: MapStyle): void {
    geointRegistry.set(this.atoms.mapStyleAtom, style)
  }

  /**
   * Get current map basemap style.
   */
  getMapStyle(): MapStyle {
    return geointRegistry.get(this.atoms.mapStyleAtom)
  }

  // ===========================================================================
  // Domain 4: Selection (8 methods)
  // ===========================================================================

  /**
   * Select all results.
   * Hotkey: `Ctrl+A`
   */
  selectAll(): void {
    const allResults = geointRegistry.get(this.atoms.resultsAtom)
    geointRegistry.set(this.atoms.selectedResultsAtom, allResults)
  }

  /**
   * Clear selection.
   * Hotkey: `Escape`
   */
  clearSelection(): void {
    geointRegistry.set(this.atoms.selectedResultsAtom, [])
  }

  /**
   * Invert selection.
   * Hotkey: `Ctrl+Shift+I`
   */
  invertSelection(): void {
    const allResults = geointRegistry.get(this.atoms.resultsAtom)
    const currentSelection = geointRegistry.get(this.atoms.selectedResultsAtom)
    const selectedIds = new Set(currentSelection.map((item) => item.id))
    const inverted = allResults.filter((item) => !selectedIds.has(item.id))
    geointRegistry.set(this.atoms.selectedResultsAtom, inverted)
  }

  /**
   * Delete selected results and clear selection.
   * Hotkey: `Delete` / `Backspace`
   */
  deleteSelected(): void {
    const allResults = geointRegistry.get(this.atoms.resultsAtom)
    const selectedItems = geointRegistry.get(this.atoms.selectedResultsAtom)
    const selectedIds = new Set(selectedItems.map((item) => item.id))

    const remaining = allResults.filter((item) => !selectedIds.has(item.id))

    geointRegistry.set(this.atoms.resultsAtom, remaining)
    geointRegistry.set(this.atoms.selectedResultsAtom, [])
  }

  /**
   * Select a single result (clears previous selection).
   */
  selectSingle(result: SearchResultItem): void {
    geointRegistry.set(this.atoms.selectedResultsAtom, [result])
  }

  /**
   * Toggle selection of a specific result.
   */
  toggleSelection(result: SearchResultItem): void {
    const currentSelection = geointRegistry.get(this.atoms.selectedResultsAtom)
    const selectedIds = new Set(currentSelection.map((item) => item.id))

    if (selectedIds.has(result.id)) {
      geointRegistry.set(
        this.atoms.selectedResultsAtom,
        currentSelection.filter((item) => item.id !== result.id)
      )
    } else {
      geointRegistry.set(this.atoms.selectedResultsAtom, [
        ...currentSelection,
        result,
      ])
    }
  }

  /**
   * Fit viewport to selected results.
   * Hotkey: `Ctrl+F`
   */
  fitToSelection(): void {
    const selectedResults = geointRegistry.get(this.atoms.selectedResultsAtom)
    if (selectedResults.length === 0) return

    const coords = this.extractCoordsFromResults(selectedResults)
    if (coords.length === 0) return

    const bounds = calculateGeoBounds(coords)
    if (!bounds) return

    const viewport = geodesicBoundsToViewport(bounds)
    geointRegistry.set(this.atoms.viewportAtom, {
      ...viewport,
      pitch: 0,
      bearing: 0,
    })
  }

  /**
   * Fit viewport to all results.
   * Hotkey: `Ctrl+Shift+F`
   */
  fitToAll(): void {
    const allResults = geointRegistry.get(this.atoms.resultsAtom)
    if (allResults.length === 0) return

    const coords = this.extractCoordsFromResults(allResults)
    if (coords.length === 0) return

    const bounds = calculateGeoBounds(coords)
    if (!bounds) return

    const viewport = geodesicBoundsToViewport(bounds)
    geointRegistry.set(this.atoms.viewportAtom, {
      ...viewport,
      pitch: 0,
      bearing: 0,
    })
  }

  /**
   * Get visible bounds from current viewport.
   * Approximation based on zoom and center.
   */
  getVisibleBounds(): GeoBounds {
    const vp = this.getViewport()
    const mpp = geodesicMetersPerPixel(vp.latitude, vp.zoom)
    // Assume 1920x1080 viewport for approximate bounds
    const halfWidthDeg = (mpp * 960) / 111_320
    const halfHeightDeg =
      (mpp * 540) / (111_320 * Math.cos(vp.latitude * (Math.PI / 180)))

    return {
      minLon: vp.longitude - halfWidthDeg,
      minLat: vp.latitude - halfHeightDeg,
      maxLon: vp.longitude + halfWidthDeg,
      maxLat: vp.latitude + halfHeightDeg,
    }
  }

  // ===========================================================================
  // Domain 5: Measurement (4 methods)
  // ===========================================================================

  /**
   * Measure distance between two points.
   * Pure computation — no atom access.
   */
  measureDistance(a: GeoCoordInput, b: GeoCoordInput): DistanceResult {
    return computeDistance(a, b)
  }

  /**
   * Measure bearing from point a to point b.
   * Pure computation — no atom access.
   */
  measureBearing(a: GeoCoordInput, b: GeoCoordInput): BearingResult {
    return computeBearing(a, b)
  }

  /**
   * Measure area of a polygon ring.
   * Pure computation — no atom access.
   */
  measureArea(ring: readonly GeoCoordInput[]): AreaResult {
    return computeArea(ring)
  }

  /**
   * Get meters per pixel at current viewport center.
   */
  metersPerPixel(): number {
    const vp = this.getViewport()
    return geodesicMetersPerPixel(vp.latitude, vp.zoom)
  }

  // ===========================================================================
  // Domain 6: Projection (3 methods — Phase 2 Effect delegation)
  // ===========================================================================

  // Phase 2: project(), unproject(), batchProject() via MapProjectionService

  // ===========================================================================
  // Domain 7: Annotation (2 stubs)
  // ===========================================================================

  /**
   * Add a marker annotation at a coordinate.
   * @experimental Phase 2 stub — not yet functional.
   */
  addMarker(coord: GeoCoord, opts?: MarkerOptions): string {
    console.warn(
      '[MapController] addMarker is a Phase 2 stub — not yet functional'
    )
    return `marker-${Date.now()}`
  }

  /**
   * Start drawing mode for annotation.
   * @experimental Phase 2 stub — not yet functional.
   */
  startDrawing(mode: DrawingMode): void {
    console.warn(
      `[MapController] startDrawing('${mode}') is a Phase 2 stub — not yet functional`
    )
  }

  // ===========================================================================
  // Domain 8: Export (2 methods)
  // ===========================================================================

  /**
   * Export current results as GeoJSON FeatureCollection.
   */
  toGeoJSON(): GeoJSON.FeatureCollection {
    const results = geointRegistry.get(this.atoms.resultsAtom)
    const features: GeoJSON.Feature[] = []

    for (const result of results) {
      const pos = extractSearchResultPosition(result)
      if (!pos) continue

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [pos.lon, pos.lat],
        },
        properties: {
          id: result.id,
          _tag: result._tag,
          name: 'name' in result ? (result as Record<string, unknown>).name : result.id,
          source: 'source' in result ? (result as Record<string, unknown>).source : undefined,
        },
      })
    }

    // Calculate bbox
    const coords = features
      .map((f) => (f.geometry as GeoJSON.Point).coordinates)
      .filter((c): c is [number, number] => c.length >= 2)

    const bbox = coords.length > 0
      ? [
          Math.min(...coords.map((c) => c[0])),
          Math.min(...coords.map((c) => c[1])),
          Math.max(...coords.map((c) => c[0])),
          Math.max(...coords.map((c) => c[1])),
        ] as [number, number, number, number]
      : undefined

    return {
      type: 'FeatureCollection',
      features,
      ...(bbox ? { bbox } : {}),
    }
  }

  /**
   * Capture map screenshot as PNG blob.
   *
   * Phase 2: Accesses DeckGL canvas via data-panel-id DOM selector.
   */
  async captureScreenshot(): Promise<Blob | null> {
    // Find DeckGL canvas by panel ID
    const canvas = document.querySelector<HTMLCanvasElement>(
      `[data-panel-id="${this.panelId}"] canvas`
    )
    if (!canvas) {
      console.warn(
        `[MapController] No canvas found for panel ${this.panelId}`
      )
      return null
    }

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png')
    })
  }

  // ===========================================================================
  // Status
  // ===========================================================================

  /**
   * Get controller status snapshot.
   */
  getStatus(): MapControllerStatus {
    return {
      panelId: this.panelId,
      viewport: this.getViewport(),
      mapStyle: this.getMapStyle(),
      selectionCount: geointRegistry.get(this.atoms.selectedResultsAtom).length,
      resultCount: geointRegistry.get(this.atoms.resultsAtom).length,
      isAnimating: geointRegistry.get(this.atoms.isAnimatingAtom),
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  /**
   * Extract GeoCoord array from search results.
   */
  private extractCoordsFromResults(
    results: readonly SearchResultItem[]
  ): GeoCoord[] {
    return results
      .map(extractSearchResultPosition)
      .filter((p): p is { lon: number; lat: number } => p !== null)
      .map((p) => ({ longitude: p.lon, latitude: p.lat }))
  }
}

// Position extraction utility is centralized in ../utils/extractPosition.ts
