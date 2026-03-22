/**
 * Heatmap Layer Factories - Deck.gl heatmap visualization
 *
 * Provides:
 * - HeatmapLayer for density visualization
 * - Grid aggregation utilities
 *
 * @see .cursor/prd/features.md F004 (Heatmap Visualization)
 * @module
 */

import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import type { Color, PickingInfo } from '@deck.gl/core'
import type { Track, TrackPosition } from '../schemas'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_INTENSITY = 1
const DEFAULT_THRESHOLD = 0.03
const DEFAULT_RADIUS_PIXELS = 30

// =============================================================================
// Color Ramps
// =============================================================================

/**
 * Default heatmap color ramp (blue -> yellow -> red)
 */
export const defaultColorRange: Color[] = [
  [26, 35, 126, 25],   // Deep blue (low)
  [0, 150, 255, 100],  // Blue
  [0, 255, 200, 150],  // Cyan
  [255, 255, 0, 200],  // Yellow
  [255, 150, 0, 230],  // Orange
  [255, 0, 0, 255]     // Red (high)
]

/**
 * Threat-level color ramp (green -> yellow -> red)
 */
export const threatColorRange: Color[] = [
  [0, 128, 0, 50],     // Green (low threat)
  [128, 255, 0, 100],  // Light green
  [255, 255, 0, 150],  // Yellow
  [255, 128, 0, 200],  // Orange
  [255, 0, 0, 255]     // Red (high threat)
]

// =============================================================================
// Position Heatmap
// =============================================================================

export interface HeatmapPoint {
  position: [number, number]
  weight: number
}

/**
 * Extract heatmap points from track positions
 */
export const trackPositionsToHeatmapPoints = (
  tracks: readonly Track[],
  options?: {
    /** Weight function for each position */
    getWeight?: (position: TrackPosition, track: Track) => number
    /** Only include latest N positions per track */
    lastN?: number
  }
): HeatmapPoint[] => {
  const lastN = options?.lastN ?? Infinity
  const getWeight = options?.getWeight ?? (() => 1)

  return tracks.flatMap((track) => {
    const positions = lastN < Infinity
      ? track.positions.slice(-lastN)
      : track.positions

    return positions.map((pos) => ({
      position: [pos.lon, pos.lat] as [number, number],
      weight: getWeight(pos, track)
    }))
  })
}

/**
 * Create HeatmapLayer from track positions
 *
 * @example
 * ```typescript
 * const layer = createTrackHeatmapLayer(tracks, {
 *   radiusPixels: 30,
 *   intensity: 1.5,
 *   colorRange: threatColorRange
 * })
 * ```
 */
export const createTrackHeatmapLayer = (
  tracks: readonly Track[],
  options?: {
    id?: string
    visible?: boolean
    radiusPixels?: number
    intensity?: number
    threshold?: number
    colorRange?: Color[]
    getWeight?: (position: TrackPosition, track: Track) => number
    lastN?: number
  }
) =>
  new HeatmapLayer<HeatmapPoint>({
    id: options?.id ?? 'geoint-track-heatmap',
    data: trackPositionsToHeatmapPoints(tracks, {
      getWeight: options?.getWeight,
      lastN: options?.lastN
    }),
    getPosition: (d) => d.position,
    getWeight: (d) => d.weight,
    radiusPixels: options?.radiusPixels ?? DEFAULT_RADIUS_PIXELS,
    intensity: options?.intensity ?? DEFAULT_INTENSITY,
    threshold: options?.threshold ?? DEFAULT_THRESHOLD,
    colorRange: options?.colorRange ?? defaultColorRange,
    visible: options?.visible ?? true,
    aggregation: 'SUM'
  })

// =============================================================================
// Generic Point Heatmap
// =============================================================================

/**
 * Create HeatmapLayer from generic points
 */
export const createPointHeatmapLayer = <T extends { lon: number; lat: number }>(
  points: readonly T[],
  options?: {
    id?: string
    visible?: boolean
    radiusPixels?: number
    intensity?: number
    threshold?: number
    colorRange?: Color[]
    getWeight?: (point: T) => number
  }
) =>
  new HeatmapLayer<T>({
    id: options?.id ?? 'geoint-point-heatmap',
    data: points,
    getPosition: (d) => [d.lon, d.lat] as [number, number],
    getWeight: options?.getWeight ?? (() => 1),
    radiusPixels: options?.radiusPixels ?? DEFAULT_RADIUS_PIXELS,
    intensity: options?.intensity ?? DEFAULT_INTENSITY,
    threshold: options?.threshold ?? DEFAULT_THRESHOLD,
    colorRange: options?.colorRange ?? defaultColorRange,
    visible: options?.visible ?? true,
    aggregation: 'SUM'
  })
