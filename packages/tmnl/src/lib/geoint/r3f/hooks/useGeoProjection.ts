/**
 * useGeoProjection - Lat/lon to screen coordinate projection
 *
 * Projects geographic coordinates to screen space for R3F overlay.
 * Uses deck.gl's WebMercatorViewport for accurate projection.
 *
 * @module geoint/r3f/hooks/useGeoProjection
 */

import { useMemo } from 'react'
import { WebMercatorViewport } from '@deck.gl/core'

// =============================================================================
// Types
// =============================================================================

export interface ViewState {
  longitude: number
  latitude: number
  zoom: number
  pitch?: number
  bearing?: number
}

export interface Dimensions {
  width: number
  height: number
}

export interface GeoProjection {
  /**
   * Project lon/lat to screen coordinates
   * Returns [x, y] in screen pixels from center
   */
  project: (lon: number, lat: number) => [number, number]

  /**
   * Project lon/lat to normalized device coordinates (-1 to 1)
   */
  projectNDC: (lon: number, lat: number) => [number, number]

  /**
   * Unproject screen coordinates to lon/lat
   */
  unproject: (x: number, y: number) => [number, number]

  /**
   * Get the viewport for advanced operations
   */
  viewport: WebMercatorViewport

  /**
   * Check if a point is visible in the viewport
   */
  isVisible: (lon: number, lat: number) => boolean
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook for projecting geographic coordinates to screen space
 *
 * @param viewState - Current map view state (lon, lat, zoom, pitch, bearing)
 * @param dimensions - Canvas dimensions (width, height)
 * @returns Projection utilities for converting coordinates
 *
 * @example
 * ```tsx
 * function TrackMarker({ lon, lat }) {
 *   const { project } = useGeoProjection(viewState, dimensions)
 *   const [x, y] = project(lon, lat)
 *
 *   return (
 *     <mesh position={[x, y, 0]}>
 *       <coneGeometry args={[5, 10]} />
 *     </mesh>
 *   )
 * }
 * ```
 */
export function useGeoProjection(
  viewState: ViewState,
  dimensions: Dimensions
): GeoProjection {
  const viewport = useMemo(
    () =>
      new WebMercatorViewport({
        longitude: viewState.longitude,
        latitude: viewState.latitude,
        zoom: viewState.zoom,
        pitch: viewState.pitch ?? 0,
        bearing: viewState.bearing ?? 0,
        width: dimensions.width,
        height: dimensions.height,
      }),
    [
      viewState.longitude,
      viewState.latitude,
      viewState.zoom,
      viewState.pitch,
      viewState.bearing,
      dimensions.width,
      dimensions.height,
    ]
  )

  const project = useMemo(() => {
    return (lon: number, lat: number): [number, number] => {
      const [x, y] = viewport.project([lon, lat])
      // Convert to R3F coordinate system (center origin, Y up)
      return [x - dimensions.width / 2, dimensions.height / 2 - y]
    }
  }, [viewport, dimensions.width, dimensions.height])

  const projectNDC = useMemo(() => {
    return (lon: number, lat: number): [number, number] => {
      const [x, y] = viewport.project([lon, lat])
      // Convert to normalized device coordinates (-1 to 1)
      return [
        (x / dimensions.width) * 2 - 1,
        1 - (y / dimensions.height) * 2,
      ]
    }
  }, [viewport, dimensions.width, dimensions.height])

  const unproject = useMemo(() => {
    return (x: number, y: number): [number, number] => {
      // Convert from R3F coords back to screen coords
      const screenX = x + dimensions.width / 2
      const screenY = dimensions.height / 2 - y
      const [lon, lat] = viewport.unproject([screenX, screenY])
      return [lon, lat]
    }
  }, [viewport, dimensions.width, dimensions.height])

  const isVisible = useMemo(() => {
    return (lon: number, lat: number): boolean => {
      const [x, y] = viewport.project([lon, lat])
      return x >= 0 && x <= dimensions.width && y >= 0 && y <= dimensions.height
    }
  }, [viewport, dimensions.width, dimensions.height])

  return {
    project,
    projectNDC,
    unproject,
    viewport,
    isVisible,
  }
}

export default useGeoProjection
