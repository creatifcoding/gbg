/**
 * BaseMap - Registry-backed map primitive (Atoms-Only)
 *
 * Core DeckGL + Mapbox rendering component with dependency inversion.
 * View-only by default - embedding contexts inject interactions via registries.
 *
 * All state managed via atoms:
 * - viewState, markers: per-instance atoms
 * - dimensions, mapLoaded, error: per-instance atoms
 * - interactions, widgets: global registry atoms
 *
 * @module primitives/map/BaseMap
 */

import { useRef, useCallback, useMemo, useEffect, memo } from 'react'
import type { CSSProperties } from 'react'
import { Map } from 'react-map-gl/mapbox'
import { DeckGL } from '@deck.gl/react'
import { ScatterplotLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import { useAtom, useAtomValue } from '@effect-atom/atom-react'
import { VANTA_COLORS } from '@/components/portal/tokens'
import type { BaseMapProps, MapMarker, MapViewState } from './types'
import {
  mapRegistry,
  createMapInstanceAtoms,
  createTracedMapAtoms,
  disposeInstanceAtoms,
  invokeInteraction,
  activeStyleAtom,
} from './registries'
import type { TracedAtomGroup, MapInstanceAtoms } from './registries'

// =============================================================================
// Configuration
// =============================================================================

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''
const DEFAULT_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11'
const DEFAULT_MARKER_COLOR: [number, number, number] = [34, 211, 238] // Cyan
const DEFAULT_MARKER_RADIUS = 80

// =============================================================================
// Default Renderers
// =============================================================================

function DefaultLoadingRenderer() {
  return (
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
        Loading map...
      </span>
    </div>
  )
}

function DefaultErrorRenderer({ error }: { error: string }) {
  return (
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
        {error}
      </span>
    </div>
  )
}

function NoTokenRenderer() {
  return (
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
        VITE_MAPBOX_TOKEN not configured.
        <br />
        <span style={{ color: VANTA_COLORS.text.muted }}>
          Add to .env.local to enable maps.
        </span>
      </span>
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

function BaseMapComponent({
  // Instance ID (required for atom mode)
  instanceId,

  // Styling
  mapStyle: mapStyleProp,
  height = '100%',
  className,
  markerColor = DEFAULT_MARKER_COLOR,
  markerRadius = DEFAULT_MARKER_RADIUS,

  // Feature flags
  interactive = true,
  showMarkers = true,
  debug = false,

  // Render props
  renderLoading,
  renderError,
  renderOverlay,
}: BaseMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // ---------------------------------------------------------------------------
  // Instance Atoms (all state lives here)
  // ---------------------------------------------------------------------------

  // Traced atoms for debug mode
  const tracedAtoms = useMemo(
    () => (debug ? createTracedMapAtoms(instanceId) : null),
    [instanceId, debug]
  )

  // Standard atoms (always created for useAtomValue subscriptions)
  const instanceAtoms = useMemo(
    () => tracedAtoms?.atoms ?? createMapInstanceAtoms(instanceId),
    [instanceId, tracedAtoms]
  )

  // Subscribe to atom values
  const viewState = useAtomValue(instanceAtoms.viewStateAtom)
  const markers = useAtomValue(instanceAtoms.markersAtom)
  const dimensions = useAtomValue(instanceAtoms.dimensionsAtom)
  const mapLoaded = useAtomValue(instanceAtoms.mapLoadedAtom)
  const error = useAtomValue(instanceAtoms.errorAtom)

  // Active style from global registry
  const activeStyle = useAtomValue(activeStyleAtom)
  const mapStyle = mapStyleProp ?? activeStyle?.url ?? DEFAULT_MAP_STYLE

  // Cleanup instance atoms on unmount
  useEffect(() => {
    return () => {
      tracedAtoms?.dispose()
      disposeInstanceAtoms(instanceId)
    }
  }, [instanceId, tracedAtoms])

  // ---------------------------------------------------------------------------
  // Container Dimension Handling (via atoms)
  // ---------------------------------------------------------------------------

  // WORKAROUND: luma.gl's ResizeObserver fires before WebGL device ready
  // if we use percentage-based sizing. Measure container explicitly.
  useEffect(() => {
    if (!containerRef.current || !MAPBOX_TOKEN) return

    let rafId1: number
    let rafId2: number

    const setDimensions = (width: number, height: number, source: string) => {
      const dims = { width, height }
      if (tracedAtoms) {
        tracedAtoms.set('dimensionsAtom', dims, source)
      } else {
        mapRegistry.set(instanceAtoms.dimensionsAtom, dims)
      }
    }

    const measureAndInit = () => {
      if (!containerRef.current) return
      const { clientWidth, clientHeight } = containerRef.current
      if (clientWidth > 0 && clientHeight > 0) {
        setDimensions(clientWidth, clientHeight, 'initialMeasure')
      }
    }

    // Double RAF ensures layout is stable
    rafId1 = requestAnimationFrame(() => {
      rafId2 = requestAnimationFrame(measureAndInit)
    })

    // ResizeObserver for dynamic size changes (focus mode, window resize)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions(Math.floor(width), Math.floor(height), 'ResizeObserver')
        }
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(rafId1)
      cancelAnimationFrame(rafId2)
      resizeObserver.disconnect()
    }
  }, [instanceId, instanceAtoms.dimensionsAtom, tracedAtoms])

  // ---------------------------------------------------------------------------
  // Event Handlers (mutations via registry.set)
  // ---------------------------------------------------------------------------

  const handleViewStateChange = useCallback(
    (params: { viewState: MapViewState }) => {
      if (!dimensions) return params.viewState

      // Update via traced or direct mutation
      if (tracedAtoms) {
        tracedAtoms.set('viewStateAtom', params.viewState, 'onViewStateChange')
      } else {
        mapRegistry.set(instanceAtoms.viewStateAtom, params.viewState)
      }

      return params.viewState // DeckGL expects return value
    },
    [dimensions, instanceAtoms.viewStateAtom, tracedAtoms]
  )

  const handleMapClick = useCallback(
    (info: PickingInfo) => {
      if (!dimensions) return

      const marker = info.object as MapMarker | undefined

      // Invoke registered click handler from interaction registry
      invokeInteraction('click', info, marker)
    },
    [dimensions]
  )

  const handleHover = useCallback(
    (info: PickingInfo) => {
      if (!dimensions) return

      const marker = info.object as MapMarker | null

      // Invoke registered hover handler from interaction registry
      invokeInteraction('hover', info, marker ?? undefined)
    },
    [dimensions]
  )

  const handleLoad = useCallback(() => {
    if (tracedAtoms) {
      tracedAtoms.set('mapLoadedAtom', true, 'onMapLoad')
    } else {
      mapRegistry.set(instanceAtoms.mapLoadedAtom, true)
    }
  }, [instanceAtoms.mapLoadedAtom, tracedAtoms])

  const handleWebGLError = useCallback(
    (err: Error) => {
      console.error('[BaseMap] WebGL error:', err)
      if (tracedAtoms) {
        tracedAtoms.set('errorAtom', err.message, 'WebGLError')
      } else {
        mapRegistry.set(instanceAtoms.errorAtom, err.message)
      }
    },
    [instanceAtoms.errorAtom, tracedAtoms]
  )

  // ---------------------------------------------------------------------------
  // Layers
  // ---------------------------------------------------------------------------

  const deckLayers = useMemo(() => {
    const result: ScatterplotLayer[] = []

    if (showMarkers && markers.length > 0) {
      result.push(
        new ScatterplotLayer({
          id: `basemap-markers-${instanceId}`,
          data: markers,
          getPosition: (d: MapMarker) => d.position as [number, number],
          getFillColor: (d: MapMarker) =>
            d.color ? [...d.color, 200] : [...markerColor, 200],
          getRadius: (d: MapMarker) => d.size ?? markerRadius,
          radiusMinPixels: 6,
          radiusMaxPixels: 50,
          pickable: true,
          updateTriggers: {
            getPosition: markers,
            getFillColor: [markers, markerColor],
            getRadius: [markers, markerRadius],
          },
        })
      )
    }

    return result
  }, [instanceId, markers, showMarkers, markerColor, markerRadius])

  // ---------------------------------------------------------------------------
  // Container Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = useMemo(
    () => ({
      height: typeof height === 'number' ? `${height}px` : height,
      position: 'relative',
      background: VANTA_COLORS.surface.void,
      borderRadius: '8px',
      overflow: 'hidden',
    }),
    [height]
  )

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isLoading = !dimensions || !mapLoaded
  const hasError = !!error
  const noToken = !MAPBOX_TOKEN

  return (
    <div ref={containerRef} className={className} style={containerStyle}>
      {/* No token */}
      {noToken && <NoTokenRenderer />}

      {/* Loading */}
      {!noToken && isLoading && !hasError && (renderLoading?.() ?? <DefaultLoadingRenderer />)}

      {/* Error */}
      {hasError && (renderError?.(error) ?? <DefaultErrorRenderer error={error} />)}

      {/* Map */}
      {!noToken && dimensions && !hasError && (
        <DeckGL
          viewState={viewState}
          onViewStateChange={handleViewStateChange}
          controller={interactive}
          layers={deckLayers}
          onClick={handleMapClick}
          onHover={handleHover}
          onError={handleWebGLError}
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
          }}
        >
          <Map
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={mapStyle}
            onLoad={handleLoad}
            style={{ width: '100%', height: '100%' }}
            attributionControl={false}
            logoPosition="bottom-right"
          />
        </DeckGL>
      )}

      {/* Overlay (widgets, badges, etc.) */}
      {mapLoaded && renderOverlay?.()}
    </div>
  )
}

export const BaseMap = memo(BaseMapComponent)
