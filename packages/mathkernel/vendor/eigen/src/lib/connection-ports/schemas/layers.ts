/**
 * deck.gl Layer Schemas
 *
 * Type-safe schemas for deck.gl layer configurations that can be
 * serialized in RenderSpec.options and built into actual Layer instances.
 *
 * @module connection-ports/schemas/layers
 */

import { Schema } from 'effect';

// =============================================================================
// Common Types
// =============================================================================

/**
 * RGBA color as [r, g, b] or [r, g, b, a] (0-255 range)
 */
export const RGBAColor = Schema.Union(
  Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
  Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number)
);
export type RGBAColor = typeof RGBAColor.Type;

/**
 * Position as [longitude, latitude] or [longitude, latitude, altitude]
 */
export const Position = Schema.Union(
  Schema.Tuple(Schema.Number, Schema.Number),
  Schema.Tuple(Schema.Number, Schema.Number, Schema.Number)
);
export type Position = typeof Position.Type;

/**
 * Common layer base properties
 */
export const LayerBaseConfig = Schema.Struct({
  /** Layer ID */
  id: Schema.String,
  /** Visibility */
  visible: Schema.optional(Schema.Boolean),
  /** Opacity (0-1) */
  opacity: Schema.optional(Schema.Number),
  /** Pickable for interactions */
  pickable: Schema.optional(Schema.Boolean),
  /** Auto-highlight on hover */
  autoHighlight: Schema.optional(Schema.Boolean),
  /** Highlight color */
  highlightColor: Schema.optional(RGBAColor),
});
export type LayerBaseConfig = typeof LayerBaseConfig.Type;

// =============================================================================
// ScatterplotLayer
// =============================================================================

/**
 * ScatterplotLayer configuration
 * Used for point markers on maps
 */
export class ScatterplotLayerConfig extends Schema.TaggedClass<ScatterplotLayerConfig>()(
  'ScatterplotLayerConfig',
  {
    ...LayerBaseConfig.fields,

    /** Data accessor field for position */
    getPosition: Schema.optional(Schema.String),

    /** Radius in meters or pixels */
    getRadius: Schema.optional(Schema.Union(Schema.Number, Schema.String)),

    /** Fill color */
    getFillColor: Schema.optional(Schema.Union(RGBAColor, Schema.String)),

    /** Line color */
    getLineColor: Schema.optional(Schema.Union(RGBAColor, Schema.String)),

    /** Line width in pixels */
    getLineWidth: Schema.optional(Schema.Union(Schema.Number, Schema.String)),

    /** Whether radius is in meters (true) or pixels (false) */
    radiusUnits: Schema.optional(Schema.Literal('meters', 'pixels')),

    /** Min radius in pixels */
    radiusMinPixels: Schema.optional(Schema.Number),

    /** Max radius in pixels */
    radiusMaxPixels: Schema.optional(Schema.Number),

    /** Radius scale multiplier */
    radiusScale: Schema.optional(Schema.Number),

    /** Draw outline */
    stroked: Schema.optional(Schema.Boolean),

    /** Fill interior */
    filled: Schema.optional(Schema.Boolean),

    /** Billboard mode (always face camera) */
    billboard: Schema.optional(Schema.Boolean),

    /** Anti-aliasing */
    antialiasing: Schema.optional(Schema.Boolean),
  }
) {}

// =============================================================================
// IconLayer
// =============================================================================

/**
 * IconLayer configuration
 * Used for icon markers on maps
 */
export class IconLayerConfig extends Schema.TaggedClass<IconLayerConfig>()(
  'IconLayerConfig',
  {
    ...LayerBaseConfig.fields,

    /** Data accessor for position */
    getPosition: Schema.optional(Schema.String),

    /** Icon name or accessor */
    getIcon: Schema.optional(Schema.String),

    /** Icon size */
    getSize: Schema.optional(Schema.Union(Schema.Number, Schema.String)),

    /** Icon color */
    getColor: Schema.optional(Schema.Union(RGBAColor, Schema.String)),

    /** Icon angle in degrees */
    getAngle: Schema.optional(Schema.Union(Schema.Number, Schema.String)),

    /** Size units */
    sizeUnits: Schema.optional(Schema.Literal('meters', 'pixels')),

    /** Size scale */
    sizeScale: Schema.optional(Schema.Number),

    /** Min size in pixels */
    sizeMinPixels: Schema.optional(Schema.Number),

    /** Max size in pixels */
    sizeMaxPixels: Schema.optional(Schema.Number),

    /** Billboard mode */
    billboard: Schema.optional(Schema.Boolean),

    /** Icon atlas URL */
    iconAtlas: Schema.optional(Schema.String),

    /** Icon mapping object */
    iconMapping: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.Unknown })
    ),
  }
) {}

// =============================================================================
// PathLayer
// =============================================================================

/**
 * PathLayer configuration
 * Used for lines/routes on maps
 */
export class PathLayerConfig extends Schema.TaggedClass<PathLayerConfig>()(
  'PathLayerConfig',
  {
    ...LayerBaseConfig.fields,

    /** Data accessor for path positions */
    getPath: Schema.optional(Schema.String),

    /** Path color */
    getColor: Schema.optional(Schema.Union(RGBAColor, Schema.String)),

    /** Path width */
    getWidth: Schema.optional(Schema.Union(Schema.Number, Schema.String)),

    /** Width units */
    widthUnits: Schema.optional(Schema.Literal('meters', 'pixels')),

    /** Width scale */
    widthScale: Schema.optional(Schema.Number),

    /** Min width in pixels */
    widthMinPixels: Schema.optional(Schema.Number),

    /** Max width in pixels */
    widthMaxPixels: Schema.optional(Schema.Number),

    /** Cap style */
    capRounded: Schema.optional(Schema.Boolean),

    /** Joint style */
    jointRounded: Schema.optional(Schema.Boolean),

    /** Billboard mode */
    billboard: Schema.optional(Schema.Boolean),

    /** Miter limit */
    miterLimit: Schema.optional(Schema.Number),
  }
) {}

// =============================================================================
// PolygonLayer
// =============================================================================

/**
 * PolygonLayer configuration
 * Used for filled areas on maps
 */
export class PolygonLayerConfig extends Schema.TaggedClass<PolygonLayerConfig>()(
  'PolygonLayerConfig',
  {
    ...LayerBaseConfig.fields,

    /** Data accessor for polygon positions */
    getPolygon: Schema.optional(Schema.String),

    /** Fill color */
    getFillColor: Schema.optional(Schema.Union(RGBAColor, Schema.String)),

    /** Line color */
    getLineColor: Schema.optional(Schema.Union(RGBAColor, Schema.String)),

    /** Line width */
    getLineWidth: Schema.optional(Schema.Union(Schema.Number, Schema.String)),

    /** Elevation (for 3D) */
    getElevation: Schema.optional(Schema.Union(Schema.Number, Schema.String)),

    /** Draw fill */
    filled: Schema.optional(Schema.Boolean),

    /** Draw stroke */
    stroked: Schema.optional(Schema.Boolean),

    /** Extrude to 3D */
    extruded: Schema.optional(Schema.Boolean),

    /** Wireframe mode */
    wireframe: Schema.optional(Schema.Boolean),

    /** Elevation scale */
    elevationScale: Schema.optional(Schema.Number),

    /** Line width units */
    lineWidthUnits: Schema.optional(Schema.Literal('meters', 'pixels')),

    /** Line width scale */
    lineWidthScale: Schema.optional(Schema.Number),

    /** Line width min pixels */
    lineWidthMinPixels: Schema.optional(Schema.Number),

    /** Line width max pixels */
    lineWidthMaxPixels: Schema.optional(Schema.Number),

    /** Line joint style */
    lineJointRounded: Schema.optional(Schema.Boolean),
  }
) {}

// =============================================================================
// HexagonLayer
// =============================================================================

/**
 * HexagonLayer configuration
 * Used for hexagonal binning/aggregation
 */
export class HexagonLayerConfig extends Schema.TaggedClass<HexagonLayerConfig>()(
  'HexagonLayerConfig',
  {
    ...LayerBaseConfig.fields,

    /** Data accessor for position */
    getPosition: Schema.optional(Schema.String),

    /** Hexagon radius in meters */
    radius: Schema.optional(Schema.Number),

    /** Color range for aggregation */
    colorRange: Schema.optional(Schema.Array(RGBAColor)),

    /** Coverage (0-1) */
    coverage: Schema.optional(Schema.Number),

    /** Elevation range */
    elevationRange: Schema.optional(
      Schema.Tuple(Schema.Number, Schema.Number)
    ),

    /** Elevation scale */
    elevationScale: Schema.optional(Schema.Number),

    /** Extrude hexagons */
    extruded: Schema.optional(Schema.Boolean),

    /** Aggregation method */
    colorAggregation: Schema.optional(
      Schema.Literal('SUM', 'MEAN', 'MIN', 'MAX')
    ),

    /** Elevation aggregation */
    elevationAggregation: Schema.optional(
      Schema.Literal('SUM', 'MEAN', 'MIN', 'MAX')
    ),

    /** Get color weight */
    getColorWeight: Schema.optional(Schema.Union(Schema.Number, Schema.String)),

    /** Get elevation weight */
    getElevationWeight: Schema.optional(
      Schema.Union(Schema.Number, Schema.String)
    ),

    /** Upper percentile for color */
    upperPercentile: Schema.optional(Schema.Number),

    /** Lower percentile for color */
    lowerPercentile: Schema.optional(Schema.Number),
  }
) {}

// =============================================================================
// GeoJsonLayer
// =============================================================================

/**
 * GeoJsonLayer configuration
 * Used for rendering GeoJSON features
 */
export class GeoJsonLayerConfig extends Schema.TaggedClass<GeoJsonLayerConfig>()(
  'GeoJsonLayerConfig',
  {
    ...LayerBaseConfig.fields,

    /** Fill color */
    getFillColor: Schema.optional(Schema.Union(RGBAColor, Schema.String)),

    /** Line color */
    getLineColor: Schema.optional(Schema.Union(RGBAColor, Schema.String)),

    /** Line width */
    getLineWidth: Schema.optional(Schema.Union(Schema.Number, Schema.String)),

    /** Point radius */
    getPointRadius: Schema.optional(Schema.Union(Schema.Number, Schema.String)),

    /** Elevation */
    getElevation: Schema.optional(Schema.Union(Schema.Number, Schema.String)),

    /** Draw fill */
    filled: Schema.optional(Schema.Boolean),

    /** Draw stroke */
    stroked: Schema.optional(Schema.Boolean),

    /** Extrude */
    extruded: Schema.optional(Schema.Boolean),

    /** Wireframe */
    wireframe: Schema.optional(Schema.Boolean),

    /** Point type */
    pointType: Schema.optional(Schema.Literal('circle', 'icon', 'text')),

    /** Line width units */
    lineWidthUnits: Schema.optional(Schema.Literal('meters', 'pixels')),

    /** Line width scale */
    lineWidthScale: Schema.optional(Schema.Number),

    /** Line width min pixels */
    lineWidthMinPixels: Schema.optional(Schema.Number),

    /** Line width max pixels */
    lineWidthMaxPixels: Schema.optional(Schema.Number),

    /** Point radius units */
    pointRadiusUnits: Schema.optional(Schema.Literal('meters', 'pixels')),

    /** Point radius scale */
    pointRadiusScale: Schema.optional(Schema.Number),

    /** Point radius min pixels */
    pointRadiusMinPixels: Schema.optional(Schema.Number),

    /** Point radius max pixels */
    pointRadiusMaxPixels: Schema.optional(Schema.Number),

    /** Elevation scale */
    elevationScale: Schema.optional(Schema.Number),
  }
) {}

// =============================================================================
// Layer Union
// =============================================================================

/**
 * Union of all supported layer configurations
 */
export const LayerConfig = Schema.Union(
  ScatterplotLayerConfig,
  IconLayerConfig,
  PathLayerConfig,
  PolygonLayerConfig,
  HexagonLayerConfig,
  GeoJsonLayerConfig
);
export type LayerConfig = typeof LayerConfig.Type;

/**
 * Array of layer configurations
 */
export const LayerConfigs = Schema.Array(LayerConfig);
export type LayerConfigs = typeof LayerConfigs.Type;

// =============================================================================
// Extended RenderSpec Options
// =============================================================================

/**
 * Map block specific options
 */
export const MapRenderOptions = Schema.Struct({
  /** Initial view state */
  viewState: Schema.optional(
    Schema.Struct({
      longitude: Schema.Number,
      latitude: Schema.Number,
      zoom: Schema.Number,
      pitch: Schema.optional(Schema.Number),
      bearing: Schema.optional(Schema.Number),
    })
  ),

  /** Map style URL */
  mapStyle: Schema.optional(Schema.String),

  /** Layer configurations */
  layers: Schema.optional(LayerConfigs),

  /** Controller options */
  controller: Schema.optional(
    Schema.Struct({
      scrollZoom: Schema.optional(Schema.Boolean),
      dragPan: Schema.optional(Schema.Boolean),
      dragRotate: Schema.optional(Schema.Boolean),
      doubleClickZoom: Schema.optional(Schema.Boolean),
      touchZoom: Schema.optional(Schema.Boolean),
      touchRotate: Schema.optional(Schema.Boolean),
      keyboard: Schema.optional(Schema.Boolean),
    })
  ),
});
export type MapRenderOptions = typeof MapRenderOptions.Type;

/**
 * 3D scene block specific options
 */
export const Scene3DRenderOptions = Schema.Struct({
  /** Camera configuration */
  camera: Schema.optional(
    Schema.Struct({
      position: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
      fov: Schema.optional(Schema.Number),
      near: Schema.optional(Schema.Number),
      far: Schema.optional(Schema.Number),
    })
  ),

  /** Background color */
  background: Schema.optional(Schema.String),

  /** Show grid */
  showGrid: Schema.optional(Schema.Boolean),

  /** Show axes helper */
  showAxes: Schema.optional(Schema.Boolean),

  /** Ambient light intensity */
  ambientLightIntensity: Schema.optional(Schema.Number),

  /** Entity rendering defaults */
  entityDefaults: Schema.optional(
    Schema.Struct({
      metalness: Schema.optional(Schema.Number),
      roughness: Schema.optional(Schema.Number),
      emissiveIntensity: Schema.optional(Schema.Number),
    })
  ),
});
export type Scene3DRenderOptions = typeof Scene3DRenderOptions.Type;

/**
 * Data grid block specific options
 */
export const DataGridRenderOptions = Schema.Struct({
  /** Column definitions */
  columnDefs: Schema.optional(Schema.Array(Schema.Unknown)),

  /** Default column definition */
  defaultColDef: Schema.optional(Schema.Unknown),

  /** Row selection mode */
  rowSelection: Schema.optional(Schema.Literal('single', 'multiple')),

  /** Enable pagination */
  pagination: Schema.optional(Schema.Boolean),

  /** Page size */
  paginationPageSize: Schema.optional(Schema.Number),

  /** Theme */
  theme: Schema.optional(Schema.String),
});
export type DataGridRenderOptions = typeof DataGridRenderOptions.Type;

/**
 * Chart block specific options
 */
export const ChartRenderOptions = Schema.Struct({
  /** Chart type */
  chartType: Schema.optional(
    Schema.Literal('line', 'bar', 'area', 'scatter', 'pie', 'donut', 'radar')
  ),

  /** X axis field */
  xField: Schema.optional(Schema.String),

  /** Y axis field(s) */
  yField: Schema.optional(Schema.Union(Schema.String, Schema.Array(Schema.String))),

  /** Color field */
  colorField: Schema.optional(Schema.String),

  /** Size field */
  sizeField: Schema.optional(Schema.String),

  /** Show legend */
  showLegend: Schema.optional(Schema.Boolean),

  /** Show tooltip */
  showTooltip: Schema.optional(Schema.Boolean),

  /** Animate transitions */
  animate: Schema.optional(Schema.Boolean),
});
export type ChartRenderOptions = typeof ChartRenderOptions.Type;
