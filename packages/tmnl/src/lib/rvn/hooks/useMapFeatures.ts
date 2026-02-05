/**
 * useMapFeatures
 *
 * Hook to capture visible features from Mapbox and expose as reactive state.
 * Categorizes features into POIs, roads, places, and buildings.
 *
 * @example Basic usage
 * ```tsx
 * function MapOverlay({ map }) {
 *   const { features, capture } = useMapFeatures({ map })
 *
 *   return (
 *     <div>
 *       <span>POIs: {features.pois.length}</span>
 *       <span>Roads: {features.roads.length}</span>
 *     </div>
 *   )
 * }
 * ```
 *
 * @example With layer filtering
 * ```tsx
 * const { features } = useMapFeatures({
 *   map,
 *   layers: ['poi-label', 'road-label'],
 *   debounceMs: 200,
 * })
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react'

// =============================================================================
// TYPES
// =============================================================================

/**
 * Simplified feature representation for React state.
 */
export interface MapFeature {
  /** Feature ID (may be string or number) */
  id: string | number
  /** GeoJSON geometry type */
  type: string
  /** Feature properties from the layer */
  properties: Record<string, unknown>
  /** Simplified geometry */
  geometry: {
    type: string
    coordinates: number[] | number[][] | number[][][]
  }
  /** Source layer name */
  sourceLayer?: string
  /** Layer ID */
  layer?: string
}

/**
 * Categorized feature collections.
 */
export interface MapFeatureCategories {
  /** Points of interest (restaurants, shops, landmarks) */
  pois: MapFeature[]
  /** Roads and streets */
  roads: MapFeature[]
  /** Place labels (cities, neighborhoods) */
  places: MapFeature[]
  /** Building footprints */
  buildings: MapFeature[]
  /** All other features */
  other: MapFeature[]
}

/**
 * Mapbox Map instance type (minimal interface).
 * Using a minimal interface to avoid tight coupling to mapbox-gl types.
 */
interface MapInstance {
  queryRenderedFeatures(
    geometry?: unknown,
    options?: { layers?: string[] }
  ): Array<{
    id?: string | number
    type: string
    properties: Record<string, unknown>
    geometry: {
      type: string
      coordinates: unknown
    }
    sourceLayer?: string
    layer?: { id: string }
  }>
  on(event: string, handler: () => void): void
  off(event: string, handler: () => void): void
}

export interface UseMapFeaturesOptions {
  /** Mapbox map instance */
  map: MapInstance | null
  /** Specific layers to query (optional, queries all if not provided) */
  layers?: string[]
  /** Debounce time in ms for move/zoom events */
  debounceMs?: number
  /** Additional filter function */
  filter?: (feature: MapFeature) => boolean
  /** Auto-capture on map events */
  autoCapture?: boolean
}

export interface UseMapFeaturesResult {
  /** Categorized features */
  features: MapFeatureCategories
  /** Manually trigger feature capture */
  capture: () => void
  /** Whether currently capturing */
  isCapturing: boolean
  /** Last capture timestamp */
  lastCaptured: number | null
  /** Total feature count */
  totalCount: number
}

// =============================================================================
// LAYER CATEGORIZATION
// =============================================================================

/**
 * Layer name patterns for categorization.
 */
const LAYER_PATTERNS = {
  poi: [
    /^poi/i,
    /label.*shop/i,
    /label.*restaurant/i,
    /label.*food/i,
    /landmark/i,
    /attraction/i,
    /amenity/i,
  ],
  road: [
    /^road/i,
    /^tunnel/i,
    /^bridge/i,
    /street/i,
    /highway/i,
    /motorway/i,
    /path/i,
  ],
  place: [
    /^place/i,
    /settlement/i,
    /city/i,
    /town/i,
    /village/i,
    /neighborhood/i,
    /country/i,
    /state/i,
  ],
  building: [
    /^building/i,
    /^3d-building/i,
    /structure/i,
  ],
}

/**
 * Categorize a feature based on its layer name.
 */
function categorizeFeature(layerId: string): keyof MapFeatureCategories {
  for (const [category, patterns] of Object.entries(LAYER_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(layerId)) {
        return category as keyof MapFeatureCategories
      }
    }
  }
  return 'other'
}

// =============================================================================
// DEBOUNCE UTILITY
// =============================================================================

function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number
): T & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debounced = ((...args: unknown[]) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, ms)
  }) as T & { cancel: () => void }

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debounced
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

const EMPTY_CATEGORIES: MapFeatureCategories = {
  pois: [],
  roads: [],
  places: [],
  buildings: [],
  other: [],
}

/**
 * Hook to capture and categorize visible Mapbox features.
 */
export function useMapFeatures(options: UseMapFeaturesOptions): UseMapFeaturesResult {
  const {
    map,
    layers,
    debounceMs = 100,
    filter,
    autoCapture = true,
  } = options

  const [features, setFeatures] = useState<MapFeatureCategories>(EMPTY_CATEGORIES)
  const [isCapturing, setIsCapturing] = useState(false)
  const [lastCaptured, setLastCaptured] = useState<number | null>(null)

  // Ref to track mounted state
  const isMounted = useRef(true)

  /**
   * Capture visible features from the map.
   */
  const capture = useCallback(() => {
    if (!map) return

    setIsCapturing(true)

    try {
      // Query rendered features
      const queryOptions = layers ? { layers } : undefined
      const rawFeatures = map.queryRenderedFeatures(undefined, queryOptions)

      // Initialize categories
      const categorized: MapFeatureCategories = {
        pois: [],
        roads: [],
        places: [],
        buildings: [],
        other: [],
      }

      // Process and categorize features
      const seen = new Set<string>()

      for (const raw of rawFeatures) {
        // Create unique key to dedupe
        const key = `${raw.layer?.id || 'unknown'}-${raw.id || JSON.stringify(raw.geometry.coordinates)}`
        if (seen.has(key)) continue
        seen.add(key)

        // Transform to MapFeature
        const feature: MapFeature = {
          id: raw.id ?? key,
          type: raw.type,
          properties: raw.properties,
          geometry: {
            type: raw.geometry.type,
            coordinates: raw.geometry.coordinates as number[] | number[][] | number[][][],
          },
          sourceLayer: raw.sourceLayer,
          layer: raw.layer?.id,
        }

        // Apply custom filter if provided
        if (filter && !filter(feature)) continue

        // Categorize based on layer name
        const category = categorizeFeature(raw.layer?.id || '')
        categorized[category].push(feature)
      }

      if (isMounted.current) {
        setFeatures(categorized)
        setLastCaptured(Date.now())
      }
    } catch (error) {
      console.error('[useMapFeatures] Capture error:', error)
    } finally {
      if (isMounted.current) {
        setIsCapturing(false)
      }
    }
  }, [map, layers, filter])

  // Create debounced capture
  const debouncedCapture = useCallback(
    () => {
      const debounced = debounce(capture, debounceMs)
      return debounced
    },
    [capture, debounceMs]
  )

  // Set up auto-capture on map events
  useEffect(() => {
    if (!map || !autoCapture) return

    const handler = debounce(capture, debounceMs)

    // Listen to map movement events
    map.on('moveend', handler)
    map.on('zoomend', handler)
    map.on('sourcedata', handler)

    // Initial capture
    capture()

    return () => {
      handler.cancel()
      map.off('moveend', handler)
      map.off('zoomend', handler)
      map.off('sourcedata', handler)
    }
  }, [map, autoCapture, capture, debounceMs])

  // Track mounted state
  useEffect(() => {
    isMounted.current = true
    return () => {
      isMounted.current = false
    }
  }, [])

  // Calculate total count
  const totalCount =
    features.pois.length +
    features.roads.length +
    features.places.length +
    features.buildings.length +
    features.other.length

  return {
    features,
    capture,
    isCapturing,
    lastCaptured,
    totalCount,
  }
}
