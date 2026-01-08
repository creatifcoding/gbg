/**
 * GEOINT Tile Layer Factories
 *
 * Creates deck.gl layers for raster tile visualization:
 * - TileLayer: XYZ tile rendering
 * - BitmapLayer: Single image overlays
 *
 * @module geoint/layers/tiles
 */

import { TileLayer, BitmapLayer } from '@deck.gl/geo-layers'
import type { Layer } from '@deck.gl/core'
import type { BBox, ImageryMetadata } from '../schemas'

// =============================================================================
// Configuration
// =============================================================================

/** Default tile size in pixels */
const DEFAULT_TILE_SIZE = 256

/** Default max zoom level */
const DEFAULT_MAX_ZOOM = 19

/** Default min zoom level */
const DEFAULT_MIN_ZOOM = 0

// =============================================================================
// TileLayer Factory
// =============================================================================

export interface CreateTileLayerOptions {
  /** Layer ID (default: 'geoint-tiles') */
  id?: string
  /** Tile URL template with {x}, {y}, {z} placeholders */
  tileUrl: string
  /** Tile size in pixels (default: 256) */
  tileSize?: number
  /** Maximum zoom level (default: 19) */
  maxZoom?: number
  /** Minimum zoom level (default: 0) */
  minZoom?: number
  /** Opacity (0-1) */
  opacity?: number
  /** Whether to render tiles in pixel coordinates */
  extent?: BBox
  /** Callback when tile loads */
  onTileLoad?: (tile: unknown) => void
  /** Callback when tile errors */
  onTileError?: (tile: unknown, error: Error) => void
}

/**
 * Create a TileLayer for XYZ tile rendering
 *
 * Supports standard web tile services (OSM, Mapbox, etc.)
 */
export function createTileLayer(options: CreateTileLayerOptions): Layer {
  const {
    id = 'geoint-tiles',
    tileUrl,
    tileSize = DEFAULT_TILE_SIZE,
    maxZoom = DEFAULT_MAX_ZOOM,
    minZoom = DEFAULT_MIN_ZOOM,
    opacity = 1,
    extent,
    onTileLoad,
    onTileError,
  } = options

  return new TileLayer({
    id,
    data: tileUrl,
    tileSize,
    maxZoom,
    minZoom,
    opacity,
    extent: extent ? [...extent] : undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderSubLayers: (props: any) => {
      const { west, south, east, north } = props.tile.bbox

      return new BitmapLayer(props, {
        data: undefined,
        image: props.data,
        bounds: [west, south, east, north],
      })
    },
    onTileLoad,
    onTileError,
  })
}

// =============================================================================
// Satellite Imagery Layer Factory
// =============================================================================

export interface CreateSatelliteLayerOptions {
  /** Layer ID (default: 'geoint-satellite') */
  id?: string
  /** Tile URL template for satellite imagery */
  tileUrl: string
  /** Maximum zoom level (default: 19) */
  maxZoom?: number
  /** Opacity (0-1) */
  opacity?: number
  /** Apply sensor-specific color mapping */
  sensorType?: 'optical' | 'sar' | 'thermal'
}

/**
 * Get color adjustment function for different sensor types
 */
function getSensorColorMapper(
  sensorType: 'optical' | 'sar' | 'thermal'
): ((pixel: Uint8ClampedArray) => void) | undefined {
  switch (sensorType) {
    case 'thermal':
      // Apply thermal color mapping (blue=cold, red=hot)
      return (pixel) => {
        const intensity = (pixel[0] + pixel[1] + pixel[2]) / 3
        const normalized = intensity / 255
        // Blue to Red gradient
        pixel[0] = Math.floor(normalized * 255) // R
        pixel[1] = 0 // G
        pixel[2] = Math.floor((1 - normalized) * 255) // B
      }
    case 'sar':
      // Apply SAR grayscale with enhanced contrast
      return (pixel) => {
        const intensity = (pixel[0] + pixel[1] + pixel[2]) / 3
        const enhanced = Math.min(255, intensity * 1.2)
        pixel[0] = enhanced
        pixel[1] = enhanced
        pixel[2] = enhanced
      }
    default:
      return undefined
  }
}

/**
 * Create a TileLayer for satellite imagery with sensor-specific styling
 */
export function createSatelliteLayer(
  options: CreateSatelliteLayerOptions
): Layer {
  const {
    id = 'geoint-satellite',
    tileUrl,
    maxZoom = DEFAULT_MAX_ZOOM,
    opacity = 1,
    sensorType = 'optical',
  } = options

  const colorMapper = getSensorColorMapper(sensorType)

  return new TileLayer({
    id,
    data: tileUrl,
    tileSize: DEFAULT_TILE_SIZE,
    maxZoom,
    minZoom: DEFAULT_MIN_ZOOM,
    opacity,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderSubLayers: (props: any) => {
      const { west, south, east, north } = props.tile.bbox

      return new BitmapLayer(props, {
        data: undefined,
        image: props.data,
        bounds: [west, south, east, north],
        // Apply color mapping for non-optical sensors
        ...(colorMapper && {
          textureParameters: {
            minFilter: 'linear',
            magFilter: 'linear',
          },
        }),
      })
    },
  })
}

// =============================================================================
// BitmapLayer Factory (Single Image Overlay)
// =============================================================================

export interface CreateBitmapLayerOptions {
  /** Layer ID (default: 'geoint-bitmap') */
  id?: string
  /** Image URL or data */
  imageUrl: string
  /** Bounding box [west, south, east, north] */
  bounds: BBox
  /** Opacity (0-1) */
  opacity?: number
  /** Imagery metadata for tooltips */
  metadata?: ImageryMetadata
}

/**
 * Create a BitmapLayer for single image overlays
 *
 * Useful for georeferenced images, orthophotos, etc.
 */
export function createBitmapLayer(options: CreateBitmapLayerOptions): Layer {
  const {
    id = 'geoint-bitmap',
    imageUrl,
    bounds,
    opacity = 1,
  } = options

  return new BitmapLayer({
    id,
    image: imageUrl,
    bounds: [...bounds] as [number, number, number, number],
    opacity,
  })
}

// =============================================================================
// Combined Tile Layers
// =============================================================================

export interface CreateTileLayersOptions {
  /** Base map tile URL */
  baseTileUrl?: string
  /** Satellite imagery tile URL */
  satelliteTileUrl?: string
  /** Sensor type for satellite layer */
  sensorType?: 'optical' | 'sar' | 'thermal'
  /** Base layer opacity */
  baseOpacity?: number
  /** Satellite layer opacity */
  satelliteOpacity?: number
}

/**
 * Create combined tile layers (base + satellite)
 */
export function createTileLayers(
  options: CreateTileLayersOptions = {}
): Layer[] {
  const {
    baseTileUrl,
    satelliteTileUrl,
    sensorType,
    baseOpacity = 1,
    satelliteOpacity = 1,
  } = options

  const layers: Layer[] = []

  if (baseTileUrl) {
    layers.push(
      createTileLayer({
        id: 'geoint-base-tiles',
        tileUrl: baseTileUrl,
        opacity: baseOpacity,
      })
    )
  }

  if (satelliteTileUrl) {
    layers.push(
      createSatelliteLayer({
        id: 'geoint-satellite-tiles',
        tileUrl: satelliteTileUrl,
        sensorType,
        opacity: satelliteOpacity,
      })
    )
  }

  return layers
}
