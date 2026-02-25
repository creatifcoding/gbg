/**
 * GeointMap - Dependency-inverted GEOINT map component
 *
 * A thin React layer over GeointService atoms:
 * - Receives tracks/threats via props OR subscribes to service atoms
 * - Uses derived deckGlLayers atom for layer generation
 * - Supports both controlled (props) and uncontrolled (service) modes
 *
 * @see .cursor/prd/features.md F001 (Track Visualization)
 * @module
 */

import { useRef, useCallback, useMemo, useEffect, memo, useState } from 'react'
import type { CSSProperties } from 'react'
import { Map as MapboxMap } from 'react-map-gl/mapbox'
import { DeckGL } from '@deck.gl/react'
import { FlyToInterpolator } from '@deck.gl/core'
import type { Layer, PickingInfo, MapViewState } from '@deck.gl/core'
import {
  ScatterplotLayer,
  IconLayer,
  PathLayer,
  ArcLayer,
  LineLayer,
  PolygonLayer,
  TextLayer,
  ColumnLayer,
  GeoJsonLayer,
} from '@deck.gl/layers'
import { HeatmapLayer, HexagonLayer, GridLayer, ContourLayer } from '@deck.gl/aggregation-layers'
import { TripsLayer } from '@deck.gl/geo-layers'
import { useAtom, useAtomValue } from '@effect-atom/atom-react'
import { VANTA_COLORS } from '@/components/portal/tokens'
import type { Track, ThreatVolume } from '../schemas'
import { asPanelId, getPanelAtoms, geointRegistry } from '../atoms'
import {
  createGeointInstanceAtoms,
  disposeGeointInstanceAtoms,
  DEFAULT_VISIBILITY,
  type GeointLayerVisibility,
} from './geointMapState'
import {
  createTrackPathLayer,
  createTrackPositionLayer,
  createTrackHeadingLayer,
  createTrackHeatmapLayer,
  createAnimatedTripsLayer,
  type TrackPathLayerData,
  type TrackPositionData,
} from '../layers'
import { MapSelectionOverlay } from './MapSelectionOverlay'
import { overlayRegistry } from '@/lib/overlays/atoms'
import {
  PositioningProvider,
  useLayerConfigs,
  useViewportSync,
  usePositionedEntities,
  positioningOps,
} from '../positioning/hooks'
import type { LayerConfig } from '../positioning/SceneGraphBridge'

// =============================================================================
// Configuration
// =============================================================================

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || ''
const DEFAULT_MAP_STYLE = 'mapbox://styles/mapbox/dark-v11'

// =============================================================================
// Positioning Layer Conversion
// =============================================================================

/**
 * Layer constructor map for dynamic layer creation.
 */
const LAYER_CONSTRUCTORS: Record<string, new (props: object) => Layer> = {
  scatterplot: ScatterplotLayer,
  icon: IconLayer,
  path: PathLayer,
  arc: ArcLayer,
  line: LineLayer,
  polygon: PolygonLayer,
  text: TextLayer,
  column: ColumnLayer,
  geojson: GeoJsonLayer,
  heatmap: HeatmapLayer,
  hexagon: HexagonLayer,
  grid: GridLayer,
  contour: ContourLayer,
  trips: TripsLayer,
}

/**
 * Convert positioning LayerConfig to deck.gl Layer instances.
 */
function convertPositioningLayers(configs: readonly LayerConfig[]): Layer[] {
  const layers: Layer[] = []

  for (const config of configs) {
    if (!config.visible || config.data.length === 0) continue

    const Constructor = LAYER_CONSTRUCTORS[config.type]
    if (Constructor) {
      layers.push(
        new Constructor({
          id: config.id,
          data: config.data as unknown[],
          visible: config.visible,
          ...(config.props as object),
        })
      )
    }
  }

  return layers
}

// =============================================================================
// Instance Atom State (extracted)
// =============================================================================
//
// Instance-scoped map state for non-panel consumers is maintained in
// `geointMapState.ts` and imported above via createGeointInstanceAtoms().

// =============================================================================
// Registry Export
// =============================================================================

/** Map overlay registry (for positioning layer atoms) */
export const mapOverlayRegistry = overlayRegistry

// =============================================================================
// Props
// =============================================================================

/**
 * Target for camera fly-to animation.
 */
export interface FlyToTarget {
  /** Target longitude */
  longitude: number
  /** Target latitude */
  latitude: number
  /** Target zoom level */
  zoom?: number
  /** Target pitch (tilt) angle */
  pitch?: number
  /** Target bearing (rotation) */
  bearing?: number
  /** Animation speed (legacy prop path, default: 1.5) */
  speed?: number
  /** Explicit transition duration in ms (panel/controller path) */
  transitionDuration?: number
  /** Optional easing label (panel/controller path) */
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'
  /** Unique key to trigger new animations (legacy prop path) */
  key?: string | number
}

export interface GeointMapProps {
  /** Unique instance ID for atom-based state */
  instanceId: string

  /** Optional panel ID for panel-scoped viewport source-of-truth */
  panelId?: string

  /** Tracks to display (controlled mode) */
  tracks?: readonly Track[]

  /** Threats to display (controlled mode) */
  threats?: readonly ThreatVolume[]

  /** Initial view state */
  initialViewState?: Partial<MapViewState>

  /** Initial layer visibility */
  initialVisibility?: Partial<GeointLayerVisibility>

  /** Mapbox style URL */
  mapStyle?: string

  /** Container height */
  height?: number | string

  /** Additional CSS class */
  className?: string

  /** Enable map interactions */
  interactive?: boolean

  /** Enable animated trips layer */
  animate?: boolean

  /** Debug mode */
  debug?: boolean

  /** Target for camera fly-to animation (set to trigger animation) */
  flyToTarget?: FlyToTarget | null

  /** Track click handler */
  onTrackClick?: (track: Track) => void

  /** Track hover handler */
  onTrackHover?: (track: Track | null) => void

  /** View state change handler */
  onViewStateChange?: (viewState: MapViewState) => void

  /** Custom overlay renderer */
  renderOverlay?: () => React.ReactNode
}

// =============================================================================
// Component
// =============================================================================

function GeointMapComponent({
  instanceId,
  panelId,
  tracks: propTracks,
  threats: propThreats,
  initialViewState,
  initialVisibility,
  mapStyle = DEFAULT_MAP_STYLE,
  height = '100%',
  className,
  interactive = true,
  animate = false,
  debug = false,
  flyToTarget,
  onTrackClick,
  onTrackHover,
  onViewStateChange,
  renderOverlay,
}: GeointMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [animationTime, setAnimationTime] = useState(Date.now())

  // Get instance atoms
  const atoms = useMemo(() => createGeointInstanceAtoms(instanceId), [instanceId])

  const panelAtoms = useMemo(
    () => (panelId ? getPanelAtoms(asPanelId(panelId)) : null),
    [panelId]
  )

  // Subscribe to atoms
  const [viewState, setViewState] = useAtom(panelAtoms?.viewportAtom ?? atoms.viewStateAtom)
  const [tracks, setTracks] = useAtom(atoms.tracksAtom)
  const [threats, setThreats] = useAtom(atoms.threatsAtom)
  const visibility = useAtomValue(atoms.visibilityAtom)
  const [, setSelectedTrack] = useAtom(atoms.selectedTrackAtom)
  const [dimensions, setDimensions] = useAtom(atoms.dimensionsAtom)
  const [mapLoaded, setMapLoaded] = useAtom(atoms.mapLoadedAtom)
  const [error, setError] = useAtom(atoms.errorAtom)
  const [panelFlyToTarget, setPanelFlyToTarget] = useAtom(panelAtoms?.flyToTargetAtom ?? atoms.flyToTargetAtom)
  const [, setIsAnimating] = useAtom(panelAtoms?.isAnimatingAtom ?? atoms.isAnimatingAtom)

  // Positioning system integration
  const positioningLayerConfigs = useLayerConfigs()
  const positionedEntities = usePositionedEntities()
  const { syncViewport, syncDimensions } = useViewportSync(panelId)

  // Sync props to atoms
  useEffect(() => {
    if (propTracks) setTracks(propTracks)
  }, [propTracks, setTracks])

  useEffect(() => {
    if (propThreats) setThreats(propThreats)
  }, [propThreats, setThreats])

  useEffect(() => {
    if (initialViewState) {
      setViewState((prev) => ({ ...prev, ...initialViewState }))
    }
  }, []) // Only on mount

  useEffect(() => {
    if (initialVisibility) {
      mapOverlayRegistry.set(atoms.visibilityAtom, { ...DEFAULT_VISIBILITY, ...initialVisibility })
    }
  }, []) // Only on mount

  // Fly-to animation effect
  // Priority: panel-scoped controller target > legacy prop target
  useEffect(() => {
    const target: FlyToTarget | null = panelFlyToTarget
      ? {
          longitude: panelFlyToTarget.longitude,
          latitude: panelFlyToTarget.latitude,
          zoom: panelFlyToTarget.zoom,
          pitch: panelFlyToTarget.pitch,
          bearing: panelFlyToTarget.bearing,
          transitionDuration: panelFlyToTarget.transitionDuration,
          easing: panelFlyToTarget.easing,
        }
      : flyToTarget

    if (!target) return

    // Panel path: mark animation active; completion is handled by DeckGL interactionState
    if (panelFlyToTarget) {
      setIsAnimating(true)
    }

    setViewState((prev) => ({
      ...prev,
      longitude: target.longitude,
      latitude: target.latitude,
      zoom: target.zoom ?? prev.zoom,
      pitch: target.pitch ?? prev.pitch,
      bearing: target.bearing ?? prev.bearing,
      transitionInterpolator: new FlyToInterpolator({ speed: target.speed ?? 1.5 }),
      transitionDuration: target.transitionDuration ?? 'auto',
    }))
  }, [
    flyToTarget,
    panelFlyToTarget,
    setViewState,
    setPanelFlyToTarget,
    setIsAnimating,
  ])

  // Animation loop
  useEffect(() => {
    if (!animate || !visibility.trips) return

    let rafId: number
    const tick = () => {
      setAnimationTime(Date.now())
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [animate, visibility.trips])

  // Dimension handling
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
        const { width, height: h } = entry.contentRect
        if (width > 0 && h > 0) {
          setDimensions({ width: Math.floor(width), height: Math.floor(h) })
        }
      }
    })

    resizeObserver.observe(containerRef.current)

    return () => {
      cancelAnimationFrame(rafId1)
      cancelAnimationFrame(rafId2)
      resizeObserver.disconnect()
    }
  }, [instanceId, setDimensions])

  // Sync dimensions to positioning system
  useEffect(() => {
    if (dimensions) {
      syncDimensions(dimensions.width, dimensions.height)
    }
  }, [dimensions, syncDimensions])

  // Event handlers
  const handleViewStateChange = useCallback(
    (params: {
      viewState: MapViewState
      interactionState?: { inTransition?: boolean }
    }) => {
      if (!dimensions) return
      setViewState(params.viewState)
      onViewStateChange?.(params.viewState)

      // Sync with positioning system
      syncViewport({
        longitude: params.viewState.longitude,
        latitude: params.viewState.latitude,
        zoom: params.viewState.zoom,
        pitch: params.viewState.pitch,
        bearing: params.viewState.bearing,
      })

      // DeckGL transition lifecycle for panel-scoped flyTo path
      if (panelAtoms) {
        const inTransition = Boolean(params.interactionState?.inTransition)
        if (inTransition) {
          setIsAnimating(true)
        } else if (panelFlyToTarget) {
          setPanelFlyToTarget(null)
          setIsAnimating(false)
        }
      }
    },
    [
      dimensions,
      setViewState,
      onViewStateChange,
      syncViewport,
      panelAtoms,
      panelFlyToTarget,
      setPanelFlyToTarget,
      setIsAnimating,
    ]
  )

  const handleClick = useCallback(
    (info: PickingInfo) => {
      if (!info.object) return

      const trackData = info.object as TrackPathLayerData | TrackPositionData
      if (trackData.trackId) {
        const track = tracks.find((t) => t.trackId === trackData.trackId)
        if (track) {
          setSelectedTrack(track)
          onTrackClick?.(track)
        }
      }
    },
    [tracks, setSelectedTrack, onTrackClick]
  )

  const handleHover = useCallback(
    (info: PickingInfo) => {
      if (!info.object) {
        onTrackHover?.(null)
        return
      }

      const trackData = info.object as TrackPathLayerData | TrackPositionData
      if (trackData.trackId) {
        const track = tracks.find((t) => t.trackId === trackData.trackId)
        onTrackHover?.(track ?? null)
      }
    },
    [tracks, onTrackHover]
  )

  const handleLoad = useCallback(() => {
    setMapLoaded(true)
  }, [setMapLoaded])

  const handleError = useCallback(
    (err: Error) => {
      console.error('[GeointMap] Error:', err)
      setError(err.message)
    },
    [setError]
  )

  // Build layers
  const layers = useMemo(() => {
    const result: Layer[] = []

    if (visibility.paths) {
      result.push(
        createTrackPathLayer(tracks, {
          id: `geoint-paths-${instanceId}`,
          pickable: true,
        })
      )
    }

    if (visibility.positions) {
      result.push(
        createTrackPositionLayer(tracks, {
          id: `geoint-positions-${instanceId}`,
          pickable: true,
        })
      )
    }

    if (visibility.headings) {
      result.push(
        createTrackHeadingLayer(tracks, {
          id: `geoint-headings-${instanceId}`,
        })
      )
    }

    if (visibility.heatmap) {
      result.push(
        createTrackHeatmapLayer(tracks, {
          id: `geoint-heatmap-${instanceId}`,
        })
      )
    }

    if (visibility.trips && animate) {
      result.push(
        createAnimatedTripsLayer(tracks, animationTime, {
          id: `geoint-trips-${instanceId}`,
        })
      )
    }

    // Add Kori ECS positioned entity layers
    if (visibility.positionedEntities && positioningLayerConfigs.length > 0) {
      result.push(...convertPositioningLayers(positioningLayerConfigs))
    }

    return result
  }, [instanceId, tracks, visibility, animate, animationTime, positioningLayerConfigs])

  // Styles
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

  // Render states
  const isLoading = !dimensions || !mapLoaded
  const hasError = !!error
  const noToken = !MAPBOX_TOKEN

  return (
    <div ref={containerRef} className={className} style={containerStyle}>
      {/* No Token */}
      {noToken && (
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
            <span style={{ color: VANTA_COLORS.text.muted }}>Add to .env.local to enable maps.</span>
          </span>
        </div>
      )}

      {/* Loading */}
      {!noToken && isLoading && !hasError && (
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
            Loading GEOINT map...
          </span>
        </div>
      )}

      {/* Error */}
      {hasError && (
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
      )}

      {/* Map */}
      {!noToken && dimensions && !hasError && (
        <DeckGL
          viewState={viewState}
          onViewStateChange={handleViewStateChange as any}
          controller={interactive}
          layers={layers}
          onClick={handleClick}
          onHover={handleHover}
          onError={handleError}
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
          }}
        >
          <MapboxMap
            mapboxAccessToken={MAPBOX_TOKEN}
            mapStyle={mapStyle}
            onLoad={handleLoad}
            style={{ width: '100%', height: '100%' }}
            attributionControl={false}
            logoPosition="bottom-right"
          />
        </DeckGL>
      )}

      {/* Selection Overlay - Animated selection ring */}
      {mapLoaded && <MapSelectionOverlay dimensions={dimensions} />}

      {/* Custom Overlay */}
      {mapLoaded && renderOverlay?.()}

      {/* Debug Info */}
      {debug && mapLoaded && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.8)',
            border: '1px solid #333',
            borderRadius: 4,
            padding: 8,
            fontFamily: 'var(--tmnl-font-mono)',
            fontSize: 11,
            color: '#888',
          }}
        >
          <div>LON: {viewState.longitude.toFixed(4)}</div>
          <div>LAT: {viewState.latitude.toFixed(4)}</div>
          <div>ZOOM: {viewState.zoom.toFixed(2)}</div>
          <div>TRACKS: {tracks.length}</div>
          <div>POSITIONED: {positionedEntities.length}</div>
          <div>LAYERS: {layers.length}</div>
        </div>
      )}
    </div>
  )
}

/**
 * GeointMap wrapped with PositioningProvider.
 * Use this when you need programmatic entity positioning via Kori ECS.
 */
function GeointMapWithPositioning(props: GeointMapProps) {
  return (
    <PositioningProvider>
      <GeointMapComponent {...props} />
    </PositioningProvider>
  )
}

export const GeointMap = memo(GeointMapComponent)
export const GeointMapPositioned = memo(GeointMapWithPositioning)
export { positioningOps }
export { createGeointInstanceAtoms, disposeGeointInstanceAtoms }
export type { GeointLayerVisibility }
export default GeointMap
