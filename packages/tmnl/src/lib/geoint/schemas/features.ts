import { Schema } from 'effect'
import { FeatureId, LayerId, LayerType, BBox } from './core'

// =============================================================================
// GeoJSON Geometry Types (Tagged for pattern matching)
// =============================================================================

/** GeoJSON Point geometry */
export class PointGeometry extends Schema.TaggedClass<PointGeometry>(
  'PointGeometry'
)('Point', {
  type: Schema.Literal('Point'),
  coordinates: Schema.Tuple(Schema.Number, Schema.Number)
}) {}

/** GeoJSON LineString geometry */
export class LineStringGeometry extends Schema.TaggedClass<LineStringGeometry>(
  'LineStringGeometry'
)('LineString', {
  type: Schema.Literal('LineString'),
  coordinates: Schema.Array(Schema.Tuple(Schema.Number, Schema.Number))
}) {}

/** GeoJSON Polygon geometry */
export class PolygonGeometry extends Schema.TaggedClass<PolygonGeometry>(
  'PolygonGeometry'
)('Polygon', {
  type: Schema.Literal('Polygon'),
  coordinates: Schema.Array(
    Schema.Array(Schema.Tuple(Schema.Number, Schema.Number))
  )
}) {}

/** Union of supported geometry types */
export const Geometry = Schema.Union(
  PointGeometry,
  LineStringGeometry,
  PolygonGeometry
)
export type Geometry = typeof Geometry.Type

// =============================================================================
// Feature
// =============================================================================

/** Properties bag for feature attributes */
export const FeatureProperties = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown
})
export type FeatureProperties = typeof FeatureProperties.Type

/** A static geographic feature */
export class Feature extends Schema.TaggedClass<Feature>('Feature')(
  'Feature',
  {
    /** Unique feature identifier */
    id: FeatureId,

    /** GeoJSON geometry */
    geometry: Geometry,

    /** Feature properties/attributes */
    properties: FeatureProperties,

    /** Layer this feature belongs to */
    layerId: LayerId
  }
) {}

/** GeoJSON-compliant feature for deck.gl layers */
export const GeoJsonFeature = Schema.Struct({
  type: Schema.Literal('Feature'),
  id: Schema.optional(Schema.Union(Schema.String, Schema.Number)),
  geometry: Geometry,
  properties: Schema.optionalWith(FeatureProperties, { default: () => ({}) })
})
export type GeoJsonFeature = typeof GeoJsonFeature.Type

/** GeoJSON FeatureCollection */
export const FeatureCollection = Schema.Struct({
  type: Schema.Literal('FeatureCollection'),
  features: Schema.Array(GeoJsonFeature)
})
export type FeatureCollection = typeof FeatureCollection.Type

// =============================================================================
// Layer
// =============================================================================

/** Layer visibility and style configuration */
export class Layer extends Schema.TaggedClass<Layer>('Layer')('Layer', {
  /** Unique layer identifier */
  id: LayerId,

  /** Display name */
  name: Schema.String,

  /** Layer type (vector/raster/imagery) */
  type: LayerType,

  /** Whether layer is visible */
  visible: Schema.Boolean,

  /** Layer opacity (0-1) */
  opacity: Schema.Number.pipe(Schema.between(0, 1)),

  /** Z-index for layer ordering */
  zIndex: Schema.optionalWith(Schema.Number, { default: () => 0 })
}) {}

// =============================================================================
// Layer Events
// =============================================================================

/** Layer toggle event */
export class LayerToggle extends Schema.TaggedClass<LayerToggle>(
  'LayerToggle'
)('LayerToggle', {
  layerId: LayerId,
  visible: Schema.Boolean
}) {}

/** Layer opacity change event */
export class LayerOpacityChange extends Schema.TaggedClass<LayerOpacityChange>(
  'LayerOpacityChange'
)('LayerOpacityChange', {
  layerId: LayerId,
  opacity: Schema.Number.pipe(Schema.between(0, 1))
}) {}

/** Union of layer events */
export const LayerEvent = Schema.Union(LayerToggle, LayerOpacityChange)
export type LayerEvent = typeof LayerEvent.Type

// =============================================================================
// Feature Queries
// =============================================================================

/** Query parameters for fetching features */
export const FeatureQuery = Schema.Struct({
  /** Bounding box to query within */
  bounds: BBox,

  /** Layers to include (empty = all) */
  layers: Schema.optionalWith(Schema.Array(LayerId), {
    default: () => []
  }),

  /** Maximum number of features to return */
  limit: Schema.optionalWith(Schema.Number.pipe(Schema.positive()), {
    default: () => 1000
  })
})
export type FeatureQuery = typeof FeatureQuery.Type

/** Response for feature queries */
export class FeatureQueryResponse extends Schema.TaggedClass<FeatureQueryResponse>(
  'FeatureQueryResponse'
)('FeatureQueryResponse', {
  features: Schema.Array(Feature),
  totalCount: Schema.Number,
  truncated: Schema.Boolean
}) {}
