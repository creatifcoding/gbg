/**
 * Feature Layer Factories - Deck.gl layers for vector features
 *
 * Provides:
 * - GeoJsonLayer for general features
 * - PolygonLayer for area features
 * - PathLayer for linear features
 * - ScatterplotLayer for point features
 *
 * @see .cursor/prd/features.md F002 (Feature Layers)
 * @module
 */

import { GeoJsonLayer, ScatterplotLayer, PolygonLayer, PathLayer } from '@deck.gl/layers'
import type { Color, PickingInfo } from '@deck.gl/core'
import type { Feature, FeatureCollection } from '../schemas'

// =============================================================================
// Configuration
// =============================================================================

const DEFAULT_FILL_COLOR: Color = [0, 150, 255, 100]
const DEFAULT_STROKE_COLOR: Color = [0, 200, 255, 255]
const DEFAULT_STROKE_WIDTH = 2
const DEFAULT_POINT_RADIUS = 6

// =============================================================================
// Layer Type Colors
// =============================================================================

export const layerTypeColors: Record<string, Color> = {
  vector: [0, 150, 255, 200],
  raster: [255, 150, 0, 200],
  heatmap: [255, 50, 50, 200],
  track: [0, 255, 150, 200]
}

// =============================================================================
// GeoJSON Layer
// =============================================================================

export interface GeoJsonLayerOptions {
  id?: string
  visible?: boolean
  pickable?: boolean
  filled?: boolean
  stroked?: boolean
  fillColor?: Color
  strokeColor?: Color
  strokeWidth?: number
  pointRadius?: number
  onHover?: (info: PickingInfo<Feature>) => void
  onClick?: (info: PickingInfo<Feature>) => void
}

/**
 * Create GeoJsonLayer from FeatureCollection
 *
 * @example
 * ```typescript
 * const layer = createGeoJsonLayer(featureCollection, {
 *   fillColor: [0, 150, 255, 100],
 *   strokeColor: [0, 200, 255, 255],
 *   pickable: true
 * })
 * ```
 */
export const createGeoJsonLayer = (
  features: FeatureCollection | readonly Feature[],
  options?: GeoJsonLayerOptions
) => {
  // GeoJsonLayer requires mutable GeoJSON, cast readonly to mutable
  const data = Array.isArray(features)
    ? { type: 'FeatureCollection', features: [...features] as unknown }
    : features as unknown

  return new GeoJsonLayer({
    id: options?.id ?? 'geoint-features',
    data: data as string,  // GeoJsonLayer accepts string | object | Promise
    pickable: options?.pickable ?? true,
    visible: options?.visible ?? true,
    filled: options?.filled ?? true,
    stroked: options?.stroked ?? true,
    getFillColor: options?.fillColor ?? DEFAULT_FILL_COLOR,
    getLineColor: options?.strokeColor ?? DEFAULT_STROKE_COLOR,
    getLineWidth: options?.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    getPointRadius: options?.pointRadius ?? DEFAULT_POINT_RADIUS,
    lineWidthUnits: 'pixels',
    pointRadiusUnits: 'pixels',
    onHover: options?.onHover,
    onClick: options?.onClick
  })
}

// =============================================================================
// Point Feature Layer
// =============================================================================

export interface PointFeatureData {
  id: string
  position: [number, number]
  properties: Record<string, unknown>
  color: Color
}

/**
 * Extract point features from a collection
 */
export const extractPointFeatures = (
  features: readonly Feature[],
  getColor?: (feature: Feature) => Color
): PointFeatureData[] =>
  features
    .filter((f) => f.geometry._tag === 'Point')
    .map((f) => {
      const geom = f.geometry as unknown as { coordinates: [number, number] }
      return {
        id: f.id,
        position: geom.coordinates,
        properties: f.properties as Record<string, unknown>,
        color: getColor?.(f) ?? DEFAULT_FILL_COLOR
      }
    })

/**
 * Create ScatterplotLayer for point features
 */
export const createPointFeatureLayer = (
  features: readonly Feature[],
  options?: {
    id?: string
    visible?: boolean
    pickable?: boolean
    radius?: number
    getColor?: (feature: Feature) => Color
    onHover?: (info: PickingInfo<PointFeatureData>) => void
    onClick?: (info: PickingInfo<PointFeatureData>) => void
  }
) =>
  new ScatterplotLayer<PointFeatureData>({
    id: options?.id ?? 'geoint-point-features',
    data: extractPointFeatures(features, options?.getColor),
    getPosition: (d) => d.position,
    getFillColor: (d) => d.color,
    getRadius: options?.radius ?? DEFAULT_POINT_RADIUS,
    radiusUnits: 'pixels',
    pickable: options?.pickable ?? true,
    visible: options?.visible ?? true,
    onHover: options?.onHover,
    onClick: options?.onClick
  })

// =============================================================================
// Linear Feature Layer
// =============================================================================

export interface LinearFeatureData {
  id: string
  path: [number, number][]
  properties: Record<string, unknown>
  color: Color
}

/**
 * Extract linear features from a collection
 */
export const extractLinearFeatures = (
  features: readonly Feature[],
  getColor?: (feature: Feature) => Color
): LinearFeatureData[] =>
  features
    .filter((f) => f.geometry._tag === 'LineString')
    .map((f) => {
      const geom = f.geometry as unknown as { coordinates: [number, number][] }
      return {
        id: f.id,
        path: geom.coordinates,
        properties: f.properties as Record<string, unknown>,
        color: getColor?.(f) ?? DEFAULT_STROKE_COLOR
      }
    })

/**
 * Create PathLayer for linear features
 */
export const createLinearFeatureLayer = (
  features: readonly Feature[],
  options?: {
    id?: string
    visible?: boolean
    pickable?: boolean
    width?: number
    getColor?: (feature: Feature) => Color
    onHover?: (info: PickingInfo<LinearFeatureData>) => void
    onClick?: (info: PickingInfo<LinearFeatureData>) => void
  }
) =>
  new PathLayer<LinearFeatureData>({
    id: options?.id ?? 'geoint-linear-features',
    data: extractLinearFeatures(features, options?.getColor),
    getPath: (d) => d.path,
    getColor: (d) => d.color,
    getWidth: options?.width ?? DEFAULT_STROKE_WIDTH,
    widthUnits: 'pixels',
    pickable: options?.pickable ?? true,
    visible: options?.visible ?? true,
    onHover: options?.onHover,
    onClick: options?.onClick
  })

// =============================================================================
// Polygon Feature Layer
// =============================================================================

export interface PolygonFeatureData {
  id: string
  polygon: [number, number][][]
  properties: Record<string, unknown>
  fillColor: Color
  strokeColor: Color
}

/**
 * Extract polygon features from a collection
 */
export const extractPolygonFeatures = (
  features: readonly Feature[],
  getColor?: (feature: Feature) => { fill: Color; stroke: Color }
): PolygonFeatureData[] =>
  features
    .filter((f) => f.geometry._tag === 'Polygon')
    .map((f) => {
      const colors = getColor?.(f) ?? { fill: DEFAULT_FILL_COLOR, stroke: DEFAULT_STROKE_COLOR }
      const geom = f.geometry as unknown as { coordinates: [number, number][][] }
      return {
        id: f.id,
        polygon: geom.coordinates,
        properties: f.properties as Record<string, unknown>,
        fillColor: colors.fill,
        strokeColor: colors.stroke
      }
    })

/**
 * Create PolygonLayer for area features
 */
export const createPolygonFeatureLayer = (
  features: readonly Feature[],
  options?: {
    id?: string
    visible?: boolean
    pickable?: boolean
    filled?: boolean
    stroked?: boolean
    strokeWidth?: number
    getColor?: (feature: Feature) => { fill: Color; stroke: Color }
    onHover?: (info: PickingInfo<PolygonFeatureData>) => void
    onClick?: (info: PickingInfo<PolygonFeatureData>) => void
  }
) =>
  new PolygonLayer<PolygonFeatureData>({
    id: options?.id ?? 'geoint-polygon-features',
    data: extractPolygonFeatures(features, options?.getColor),
    getPolygon: (d) => d.polygon,
    getFillColor: (d) => d.fillColor,
    getLineColor: (d) => d.strokeColor,
    getLineWidth: options?.strokeWidth ?? DEFAULT_STROKE_WIDTH,
    lineWidthUnits: 'pixels',
    filled: options?.filled ?? true,
    stroked: options?.stroked ?? true,
    pickable: options?.pickable ?? true,
    visible: options?.visible ?? true,
    onHover: options?.onHover,
    onClick: options?.onClick
  })

// =============================================================================
// Composite Feature Layers
// =============================================================================

/**
 * Create all feature layers based on geometry types
 */
export const createFeatureLayers = (
  features: readonly Feature[],
  options?: {
    pickable?: boolean
    visible?: boolean
    onHover?: (info: PickingInfo<unknown>) => void
    onClick?: (info: PickingInfo<unknown>) => void
  }
) => {
  const layers = []

  // Add polygon layer
  const polygons = features.filter((f) => f.geometry._tag === 'Polygon')
  if (polygons.length > 0) {
    layers.push(
      createPolygonFeatureLayer(polygons, {
        pickable: options?.pickable,
        visible: options?.visible,
        onHover: options?.onHover as (info: PickingInfo<PolygonFeatureData>) => void,
        onClick: options?.onClick as (info: PickingInfo<PolygonFeatureData>) => void
      })
    )
  }

  // Add linear layer
  const lines = features.filter((f) => f.geometry._tag === 'LineString')
  if (lines.length > 0) {
    layers.push(
      createLinearFeatureLayer(lines, {
        pickable: options?.pickable,
        visible: options?.visible,
        onHover: options?.onHover as (info: PickingInfo<LinearFeatureData>) => void,
        onClick: options?.onClick as (info: PickingInfo<LinearFeatureData>) => void
      })
    )
  }

  // Add point layer
  const points = features.filter((f) => f.geometry._tag === 'Point')
  if (points.length > 0) {
    layers.push(
      createPointFeatureLayer(points, {
        pickable: options?.pickable,
        visible: options?.visible,
        onHover: options?.onHover as (info: PickingInfo<PointFeatureData>) => void,
        onClick: options?.onClick as (info: PickingInfo<PointFeatureData>) => void
      })
    )
  }

  return layers
}
