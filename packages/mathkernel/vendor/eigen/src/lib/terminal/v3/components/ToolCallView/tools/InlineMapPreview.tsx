/**
 * InlineMapPreview - Embedded map visualization for tool call results
 *
 * Renders a map directly in the Terminal v3 chat when AI tools return
 * geospatial data. Uses DeckGL + Mapbox for rendering.
 *
 * @module terminal/v3/components/ToolCallView/tools/InlineMapPreview
 */

import { useRef, useCallback, useMemo, useEffect, useState, memo } from 'react'
import { Map } from 'react-map-gl/mapbox'
import { DeckGL } from '@deck.gl/react'
import type { MapViewState, PickingInfo } from '@deck.gl/core'
import { ScatterplotLayer, IconLayer } from '@deck.gl/layers'
import { VANTA_COLORS } from '@/components/portal/tokens'
import type { DetectedMapData, MapMarker, MapBounds } from '../../../schemas/map-output'

// =============================================================================
// Configuration
// =============================================================================

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''
const DEFAULT_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11'

// Map height in chat view
const MAP_HEIGHT = 300

// =============================================================================
// Helpers
// =============================================================================

/**
 * Calculate center and zoom from bounds
 */
function getViewStateFromBounds(bounds: MapBounds): MapViewState {
  const centerLat = (bounds.north + bounds.south) / 2
  const centerLon = (bounds.east + bounds.west) / 2

  // Calculate zoom based on bounds extent
  const latDiff = bounds.north - bounds.south
  const lonDiff = bounds.east - bounds.west
  const maxDiff = Math.max(latDiff, lonDiff)

  // Rough zoom calculation
  let zoom = 10
  if (maxDiff > 10) zoom = 4
  else if (maxDiff > 5) zoom = 6
  else if (maxDiff > 1) zoom = 8
  else if (maxDiff > 0.1) zoom = 11
  else if (maxDiff > 0.01) zoom = 14
  else zoom = 16

  return {
    latitude: centerLat,
    longitude: centerLon,
    zoom,
    pitch: 0,
    bearing: 0,
  }
}

/**
 * Calculate view state from markers
 */
function getViewStateFromMarkers(markers: readonly MapMarker[]): MapViewState {
  if (markers.length === 0) {
    return {
      latitude: 35.0116, // Kyoto default
      longitude: 135.7681,
      zoom: 12,
      pitch: 0,
      bearing: 0,
    }
  }

  if (markers.length === 1) {
    const [lon, lat] = markers[0].position
    return {
      latitude: lat,
      longitude: lon,
      zoom: 14,
      pitch: 0,
      bearing: 0,
    }
  }

  // Calculate bounds from multiple markers
  let minLat = Infinity,
    maxLat = -Infinity
  let minLon = Infinity,
    maxLon = -Infinity

  for (const marker of markers) {
    const [lon, lat] = marker.position
    minLat = Math.min(minLat, lat)
    maxLat = Math.max(maxLat, lat)
    minLon = Math.min(minLon, lon)
    maxLon = Math.max(maxLon, lon)
  }

  return getViewStateFromBounds({
    north: maxLat,
    south: minLat,
    east: maxLon,
    west: minLon,
  })
}

// =============================================================================
// Component
// =============================================================================

interface InlineMapPreviewProps {
  data: DetectedMapData
  height?: number
}

function InlineMapPreviewComponent({ data, height = MAP_HEIGHT }: InlineMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null)
  const [isMapLoaded, setIsMapLoaded] = useState(false)
  const [webGLError, setWebGLError] = useState<string | null>(null)

  // Calculate initial view state from data
  const initialViewState = useMemo(() => {
    if (data.bounds) {
      return getViewStateFromBounds(data.bounds)
    }
    if (data.markers && data.markers.length > 0) {
      return getViewStateFromMarkers(data.markers)
    }
    // Default to Kyoto
    return {
      latitude: 35.0116,
      longitude: 135.7681,
      zoom: 12,
      pitch: 0,
      bearing: 0,
    }
  }, [data.bounds, data.markers])

  const [viewState, setViewState] = useState<MapViewState>(initialViewState)

  // Measure container
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return

    let rafId1: number
    let rafId2: number

    const measureAndInit = () => {
      if (!containerRef.current) return
      const { clientWidth, clientHeight } = containerRef.current
      if (clientWidth > 0 && clientHeight > 0) {
        setDimensions({ width: clientWidth, height: clientHeight })
      }
    }

    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(measureAndInit)
    })

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions({
            width: Math.floor(width),
            height: Math.floor(height),
          })
        }
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(rafId1)
      cancelAnimationFrame(rafId2)
      resizeObserver.disconnect()
    }
  }, [])

  // Build layers
  const layers = useMemo(() => {
    const result: ScatterplotLayer[] = []

    if (data.markers && data.markers.length > 0) {
      result.push(
        new ScatterplotLayer({
          id: 'markers',
          data: data.markers,
          getPosition: (d: MapMarker) => d.position,
          getFillColor: [34, 211, 238, 200], // Cyan
          getRadius: 80,
          radiusMinPixels: 6,
          radiusMaxPixels: 30,
          pickable: true,
        })
      )
    }

    return result
  }, [data.markers])

  const handleViewStateChange = useCallback((params: { viewState: MapViewState }) => {
    setViewState(params.viewState)
  }, [])

  const handleLoad = useCallback(() => {
    setIsMapLoaded(true)
  }, [])

  const handleWebGLError = useCallback((error: Error) => {
    console.error('[InlineMapPreview] WebGL error:', error)
    setWebGLError(error.message)
  }, [])

  // No token warning
  if (!MAPBOX_TOKEN) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: VANTA_COLORS.surface.void,
          borderRadius: '8px',
          color: VANTA_COLORS.text.muted,
          fontSize: '12px',
          fontFamily: 'var(--tmnl-font-mono)',
        }}
      >
        VITE_MAPBOX_TOKEN not configured
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      style={{
        height,
        position: 'relative',
        background: VANTA_COLORS.surface.void,
        borderRadius: '8px',
        overflow: 'hidden',
      }}
    >
      {/* Loading overlay */}
      {(!dimensions || !isMapLoaded) && !webGLError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: VANTA_COLORS.surface.void,
            zIndex: 10,
          }}
        >
          <span
            style={{
              color: VANTA_COLORS.text.muted,
              fontFamily: 'var(--tmnl-font-mono)',
              fontSize: '12px',
            }}
          >
            {dimensions ? 'Loading map...' : 'Initializing...'}
          </span>
        </div>
      )}

      {/* WebGL error */}
      {webGLError && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: VANTA_COLORS.surface.void,
            zIndex: 10,
          }}
        >
          <span
            style={{
              color: VANTA_COLORS.accent.rose,
              fontFamily: 'var(--tmnl-font-mono)',
              fontSize: '12px',
              textAlign: 'center',
              padding: '16px',
            }}
          >
            WebGL Error: {webGLError}
          </span>
        </div>
      )}

      {/* Map */}
      {dimensions && !webGLError && (
        <DeckGL
          viewState={viewState}
          onViewStateChange={handleViewStateChange}
          controller={true}
          layers={layers}
          onError={handleWebGLError}
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
          }}
        >
          <Map
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={DEFAULT_MAP_STYLE}
            onLoad={handleLoad}
            style={{ width: '100%', height: '100%' }}
            attributionControl={false}
            logoPosition="bottom-right"
          />
        </DeckGL>
      )}

      {/* Title overlay */}
      {data.title && isMapLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '4px 8px',
            borderRadius: '4px',
            color: VANTA_COLORS.text.primary,
            fontSize: '12px',
            fontFamily: 'var(--tmnl-font-mono)',
            zIndex: 20,
          }}
        >
          {data.title}
        </div>
      )}

      {/* Marker count badge */}
      {data.markers && data.markers.length > 0 && isMapLoaded && (
        <div
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '4px 8px',
            borderRadius: '4px',
            color: VANTA_COLORS.accent.cyan,
            fontSize: '11px',
            fontFamily: 'var(--tmnl-font-mono)',
            zIndex: 20,
          }}
        >
          {data.markers.length} marker{data.markers.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

export const InlineMapPreview = memo(InlineMapPreviewComponent)
