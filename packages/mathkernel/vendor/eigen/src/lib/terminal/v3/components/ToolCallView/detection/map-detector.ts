/**
 * Map Data Detection
 *
 * Three-tier detection system for identifying map-producing tool results:
 * 1. Explicit tool name match (MAP_PRODUCING_TOOLS set)
 * 2. Structured schema match (_type: 'MapOutput')
 * 3. GeoJSON auto-detection (FeatureCollection/Feature + coordinates)
 *
 * @module terminal/v3/components/ToolCallView/detection/map-detector
 */

import { Option } from 'effect'
import { nanoid } from 'nanoid'
import {
  isFeatureCollection,
  isFeature,
  isCoordinateArray,
  isStructuredMapOutput,
  type FeatureCollection,
  type Feature,
  type MapLayer,
  type MapMarker,
  type MapBounds,
  type DetectedMapData,
  type StructuredMapOutput,
  type Position,
} from '../../../schemas/map-output'

// =============================================================================
// Explicit Tool Name Registry
// =============================================================================

/**
 * Known map-producing tool names.
 * Tools in this set will always trigger map detection.
 */
export const MAP_PRODUCING_TOOLS = new Set([
  // ==========================================================================
  // osmmcp (NERVsystems/osmmcp) - 25 tools
  // OpenStreetMap MCP server providing precision geospatial tools
  // ==========================================================================
  // Geocoding
  'mcp__OSM__geocode_address',
  'mcp__OSM__reverse_geocode',
  // Geographic & Spatial
  'mcp__OSM__bbox_from_points',
  'mcp__OSM__centroid_points',
  'mcp__OSM__geo_distance',
  'mcp__OSM__sort_by_distance',
  // Routing
  'mcp__OSM__route_fetch',
  'mcp__OSM__route_sample',
  'mcp__OSM__get_route_directions',
  // Polyline
  'mcp__OSM__polyline_encode',
  'mcp__OSM__polyline_decode',
  // OSM Data
  'mcp__OSM__osm_query_bbox',
  'mcp__OSM__filter_tags',
  'mcp__OSM__enrich_emissions',
  // Places & POI
  'mcp__OSM__find_nearby_places',
  'mcp__OSM__suggest_meeting_point',
  'mcp__OSM__explore_area',
  // Specialized
  'mcp__OSM__find_charging_stations',
  'mcp__OSM__find_schools_nearby',
  'mcp__OSM__find_parking_facilities',
  'mcp__OSM__analyze_commute',
  'mcp__OSM__analyze_neighborhood',
  // Mapping
  'mcp__OSM__get_map_image',

  // ==========================================================================
  // Mapbox MCP tools (if configured separately)
  // ==========================================================================
  'mcp__mapbox__geocode',
  'mcp__mapbox__reverse_geocode',
  'mcp__mapbox__directions',
  'mcp__mapbox__isochrone',
  'mcp__mapbox__matrix',

  // ==========================================================================
  // Generic geo tools (custom or other MCPs)
  // ==========================================================================
  'mcp__overpass__query',
  'mcp__osm__search',
  'search_locations',
  'get_route',
  'find_places',
  'geocode',
  'get_directions',

  // ==========================================================================
  // GeoJSON loading
  // ==========================================================================
  'mcp__geojson__load',
  'mcp__geojson__parse',
  'load_geojson',
])

// =============================================================================
// Detection Context
// =============================================================================

export interface DetectionContext {
  /** Name of the tool that produced the result */
  toolName: string
  /** Unique ID for this tool call */
  toolCallId: string
  /** Raw result from the tool */
  result: unknown
}

// =============================================================================
// Main Detection Function
// =============================================================================

/**
 * Main detection entry point - tries all strategies in priority order
 *
 * @param ctx - Detection context with tool info and result
 * @returns Option containing detected map data, or None if not a map result
 */
export function detectMapData(ctx: DetectionContext): Option.Option<DetectedMapData> {
  const { toolName, toolCallId, result } = ctx

  console.log('[map-detector] detectMapData called:', { toolName, toolCallId, resultType: typeof result })
  console.log('[map-detector] Result preview:', JSON.stringify(result).slice(0, 500))

  // Skip if result is null/undefined
  if (result == null) {
    console.log('[map-detector] Result is null/undefined, skipping')
    return Option.none()
  }

  // 1. Explicit tool name match - highest priority
  if (MAP_PRODUCING_TOOLS.has(toolName)) {
    console.log('[map-detector] Tool is in MAP_PRODUCING_TOOLS, attempting normalization')
    const normalized = normalizeToMapData(result, toolCallId, 'explicit')
    console.log('[map-detector] Normalization result:', Option.isSome(normalized) ? 'SUCCESS' : 'FAILED')
    if (Option.isSome(normalized)) {
      return normalized
    }
  } else {
    console.log('[map-detector] Tool NOT in MAP_PRODUCING_TOOLS:', toolName)
  }

  // 2. Structured schema match (_type: 'MapOutput' or has layers/markers/geojson)
  if (isStructuredMapOutput(result)) {
    return Option.some(structuredToDetected(result as StructuredMapOutput, toolCallId))
  }

  // 3. GeoJSON auto-detection
  if (isFeatureCollection(result)) {
    return Option.some(featureCollectionToDetected(result, toolCallId))
  }

  if (isFeature(result)) {
    return Option.some(featureToDetected(result, toolCallId))
  }

  // 4. Coordinate array detection (moderate strategy)
  if (Array.isArray(result) && result.length > 0) {
    // Check if it's an array of coordinate arrays
    if (isCoordinateArray(result[0])) {
      return Option.some(coordinatesToDetected(result as number[][], toolCallId))
    }
    // Check if it's an array of objects with coordinates
    const coords = extractCoordinatesFromArray(result)
    if (coords.length > 0) {
      return Option.some(coordinatesToDetected(coords, toolCallId))
    }
  }

  // 5. Check if result is an object with nested geo data
  if (typeof result === 'object' && result !== null) {
    const nested = findNestedGeoData(result as Record<string, unknown>)
    if (Option.isSome(nested)) {
      return nested
    }
  }

  // 6. Text-based detection (coordinates in string content)
  if (typeof result === 'string' && result.length > 10) {
    const textDetected = detectMapFromText(result, toolCallId)
    if (Option.isSome(textDetected)) {
      return textDetected
    }
  }

  return Option.none()
}

// =============================================================================
// Normalization Functions
// =============================================================================

/**
 * Attempt to normalize any result to DetectedMapData
 */
function normalizeToMapData(
  result: unknown,
  id: string,
  source: 'explicit' | 'schema' | 'detection'
): Option.Option<DetectedMapData> {
  // Try structured first
  if (isStructuredMapOutput(result)) {
    const detected = structuredToDetected(result as StructuredMapOutput, id)
    return Option.some({ ...detected, source })
  }

  // Try FeatureCollection
  if (isFeatureCollection(result)) {
    const detected = featureCollectionToDetected(result, id)
    return Option.some({ ...detected, source })
  }

  // Try Feature
  if (isFeature(result)) {
    const detected = featureToDetected(result, id)
    return Option.some({ ...detected, source })
  }

  // Try coordinate array
  if (Array.isArray(result) && result.length > 0 && isCoordinateArray(result[0])) {
    const detected = coordinatesToDetected(result as number[][], id)
    return Option.some({ ...detected, source })
  }

  // Try extracting from object
  if (typeof result === 'object' && result !== null) {
    const nested = findNestedGeoData(result as Record<string, unknown>)
    if (Option.isSome(nested)) {
      return Option.some({ ...nested.value, source })
    }
  }

  return Option.none()
}

/**
 * Convert StructuredMapOutput to DetectedMapData
 */
function structuredToDetected(
  output: StructuredMapOutput,
  id: string
): DetectedMapData {
  const layers: MapLayer[] = [...(output.layers ?? [])]
  const markers: MapMarker[] = [...(output.markers ?? [])]

  // If geojson provided, add as a layer
  if (output.geojson) {
    const geojsonData = isFeatureCollection(output.geojson)
      ? output.geojson
      : { type: 'FeatureCollection' as const, features: [output.geojson] }

    layers.push({
      id: `geojson-${id}`,
      type: 'geojson',
      data: geojsonData,
    })

    // Extract point markers from features
    const pointMarkers = extractMarkersFromFeatures(geojsonData.features)
    markers.push(...pointMarkers)
  }

  return {
    id,
    layers,
    markers,
    bounds: output.bounds,
    title: output.title,
    source: 'schema',
  }
}

/**
 * Convert FeatureCollection to DetectedMapData
 */
function featureCollectionToDetected(
  fc: FeatureCollection,
  id: string
): DetectedMapData {
  return {
    id,
    layers: [
      {
        id: `geojson-${id}`,
        type: 'geojson',
        data: fc,
      },
    ],
    markers: extractMarkersFromFeatures(fc.features),
    bounds: computeBoundsFromFeatures(fc.features),
    source: 'detection',
  }
}

/**
 * Convert single Feature to DetectedMapData
 */
function featureToDetected(feature: Feature, id: string): DetectedMapData {
  const fc: FeatureCollection = { type: 'FeatureCollection', features: [feature] }
  return featureCollectionToDetected(fc, id)
}

/**
 * Convert coordinate array to DetectedMapData (markers only)
 */
function coordinatesToDetected(coords: number[][], id: string): DetectedMapData {
  const markers: MapMarker[] = coords.map((coord, i) => ({
    id: `marker-${id}-${i}`,
    position: [coord[0], coord[1], coord[2]] as Position,
    label: `Point ${i + 1}`,
  }))

  return {
    id,
    layers: [],
    markers,
    bounds: computeBoundsFromCoords(coords),
    source: 'detection',
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract markers from Point features
 */
function extractMarkersFromFeatures(features: Feature[]): MapMarker[] {
  return features
    .filter((f) => f.geometry?.type === 'Point')
    .map((f, i) => {
      const coords = f.geometry?.coordinates as number[]
      if (!coords || !isCoordinateArray(coords)) return null

      const props = f.properties as Record<string, unknown> | null

      return {
        id: f.id?.toString() ?? `marker-${i}`,
        position: [coords[0], coords[1], coords[2]] as Position,
        label: getStringProp(props, ['name', 'title', 'label']),
        description: getStringProp(props, ['description', 'desc', 'text']),
        popup: getStringProp(props, ['popup', 'tooltip', 'info']),
      }
    })
    .filter((m): m is MapMarker => m !== null)
}

/**
 * Get string property from object by trying multiple keys
 */
function getStringProp(
  obj: Record<string, unknown> | null | undefined,
  keys: string[]
): string | undefined {
  if (!obj) return undefined
  for (const key of keys) {
    const val = obj[key]
    if (typeof val === 'string' && val.length > 0) return val
  }
  return undefined
}

/**
 * Compute bounding box from features
 */
function computeBoundsFromFeatures(features: Feature[]): MapBounds | undefined {
  const coords: number[][] = []

  for (const f of features) {
    if (!f.geometry) continue
    extractCoordsFromGeometry(f.geometry.coordinates, coords)
  }

  return computeBoundsFromCoords(coords)
}

/**
 * Recursively extract coordinate pairs from geometry
 */
function extractCoordsFromGeometry(geom: unknown, acc: number[][]): void {
  if (Array.isArray(geom)) {
    if (typeof geom[0] === 'number' && typeof geom[1] === 'number') {
      // This is a coordinate pair
      acc.push(geom as number[])
    } else {
      // Recurse into nested arrays
      for (const item of geom) {
        extractCoordsFromGeometry(item, acc)
      }
    }
  }
}

/**
 * Compute bounding box from coordinate array
 */
function computeBoundsFromCoords(coords: number[][]): MapBounds | undefined {
  if (coords.length === 0) return undefined

  let north = -90,
    south = 90,
    east = -180,
    west = 180

  for (const coord of coords) {
    const [lon, lat] = coord
    if (typeof lon !== 'number' || typeof lat !== 'number') continue

    north = Math.max(north, lat)
    south = Math.min(south, lat)
    east = Math.max(east, lon)
    west = Math.min(west, lon)
  }

  // Validate bounds are sensible
  if (north < south || east < west) return undefined

  return { north, south, east, west }
}

/**
 * Extract coordinates from array of objects with lat/lng properties
 */
function extractCoordinatesFromArray(arr: unknown[]): number[][] {
  const coords: number[][] = []

  for (const item of arr) {
    if (typeof item !== 'object' || item === null) continue
    const obj = item as Record<string, unknown>

    // Try common coordinate property patterns
    const lon =
      getNumericProp(obj, ['lon', 'lng', 'longitude', 'x']) ??
      getNumericProp(obj, ['coordinates', 'coord', 'position'], 0)

    const lat =
      getNumericProp(obj, ['lat', 'latitude', 'y']) ??
      getNumericProp(obj, ['coordinates', 'coord', 'position'], 1)

    if (lon !== undefined && lat !== undefined && isValidLonLat(lon, lat)) {
      coords.push([lon, lat])
    }
  }

  return coords
}

/**
 * Get numeric property from object
 */
function getNumericProp(
  obj: Record<string, unknown>,
  keys: string[],
  index?: number
): number | undefined {
  for (const key of keys) {
    const val = obj[key]
    if (typeof val === 'number') return val
    if (Array.isArray(val) && index !== undefined && typeof val[index] === 'number') {
      return val[index]
    }
  }
  return undefined
}

/**
 * Validate longitude/latitude values
 */
function isValidLonLat(lon: number, lat: number): boolean {
  return lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90
}

/**
 * Find nested geo data in an object
 */
function findNestedGeoData(
  obj: Record<string, unknown>
): Option.Option<DetectedMapData> {
  // ===========================================================================
  // 1. Handle osmmcp response format: { place: { location: { latitude, longitude } } }
  // ===========================================================================
  const osmResult = extractOsmMcpCoordinates(obj)
  if (osmResult.length > 0) {
    console.log('[map-detector] Found osmmcp format coordinates:', osmResult)
    return Option.some(coordinatesToDetected(osmResult, nanoid()))
  }

  // ===========================================================================
  // 2. Check common nesting patterns (GeoJSON-style)
  // ===========================================================================
  const geoKeys = [
    'geojson',
    'geometry',
    'features',
    'data',
    'result',
    'results',
    'locations',
    'places',
    'points',
    'coordinates',
  ]

  for (const key of geoKeys) {
    const val = obj[key]
    if (val == null) continue

    if (isFeatureCollection(val)) {
      return Option.some(featureCollectionToDetected(val, nanoid()))
    }
    if (isFeature(val)) {
      return Option.some(featureToDetected(val, nanoid()))
    }
    if (Array.isArray(val) && val.length > 0) {
      if (isCoordinateArray(val[0])) {
        return Option.some(coordinatesToDetected(val as number[][], nanoid()))
      }
      const coords = extractCoordinatesFromArray(val)
      if (coords.length > 0) {
        return Option.some(coordinatesToDetected(coords, nanoid()))
      }
    }
  }

  return Option.none()
}

/**
 * Extract coordinates from osmmcp response formats
 * Handles: geocode_address, find_nearby_places, explore_area, etc.
 */
function extractOsmMcpCoordinates(obj: Record<string, unknown>): number[][] {
  const coords: number[][] = []
  console.log('[map-detector] extractOsmMcpCoordinates checking:', Object.keys(obj))

  // Pattern 1: { place: { location: { latitude, longitude } } }
  const place = obj['place'] as Record<string, unknown> | undefined
  console.log('[map-detector] place:', place ? Object.keys(place) : 'undefined')
  if (place) {
    const location = place['location'] as Record<string, unknown> | undefined
    if (location) {
      const lat = location['latitude']
      const lon = location['longitude']
      if (typeof lat === 'number' && typeof lon === 'number' && isValidLonLat(lon, lat)) {
        coords.push([lon, lat])
      }
    }
  }

  // Pattern 2: { candidates: [{ location: { latitude, longitude } }] }
  const candidates = obj['candidates'] as Array<Record<string, unknown>> | undefined
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const location = candidate['location'] as Record<string, unknown> | undefined
      if (location) {
        const lat = location['latitude']
        const lon = location['longitude']
        if (typeof lat === 'number' && typeof lon === 'number' && isValidLonLat(lon, lat)) {
          // Skip duplicates (first candidate usually matches place)
          if (!coords.some(c => c[0] === lon && c[1] === lat)) {
            coords.push([lon, lat])
          }
        }
      }
    }
  }

  // Pattern 3: { places: [{ name, distance, location: { latitude, longitude } }] }
  const places = obj['places'] as Array<Record<string, unknown>> | undefined
  if (Array.isArray(places)) {
    for (const p of places) {
      const location = p['location'] as Record<string, unknown> | undefined
      if (location) {
        const lat = location['latitude']
        const lon = location['longitude']
        if (typeof lat === 'number' && typeof lon === 'number' && isValidLonLat(lon, lat)) {
          coords.push([lon, lat])
        }
      }
    }
  }

  // Pattern 4: { route: { geometry: string (polyline), legs: [...] } }
  const route = obj['route'] as Record<string, unknown> | undefined
  if (route) {
    const geometry = route['geometry']
    if (typeof geometry === 'string') {
      // Polyline encoded - we can't decode here but signal it exists
      // The map view will need to decode it
      console.log('[map-detector] Found route with polyline geometry')
    }
    const legs = route['legs'] as Array<Record<string, unknown>> | undefined
    if (Array.isArray(legs)) {
      for (const leg of legs) {
        const steps = leg['steps'] as Array<Record<string, unknown>> | undefined
        if (Array.isArray(steps)) {
          for (const step of steps) {
            const loc = step['location'] as number[] | undefined
            if (Array.isArray(loc) && loc.length >= 2) {
              coords.push([loc[0], loc[1]])
            }
          }
        }
      }
    }
  }

  // Pattern 5: { area: { center: { latitude, longitude } } } (explore_area)
  const area = obj['area'] as Record<string, unknown> | undefined
  if (area) {
    const center = area['center'] as Record<string, unknown> | undefined
    if (center) {
      const lat = center['latitude']
      const lon = center['longitude']
      if (typeof lat === 'number' && typeof lon === 'number' && isValidLonLat(lon, lat)) {
        coords.push([lon, lat])
      }
    }
  }

  return coords
}

// =============================================================================
// Text-Based Detection (Prompt/Response Pattern Matching)
// =============================================================================

/**
 * Patterns that indicate geographic/map content in text
 */
const GEO_TEXT_PATTERNS = {
  // Coordinate patterns: "37.7749, -122.4194" or "lat: 37.7749, lon: -122.4194"
  coordinates: /(?:lat(?:itude)?[:\s]*)?(-?\d{1,3}\.\d{3,8})[,\s]+(?:lon(?:gitude)?[:\s]*)?(-?\d{1,3}\.\d{3,8})/gi,

  // DMS format: 37°46'29.6"N 122°25'9.9"W
  dms: /(\d{1,3})°(\d{1,2})'(\d{1,2}(?:\.\d+)?)"?([NSEW])/gi,

  // Named places with geographic indicators
  places: /(?:located\s+(?:at|in|near)|address[:\s]+|place[:\s]+|location[:\s]+)([^,.]+(?:,\s*[^,.]+)*)/gi,

  // Route/direction indicators
  route: /(?:route|directions?|path|way)\s+(?:from|to|between)\s+/i,

  // Distance with units
  distance: /(\d+(?:\.\d+)?)\s*(?:km|mi|miles?|kilometers?|meters?|m)\s+(?:from|to|away)/i,
}

/**
 * Extract coordinates from text content
 */
function extractCoordsFromText(text: string): number[][] {
  const coords: number[][] = []

  // Match decimal coordinates
  let match: RegExpExecArray | null
  const coordRegex = new RegExp(GEO_TEXT_PATTERNS.coordinates.source, 'gi')

  while ((match = coordRegex.exec(text)) !== null) {
    const lat = parseFloat(match[1])
    const lon = parseFloat(match[2])

    if (isValidLonLat(lon, lat)) {
      coords.push([lon, lat])
    }
  }

  return coords
}

/**
 * Detect map-relevant content in text/string results
 */
function detectMapFromText(
  text: string,
  id: string
): Option.Option<DetectedMapData> {
  // Must have at least 2 coordinate-like values to be map-worthy
  const coords = extractCoordsFromText(text)

  if (coords.length >= 1) {
    return Option.some({
      id,
      layers: [],
      markers: coords.map((coord, i) => ({
        id: `text-marker-${id}-${i}`,
        position: [coord[0], coord[1], undefined] as Position,
        label: `Location ${i + 1}`,
      })),
      bounds: computeBoundsFromCoords(coords),
      source: 'detection' as const,
    })
  }

  // Check for route/direction patterns (might indicate map-worthy content)
  if (GEO_TEXT_PATTERNS.route.test(text) && GEO_TEXT_PATTERNS.distance.test(text)) {
    // Has route and distance - likely geographic but no extractable coords
    // Return empty detection that signals "this is map content"
    return Option.some({
      id,
      layers: [],
      markers: [],
      source: 'detection' as const,
      title: 'Route Information',
    })
  }

  return Option.none()
}

// =============================================================================
// Utility Exports
// =============================================================================

/**
 * Check if a tool name is known to produce map data
 */
export function isMapProducingTool(toolName: string): boolean {
  return MAP_PRODUCING_TOOLS.has(toolName)
}

/**
 * Add a tool name to the map-producing registry at runtime
 */
export function registerMapProducingTool(toolName: string): void {
  MAP_PRODUCING_TOOLS.add(toolName)
}

/**
 * Detect map content from text (for prompt-based detection)
 */
export function detectMapFromTextContent(
  text: string,
  id?: string
): Option.Option<DetectedMapData> {
  return detectMapFromText(text, id ?? nanoid())
}
