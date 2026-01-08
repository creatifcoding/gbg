/**
 * Search Results Layers - deck.gl layers for ALLINT COP search results
 *
 * Creates visualization layers for different search result types:
 * - Tracks: Animated icons with heading indicators
 * - POIs: Categorized markers with labels
 * - Flights: Aircraft icons with altitude-based sizing
 * - Features: GeoJSON geometry rendering
 *
 * @see beads:tmnl-j5pyc ALLINT COP Search System
 * @module
 */

import { ScatterplotLayer, TextLayer, GeoJsonLayer } from '@deck.gl/layers'
import type { Layer, PickingInfo } from '@deck.gl/core'
import type {
  SearchResultItem,
  SearchResultTrack,
  SearchResultPoi,
  SearchResultFlight,
  SearchResultFeature,
  IntelSource,
} from '../schemas'

// =============================================================================
// Types
// =============================================================================

export interface SearchResultLayerOptions {
  /** Base layer ID prefix */
  idPrefix?: string
  /** Whether layers are pickable */
  pickable?: boolean
  /** Opacity for all layers */
  opacity?: number
  /** Size scale multiplier */
  sizeScale?: number
  /** Callback when a result is picked */
  onPick?: (info: PickingInfo<SearchResultItem>) => void
}

// =============================================================================
// Color Configuration
// =============================================================================

const SOURCE_COLORS: Record<IntelSource, [number, number, number, number]> = {
  track: [0, 255, 128, 200],      // Green
  osm: [64, 156, 255, 200],       // Blue
  opensky: [255, 200, 64, 200],   // Yellow/Gold
  feature: [168, 85, 247, 200],   // Purple
  adsb_lol: [255, 140, 64, 200],  // Orange
  planet: [64, 224, 208, 200],    // Teal/Cyan
  sentinel: [0, 191, 255, 200],   // Deep Sky Blue (Copernicus theme)
  weather: [255, 165, 0, 200],    // Orange (weather theme)
  custom: [156, 163, 175, 200],   // Gray
}

const CLASSIFICATION_COLORS: Record<string, [number, number, number]> = {
  friendly: [0, 255, 0],
  hostile: [255, 0, 0],
  neutral: [255, 255, 0],
  unknown: [128, 128, 128],
}

// =============================================================================
// Layer Factories
// =============================================================================

/**
 * Create scatterplot layer for track results
 */
export function createTrackResultsLayer(
  tracks: SearchResultTrack[],
  options: SearchResultLayerOptions = {}
): ScatterplotLayer<SearchResultTrack> {
  const { idPrefix = 'search', pickable = true, opacity = 1, sizeScale = 1 } = options

  return new ScatterplotLayer<SearchResultTrack>({
    id: `${idPrefix}-tracks`,
    data: tracks,
    pickable,
    opacity,
    stroked: true,
    filled: true,
    radiusScale: 6 * sizeScale,
    radiusMinPixels: 4,
    radiusMaxPixels: 20,
    lineWidthMinPixels: 1,
    getPosition: (d) => [d.position[0], d.position[1], d.position[2] || 0],
    getRadius: (d) => Math.max(100, d.speed * 10),
    getFillColor: (d) => [
      ...(CLASSIFICATION_COLORS[d.classification] || [128, 128, 128]),
      Math.round(d.score * 255),
    ] as [number, number, number, number],
    getLineColor: [255, 255, 255, 128],
    getLineWidth: 1,
  })
}

/**
 * Create icon layer for POI results
 */
export function createPoiResultsLayer(
  pois: SearchResultPoi[],
  options: SearchResultLayerOptions = {}
): ScatterplotLayer<SearchResultPoi> {
  const { idPrefix = 'search', pickable = true, opacity = 1, sizeScale = 1 } = options

  return new ScatterplotLayer<SearchResultPoi>({
    id: `${idPrefix}-pois`,
    data: pois,
    pickable,
    opacity,
    stroked: true,
    filled: true,
    radiusScale: 4 * sizeScale,
    radiusMinPixels: 6,
    radiusMaxPixels: 16,
    lineWidthMinPixels: 1,
    getPosition: (d) => [d.position[0], d.position[1]],
    getRadius: 50,
    getFillColor: SOURCE_COLORS.osm,
    getLineColor: [255, 255, 255, 200],
    getLineWidth: 1,
  })
}

/**
 * Create text layer for POI labels
 */
export function createPoiLabelsLayer(
  pois: SearchResultPoi[],
  options: SearchResultLayerOptions = {}
): TextLayer<SearchResultPoi> {
  const { idPrefix = 'search', pickable = false, opacity = 1, sizeScale = 1 } = options

  return new TextLayer<SearchResultPoi>({
    id: `${idPrefix}-poi-labels`,
    data: pois,
    pickable,
    opacity,
    getPosition: (d) => [d.position[0], d.position[1]],
    getText: (d) => d.name,
    getSize: 12 * sizeScale,
    getColor: [255, 255, 255, 220],
    getAngle: 0,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'top',
    getPixelOffset: [0, 10],
    fontFamily: 'Inter, system-ui, sans-serif',
    fontWeight: 500,
    outlineWidth: 2,
    outlineColor: [0, 0, 0, 180],
  })
}

/**
 * Create scatterplot layer for flight results
 */
export function createFlightResultsLayer(
  flights: SearchResultFlight[],
  options: SearchResultLayerOptions = {}
): ScatterplotLayer<SearchResultFlight> {
  const { idPrefix = 'search', pickable = true, opacity = 1, sizeScale = 1 } = options

  return new ScatterplotLayer<SearchResultFlight>({
    id: `${idPrefix}-flights`,
    data: flights,
    pickable,
    opacity,
    stroked: true,
    filled: true,
    radiusScale: 8 * sizeScale,
    radiusMinPixels: 6,
    radiusMaxPixels: 24,
    lineWidthMinPixels: 1,
    getPosition: (d) => [d.position[0], d.position[1], d.position[2] || 0],
    // Size based on altitude (higher = larger)
    getRadius: (d) => Math.max(50, d.position[2] / 100),
    getFillColor: (d) =>
      d.onGround ? [100, 100, 100, 200] : SOURCE_COLORS.opensky,
    getLineColor: [255, 255, 255, 180],
    getLineWidth: 1,
  })
}

/**
 * Create text layer for flight callsigns
 */
export function createFlightLabelsLayer(
  flights: SearchResultFlight[],
  options: SearchResultLayerOptions = {}
): TextLayer<SearchResultFlight> {
  const { idPrefix = 'search', pickable = false, opacity = 1, sizeScale = 1 } = options

  return new TextLayer<SearchResultFlight>({
    id: `${idPrefix}-flight-labels`,
    data: flights.filter((f) => f.callsign),
    pickable,
    opacity,
    getPosition: (d) => [d.position[0], d.position[1], d.position[2] || 0],
    getText: (d) => d.callsign || d.icao24,
    getSize: 10 * sizeScale,
    getColor: [255, 220, 64, 255],
    getAngle: 0,
    getTextAnchor: 'middle',
    getAlignmentBaseline: 'top',
    getPixelOffset: [0, 12],
    fontFamily: 'JetBrains Mono, monospace',
    fontWeight: 600,
    outlineWidth: 2,
    outlineColor: [0, 0, 0, 200],
  })
}

/**
 * Create GeoJSON layer for feature results
 */
export function createFeatureResultsLayer(
  features: SearchResultFeature[],
  options: SearchResultLayerOptions = {}
): GeoJsonLayer {
  const { idPrefix = 'search', pickable = true, opacity = 1 } = options

  // Convert to GeoJSON FeatureCollection
  const geojsonFeatures = features.map((f) => ({
    type: 'Feature' as const,
    id: f.featureId as string,
    geometry: {
      type: f.geometryType as 'Point' | 'LineString' | 'Polygon',
      coordinates:
        f.geometryType === 'Point'
          ? [f.position[0], f.position[1]]
          : [], // Would need full geometry for LineString/Polygon
    },
    properties: {
      ...(f.properties as Record<string, unknown>),
      _searchResult: f,
    },
  }))

  return new GeoJsonLayer({
    id: `${idPrefix}-features`,
    data: {
      type: 'FeatureCollection' as const,
      features: geojsonFeatures,
    } as GeoJSON.FeatureCollection,
    pickable,
    opacity,
    stroked: true,
    filled: true,
    pointType: 'circle',
    lineWidthMinPixels: 2,
    pointRadiusMinPixels: 4,
    pointRadiusMaxPixels: 16,
    getFillColor: SOURCE_COLORS.feature,
    getLineColor: [255, 255, 255, 180],
    getLineWidth: 2,
    getPointRadius: 8,
  })
}

// =============================================================================
// Combined Layer Factory
// =============================================================================

/**
 * Create all search result layers from a mixed array of results
 *
 * @example
 * ```typescript
 * const layers = createSearchResultLayers(results, {
 *   idPrefix: 'viewport-search',
 *   pickable: true,
 *   onPick: (info) => console.log('Picked:', info.object),
 * })
 *
 * // Use with DeckGL
 * <DeckGL layers={[...otherLayers, ...layers]} />
 * ```
 */
export function createSearchResultLayers(
  results: SearchResultItem[],
  options: SearchResultLayerOptions = {}
): Layer[] {
  // Group results by type
  const tracks: SearchResultTrack[] = []
  const pois: SearchResultPoi[] = []
  const flights: SearchResultFlight[] = []
  const features: SearchResultFeature[] = []

  for (const result of results) {
    switch (result._tag) {
      case 'SearchResultTrack':
        tracks.push(result)
        break
      case 'SearchResultPoi':
        pois.push(result)
        break
      case 'SearchResultFlight':
        flights.push(result)
        break
      case 'SearchResultFeature':
        features.push(result)
        break
    }
  }

  const layers: Layer[] = []

  // Add layers in z-order (bottom to top)
  if (features.length > 0) {
    layers.push(createFeatureResultsLayer(features, options))
  }

  if (pois.length > 0) {
    layers.push(createPoiResultsLayer(pois, options))
    layers.push(createPoiLabelsLayer(pois, options))
  }

  if (flights.length > 0) {
    layers.push(createFlightResultsLayer(flights, options))
    layers.push(createFlightLabelsLayer(flights, options))
  }

  if (tracks.length > 0) {
    layers.push(createTrackResultsLayer(tracks, options))
  }

  return layers
}

// =============================================================================
// Exports
// =============================================================================

export default createSearchResultLayers
