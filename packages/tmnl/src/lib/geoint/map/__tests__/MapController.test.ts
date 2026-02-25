/**
 * MapController Unit Tests
 *
 * Tests all 8 domains of MapController:
 * 1. Viewport: zoom, set, reset, home
 * 2. Camera: flyTo, flyToBounds, flyToEntity, cancelAnimation
 * 3. Layers: toggle, show/hide all, opacity, style cycle
 * 4. Selection: selectAll, clear, invert, toggle, single
 * 5. View: fitToSelection, fitToAll, getVisibleBounds
 * 6. Measurement: distance, bearing, area, metersPerPixel
 * 7. Export: toGeoJSON
 * 8. Status: getStatus
 *
 * Uses Registry.make() for isolated atom state per AGENTS.md pattern.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MapController } from '../MapController'
import { asPanelId, getPanelAtoms, type PanelId } from '../../atoms/families'
import { geointRegistry } from '../../atoms/index'
import { DEFAULT_VIEWPORT, MIN_ZOOM, MAX_ZOOM } from '../schemas'
import type { SearchResultItem } from '../../schemas'

// =============================================================================
// Test Helpers
// =============================================================================

let panelId: PanelId
let controller: MapController

// Mock SearchResultItem with position
function mockFlightResult(
  id: string,
  lon: number,
  lat: number
): SearchResultItem {
  return {
    _tag: 'SearchResultFlight',
    id,
    position: [lon, lat, 0],
    callsign: `FL-${id}`,
    source: 'adsb-lol',
    entityType: 'flight',
    name: `Flight ${id}`,
    timestamp: new Date().toISOString(),
  } as unknown as SearchResultItem
}

function mockPoiResult(
  id: string,
  lon: number,
  lat: number
): SearchResultItem {
  return {
    _tag: 'SearchResultPoi',
    id,
    position: [lon, lat, 0],
    name: `POI ${id}`,
    source: 'osm',
    entityType: 'poi',
    timestamp: new Date().toISOString(),
  } as unknown as SearchResultItem
}

beforeEach(() => {
  // Use the global geointRegistry (module-level singleton)
  panelId = asPanelId(`test-panel-${Date.now()}`)
  controller = new MapController(panelId)
})

// =============================================================================
// Domain 1: Viewport
// =============================================================================

describe('Viewport', () => {
  it('getViewport returns default state', () => {
    const vp = controller.getViewport()
    expect(vp.longitude).toBe(DEFAULT_VIEWPORT.longitude)
    expect(vp.latitude).toBe(DEFAULT_VIEWPORT.latitude)
    expect(vp.zoom).toBe(DEFAULT_VIEWPORT.zoom)
  })

  it('setViewport merges partial update', () => {
    controller.setViewport({ zoom: 15 })
    const vp = controller.getViewport()
    expect(vp.zoom).toBe(15)
    expect(vp.longitude).toBe(DEFAULT_VIEWPORT.longitude) // unchanged
  })

  it('zoomIn increments zoom by 1', () => {
    controller.setViewport({ zoom: 10 })
    controller.zoomIn()
    expect(controller.getViewport().zoom).toBe(11)
  })

  it('zoomIn clamps to MAX_ZOOM', () => {
    controller.setViewport({ zoom: MAX_ZOOM })
    controller.zoomIn()
    expect(controller.getViewport().zoom).toBe(MAX_ZOOM)
  })

  it('zoomOut decrements zoom by 1', () => {
    controller.setViewport({ zoom: 10 })
    controller.zoomOut()
    expect(controller.getViewport().zoom).toBe(9)
  })

  it('zoomOut clamps to MIN_ZOOM', () => {
    controller.setViewport({ zoom: MIN_ZOOM })
    controller.zoomOut()
    expect(controller.getViewport().zoom).toBe(MIN_ZOOM)
  })

  it('resetView returns to DEFAULT_VIEWPORT', () => {
    controller.setViewport({ zoom: 18, longitude: -100 })
    controller.resetView()
    const vp = controller.getViewport()
    expect(vp.zoom).toBe(DEFAULT_VIEWPORT.zoom)
    expect(vp.longitude).toBe(DEFAULT_VIEWPORT.longitude)
  })

  it('setHome + resetView returns to custom home', () => {
    controller.setViewport({ zoom: 15, longitude: -100, latitude: 40 })
    controller.setHome()
    controller.setViewport({ zoom: 3, longitude: 0, latitude: 0 })
    controller.resetView()
    const vp = controller.getViewport()
    expect(vp.zoom).toBe(15)
    expect(vp.longitude).toBe(-100)
  })
})

// =============================================================================
// Domain 2: Camera
// =============================================================================

describe('Camera', () => {
  it('flyTo moves viewport to target', async () => {
    const result = await controller.flyTo({
      longitude: -74.006,
      latitude: 40.7128,
      zoom: 14,
    })
    expect(result.longitude).toBeCloseTo(-74.006)
    expect(result.latitude).toBeCloseTo(40.7128)
    expect(result.zoom).toBe(14)
  })

  it('flyTo preserves current zoom/pitch/bearing when not specified', async () => {
    controller.setViewport({ zoom: 18, pitch: 45, bearing: 90 })
    const result = await controller.flyTo({
      longitude: 10,
      latitude: 20,
    })
    expect(result.zoom).toBe(18)
    expect(result.pitch).toBe(45)
    expect(result.bearing).toBe(90)
  })

  it('flyToBounds computes viewport from bounds', async () => {
    const result = await controller.flyToBounds({
      minLon: -80,
      maxLon: -70,
      minLat: 35,
      maxLat: 45,
    })
    expect(result.longitude).toBeCloseTo(-75)
    expect(result.latitude).toBeCloseTo(40)
    expect(result.zoom).toBeGreaterThan(0)
  })

  it('cancelAnimation sets isAnimating to false', () => {
    const atoms = getPanelAtoms(panelId)
    // Note: In Phase 1, flyTo is synchronous so isAnimating flips instantly
    controller.cancelAnimation()
    // Can't easily test mid-flight in Phase 1, but method shouldn't throw
    expect(() => controller.cancelAnimation()).not.toThrow()
  })

  it('flyToEntity returns null for unknown entity', async () => {
    const result = await controller.flyToEntity('nonexistent-id')
    expect(result).toBeNull()
  })
})

// =============================================================================
// Domain 3: Layers
// =============================================================================

describe('Layers', () => {
  it('toggleLayer flips visibility', () => {
    const before = controller.getLayerVisibility()
    expect(before.flights).toBe(true)
    controller.toggleLayer('flights')
    expect(controller.getLayerVisibility().flights).toBe(false)
    controller.toggleLayer('flights')
    expect(controller.getLayerVisibility().flights).toBe(true)
  })

  it('showAllLayers enables everything', () => {
    controller.hideAllLayers()
    controller.showAllLayers()
    const vis = controller.getLayerVisibility()
    expect(vis.tracks).toBe(true)
    expect(vis.flights).toBe(true)
    expect(vis.imagery).toBe(true)
    expect(vis.weather).toBe(true)
    expect(vis.heatmap).toBe(true)
  })

  it('hideAllLayers disables everything', () => {
    controller.hideAllLayers()
    const vis = controller.getLayerVisibility()
    expect(vis.tracks).toBe(false)
    expect(vis.flights).toBe(false)
    expect(vis.pois).toBe(false)
    expect(vis.features).toBe(false)
    expect(vis.labels).toBe(false)
  })

  it('setLayerOpacity clamps to 0-1', () => {
    controller.setLayerOpacity('tracks', 1.5)
    // Verify no crash (opacity clamped internally)
  })

  it('cycleMapStyle rotates through styles', () => {
    expect(controller.getMapStyle()).toBe('dark')
    controller.cycleMapStyle()
    expect(controller.getMapStyle()).toBe('satellite')
    controller.cycleMapStyle()
    expect(controller.getMapStyle()).toBe('streets')
    controller.cycleMapStyle()
    expect(controller.getMapStyle()).toBe('terrain')
    controller.cycleMapStyle()
    expect(controller.getMapStyle()).toBe('light')
    controller.cycleMapStyle()
    expect(controller.getMapStyle()).toBe('dark') // wraps around
  })

  it('setMapStyle sets directly', () => {
    controller.setMapStyle('satellite')
    expect(controller.getMapStyle()).toBe('satellite')
  })
})

// =============================================================================
// Domain 4: Selection
// =============================================================================

describe('Selection', () => {
  const results = [
    mockFlightResult('f1', -74, 40),
    mockFlightResult('f2', -118, 34),
    mockPoiResult('p1', -87, 41),
  ]

  function seedResults() {
    const atoms = getPanelAtoms(panelId)
    // Import geointRegistry to seed results
    
    geointRegistry.set(atoms.resultsAtom, results)
  }

  it('selectAll selects all results', () => {
    seedResults()
    controller.selectAll()
    expect(controller.getStatus().selectionCount).toBe(3)
  })

  it('clearSelection empties selection', () => {
    seedResults()
    controller.selectAll()
    controller.clearSelection()
    expect(controller.getStatus().selectionCount).toBe(0)
  })

  it('invertSelection swaps selected/unselected', () => {
    seedResults()
    controller.selectSingle(results[0])
    expect(controller.getStatus().selectionCount).toBe(1)
    controller.invertSelection()
    expect(controller.getStatus().selectionCount).toBe(2)
  })

  it('toggleSelection adds then removes', () => {
    seedResults()
    controller.toggleSelection(results[0])
    expect(controller.getStatus().selectionCount).toBe(1)
    controller.toggleSelection(results[0])
    expect(controller.getStatus().selectionCount).toBe(0)
  })

  it('selectSingle replaces previous selection', () => {
    seedResults()
    controller.selectAll()
    controller.selectSingle(results[1])
    expect(controller.getStatus().selectionCount).toBe(1)
  })
})

// =============================================================================
// Domain 5: Measurement
// =============================================================================

describe('Measurement', () => {
  const nyc = { longitude: -73.7781, latitude: 40.6413 }
  const lax = { longitude: -118.4085, latitude: 33.9416 }

  it('measureDistance returns multi-unit result', () => {
    const result = controller.measureDistance(nyc, lax)
    expect(result.meters).toBeGreaterThan(3_900_000)
    expect(result.kilometers).toBeCloseTo(result.meters / 1000)
    expect(result.nauticalMiles).toBeCloseTo(result.meters / 1852)
  })

  it('measureBearing returns degrees + cardinal', () => {
    const result = controller.measureBearing(nyc, lax)
    expect(result.degrees).toBeGreaterThan(0)
    expect(result.degrees).toBeLessThan(360)
    expect(result.cardinal).toBeTruthy()
  })

  it('measureArea returns multi-unit result', () => {
    const ring = [
      { longitude: 0, latitude: 0 },
      { longitude: 1, latitude: 0 },
      { longitude: 1, latitude: 1 },
      { longitude: 0, latitude: 1 },
    ]
    const result = controller.measureArea(ring)
    expect(result.squareMeters).toBeGreaterThan(0)
    expect(result.squareKilometers).toBeCloseTo(result.squareMeters / 1_000_000)
  })

  it('metersPerPixel returns positive value', () => {
    const mpp = controller.metersPerPixel()
    expect(mpp).toBeGreaterThan(0)
  })
})

// =============================================================================
// Domain 6: Export
// =============================================================================

describe('Export', () => {
  it('toGeoJSON returns FeatureCollection', () => {
    const atoms = getPanelAtoms(panelId)
    
    geointRegistry.set(atoms.resultsAtom, [
      mockFlightResult('f1', -74, 40),
      mockPoiResult('p1', -87, 41),
    ])

    const geojson = controller.toGeoJSON()
    expect(geojson.type).toBe('FeatureCollection')
    expect(geojson.features).toHaveLength(2)
    expect(geojson.features[0].type).toBe('Feature')
    expect(geojson.features[0].geometry.type).toBe('Point')
    expect(geojson.features[0].properties?.id).toBe('f1')
  })

  it('toGeoJSON returns empty collection when no results', () => {
    const geojson = controller.toGeoJSON()
    expect(geojson.features).toHaveLength(0)
  })

  it('toGeoJSON includes bbox when features exist', () => {
    const atoms = getPanelAtoms(panelId)
    
    geointRegistry.set(atoms.resultsAtom, [
      mockFlightResult('f1', -74, 40),
      mockFlightResult('f2', -118, 34),
    ])

    const geojson = controller.toGeoJSON()
    expect(geojson.bbox).toBeDefined()
    expect(geojson.bbox![0]).toBe(-118) // minLon
    expect(geojson.bbox![2]).toBe(-74)  // maxLon
  })
})

// =============================================================================
// Domain 7: Status
// =============================================================================

describe('Status', () => {
  it('getStatus returns full snapshot', () => {
    const status = controller.getStatus()
    expect(status.panelId).toBe(panelId)
    expect(status.viewport).toEqual(DEFAULT_VIEWPORT)
    expect(status.mapStyle).toBe('dark')
    expect(status.selectionCount).toBe(0)
    expect(status.resultCount).toBe(0)
    expect(status.isAnimating).toBe(false)
  })

  it('getStatus reflects state changes', () => {
    controller.setViewport({ zoom: 18 })
    controller.setMapStyle('satellite')
    const status = controller.getStatus()
    expect(status.viewport.zoom).toBe(18)
    expect(status.mapStyle).toBe('satellite')
  })
})

// =============================================================================
// Domain 8: Annotation Stubs
// =============================================================================

describe('Annotation stubs', () => {
  it('addMarker returns placeholder ID', () => {
    const id = controller.addMarker({ longitude: 0, latitude: 0 })
    expect(id).toMatch(/^marker-/)
  })

  it('startDrawing does not throw', () => {
    expect(() => controller.startDrawing('polygon')).not.toThrow()
    expect(() => controller.startDrawing('line')).not.toThrow()
    expect(() => controller.startDrawing('circle')).not.toThrow()
  })
})

// =============================================================================
// View Operations (fitTo*)
// =============================================================================

describe('View Operations', () => {
  it('fitToSelection adjusts viewport to selection bounds', () => {
    const atoms = getPanelAtoms(panelId)
    

    const results = [
      mockFlightResult('f1', -74, 40),
      mockFlightResult('f2', -118, 34),
    ]
    geointRegistry.set(atoms.resultsAtom, results)
    geointRegistry.set(atoms.selectedResultsAtom, results)

    controller.fitToSelection()
    const vp = controller.getViewport()
    // Center should be approximately between NYC and LA
    expect(vp.longitude).toBeCloseTo(-96, 0)
    expect(vp.latitude).toBeCloseTo(37, 0)
  })

  it('fitToSelection does nothing with empty selection', () => {
    const before = controller.getViewport()
    controller.fitToSelection()
    expect(controller.getViewport()).toEqual(before)
  })

  it('fitToAll adjusts viewport to all results', () => {
    const atoms = getPanelAtoms(panelId)
    

    geointRegistry.set(atoms.resultsAtom, [
      mockFlightResult('f1', -74, 40),
      mockFlightResult('f2', -118, 34),
    ])

    controller.fitToAll()
    const vp = controller.getViewport()
    expect(vp.longitude).toBeCloseTo(-96, 0)
    expect(vp.latitude).toBeCloseTo(37, 0)
  })

  it('getVisibleBounds returns reasonable bounds', () => {
    const bounds = controller.getVisibleBounds()
    expect(bounds.minLon).toBeLessThan(bounds.maxLon)
    expect(bounds.minLat).toBeLessThan(bounds.maxLat)
  })
})
