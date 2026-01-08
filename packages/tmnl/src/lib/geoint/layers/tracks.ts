/**
 * Track Layer Factories - Deck.gl layers for track visualization
 *
 * Provides:
 * - PathLayer for track paths
 * - IconLayer for current track positions
 * - TripsLayer for animated track trails
 *
 * @see .cursor/prd/features.md F001 (Track Visualization)
 * @module
 */

import { PathLayer, IconLayer, ScatterplotLayer } from '@deck.gl/layers'
import type { Color, PickingInfo } from '@deck.gl/core'
import type { Track, Classification } from '../schemas'
import { classificationColors } from '../schemas'

// =============================================================================
// Configuration
// =============================================================================

const TRACK_PATH_WIDTH = 2
const TRACK_PATH_WIDTH_CONFIDENCE = 3 // For high-confidence tracks
const ICON_SIZE = 24
const SCATTERPLOT_RADIUS = 8
const CONFIDENCE_THRESHOLD = 0.8

// =============================================================================
// Helpers
// =============================================================================

/**
 * Get RGB color for a classification
 */
export const getClassificationColor = (
  classification: Classification | undefined
): Color => {
  const key = classification ?? 'unknown'
  const color = classificationColors[key]
  return [color[0], color[1], color[2], 255] as Color
}

/**
 * Determine if track is high-confidence
 */
const isHighConfidence = (confidence: number): boolean =>
  confidence >= CONFIDENCE_THRESHOLD

// =============================================================================
// Path Layer
// =============================================================================

export interface TrackPathLayerData {
  trackId: string
  path: [number, number][]
  color: Color
  width: number
  classification: Classification
  confidence: number
}

/**
 * Create PathLayer data from tracks
 */
export const createTrackPathData = (tracks: readonly Track[]): TrackPathLayerData[] =>
  tracks.map((track) => ({
    trackId: track.trackId,
    path: track.positions.map((p) => [p.lon, p.lat] as [number, number]),
    color: getClassificationColor(track.metadata.classification),
    width: isHighConfidence(track.metadata.confidence)
      ? TRACK_PATH_WIDTH_CONFIDENCE
      : TRACK_PATH_WIDTH,
    classification: track.metadata.classification ?? 'unknown',
    confidence: track.metadata.confidence
  }))

/**
 * Create PathLayer for track paths
 *
 * @example
 * ```typescript
 * const pathLayer = createTrackPathLayer(tracks, {
 *   onHover: (info) => console.log('Hovered track:', info.object?.trackId)
 * })
 * ```
 */
export const createTrackPathLayer = (
  tracks: readonly Track[],
  options?: {
    id?: string
    visible?: boolean
    pickable?: boolean
    onHover?: (info: PickingInfo<TrackPathLayerData>) => void
    onClick?: (info: PickingInfo<TrackPathLayerData>) => void
  }
) =>
  new PathLayer<TrackPathLayerData>({
    id: options?.id ?? 'geoint-track-paths',
    data: createTrackPathData(tracks),
    getPath: (d) => d.path,
    getColor: (d) => d.color,
    getWidth: (d) => d.width,
    widthUnits: 'pixels',
    widthMinPixels: 1,
    widthMaxPixels: 10,
    pickable: options?.pickable ?? true,
    visible: options?.visible ?? true,
    onHover: options?.onHover,
    onClick: options?.onClick,
    updateTriggers: {
      getPath: [tracks.map((t) => t.trackId).join(',')],
      getColor: [tracks.map((t) => t.metadata.classification).join(',')]
    }
  })

// =============================================================================
// Position Layer (Current Positions)
// =============================================================================

export interface TrackPositionData {
  trackId: string
  position: [number, number]
  color: Color
  classification: Classification
  heading: number
  speed: number
  objectType: string
}

/**
 * Create position data from tracks (latest position only)
 */
export const createTrackPositionData = (tracks: readonly Track[]): TrackPositionData[] =>
  tracks
    .filter((track) => track.positions.length > 0)
    .map((track) => {
      const latest = track.latestPosition!
      return {
        trackId: track.trackId,
        position: [latest.lon, latest.lat] as [number, number],
        color: getClassificationColor(track.metadata.classification),
        classification: track.metadata.classification ?? 'unknown',
        heading: latest.heading,
        speed: latest.speed,
        objectType: track.metadata.objectType
      }
    })

/**
 * Create ScatterplotLayer for current track positions
 */
export const createTrackPositionLayer = (
  tracks: readonly Track[],
  options?: {
    id?: string
    visible?: boolean
    pickable?: boolean
    radius?: number
    onHover?: (info: PickingInfo<TrackPositionData>) => void
    onClick?: (info: PickingInfo<TrackPositionData>) => void
  }
) =>
  new ScatterplotLayer<TrackPositionData>({
    id: options?.id ?? 'geoint-track-positions',
    data: createTrackPositionData(tracks),
    getPosition: (d) => d.position,
    getFillColor: (d) => d.color,
    getRadius: options?.radius ?? SCATTERPLOT_RADIUS,
    radiusUnits: 'pixels',
    radiusMinPixels: 4,
    radiusMaxPixels: 20,
    pickable: options?.pickable ?? true,
    visible: options?.visible ?? true,
    onHover: options?.onHover,
    onClick: options?.onClick,
    updateTriggers: {
      getPosition: [tracks.map((t) => t.trackId).join(',')],
      getFillColor: [tracks.map((t) => t.metadata.classification).join(',')]
    }
  })

// =============================================================================
// Heading Layer (Arrow indicators)
// =============================================================================

/**
 * SVG arrow icon for track heading
 */
const ARROW_ICON_URL =
  'data:image/svg+xml;base64,' +
  btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <path d="M12 2L22 20H2Z" fill="#ffffff" stroke="#000000" stroke-width="1"/>
  </svg>`)

/**
 * Create IconLayer for track headings
 */
export const createTrackHeadingLayer = (
  tracks: readonly Track[],
  options?: {
    id?: string
    visible?: boolean
    pickable?: boolean
    iconSize?: number
    onHover?: (info: PickingInfo<TrackPositionData>) => void
    onClick?: (info: PickingInfo<TrackPositionData>) => void
  }
) =>
  new IconLayer<TrackPositionData>({
    id: options?.id ?? 'geoint-track-headings',
    data: createTrackPositionData(tracks),
    iconAtlas: ARROW_ICON_URL,
    iconMapping: {
      arrow: { x: 0, y: 0, width: 24, height: 24, anchorY: 24 }
    },
    getIcon: () => 'arrow',
    getPosition: (d) => d.position,
    getSize: options?.iconSize ?? ICON_SIZE,
    getColor: (d) => d.color,
    getAngle: (d) => -d.heading, // Negative for deck.gl rotation
    sizeUnits: 'pixels',
    pickable: options?.pickable ?? false,
    visible: options?.visible ?? true,
    updateTriggers: {
      getPosition: [tracks.map((t) => t.trackId).join(',')],
      getAngle: [tracks.map((t) => t.latestPosition?.heading).join(',')],
      getColor: [tracks.map((t) => t.metadata.classification).join(',')]
    }
  })

// =============================================================================
// Composite Layer Factory
// =============================================================================

export interface TrackLayerOptions {
  showPaths?: boolean
  showPositions?: boolean
  showHeadings?: boolean
  pathWidth?: number
  positionRadius?: number
  iconSize?: number
  pickable?: boolean
  onHover?: (info: PickingInfo<TrackPathLayerData | TrackPositionData>) => void
  onClick?: (info: PickingInfo<TrackPathLayerData | TrackPositionData>) => void
}

/**
 * Create all track layers as an array
 *
 * @example
 * ```typescript
 * const layers = createTrackLayers(tracks, {
 *   showPaths: true,
 *   showPositions: true,
 *   showHeadings: true
 * })
 * // Use with DeckGL: <DeckGL layers={[...otherLayers, ...layers]} />
 * ```
 */
export const createTrackLayers = (
  tracks: readonly Track[],
  options?: TrackLayerOptions
) => {
  const layers = []

  if (options?.showPaths !== false) {
    layers.push(
      createTrackPathLayer(tracks, {
        pickable: options?.pickable,
        onHover: options?.onHover as (info: PickingInfo<TrackPathLayerData>) => void,
        onClick: options?.onClick as (info: PickingInfo<TrackPathLayerData>) => void
      })
    )
  }

  if (options?.showPositions !== false) {
    layers.push(
      createTrackPositionLayer(tracks, {
        radius: options?.positionRadius,
        pickable: options?.pickable,
        onHover: options?.onHover as (info: PickingInfo<TrackPositionData>) => void,
        onClick: options?.onClick as (info: PickingInfo<TrackPositionData>) => void
      })
    )
  }

  if (options?.showHeadings) {
    layers.push(
      createTrackHeadingLayer(tracks, {
        iconSize: options?.iconSize,
        pickable: false
      })
    )
  }

  return layers
}
