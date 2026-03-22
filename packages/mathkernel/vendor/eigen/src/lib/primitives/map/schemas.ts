/**
 * Map Schemas - Effect Schema definitions for AI-streamable configs
 *
 * These schemas enable:
 * - `generateObject` for AI-generated map configurations
 * - Runtime validation of streamed data
 * - Type inference for TypeScript
 * - Integration with AI SDK patterns (createAgentUIStream, toolLoopAgent)
 *
 * @module primitives/map/schemas
 */

import { Schema } from 'effect'

// =============================================================================
// Core Data Schemas
// =============================================================================

/**
 * Geographic position as [longitude, latitude] or [longitude, latitude, altitude]
 */
export const PositionSchema = Schema.Union(
  Schema.Tuple(Schema.Number, Schema.Number),
  Schema.Tuple(Schema.Number, Schema.Number, Schema.Number)
)

/**
 * RGB color tuple
 */
export const RGBColorSchema = Schema.Tuple(
  Schema.Number.pipe(Schema.int(), Schema.between(0, 255)),
  Schema.Number.pipe(Schema.int(), Schema.between(0, 255)),
  Schema.Number.pipe(Schema.int(), Schema.between(0, 255))
)

/**
 * Map marker configuration
 */
export const MapMarkerSchema = Schema.Struct({
  id: Schema.optional(Schema.String),
  position: PositionSchema,
  label: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  color: Schema.optional(RGBColorSchema),
  icon: Schema.optional(Schema.String),
  size: Schema.optional(Schema.Number.pipe(Schema.positive())),
  popup: Schema.optional(Schema.String),
})

/**
 * Map layer types
 */
export const MapLayerTypeSchema = Schema.Literal(
  'scatterplot',
  'path',
  'polygon',
  'geojson',
  'icon',
  'text',
  'heatmap'
)

/**
 * Map layer configuration
 */
export const MapLayerSchema = Schema.Struct({
  id: Schema.String,
  type: MapLayerTypeSchema,
  data: Schema.Unknown, // GeoJSON or array
  visible: Schema.optional(Schema.Boolean),
  opacity: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  color: Schema.optional(Schema.Union(RGBColorSchema, Schema.String)),
  radius: Schema.optional(Schema.Number.pipe(Schema.positive())),
  lineWidth: Schema.optional(Schema.Number.pipe(Schema.positive())),
  filled: Schema.optional(Schema.Boolean),
  stroked: Schema.optional(Schema.Boolean),
})

/**
 * Geographic bounds
 */
export const MapBoundsSchema = Schema.Struct({
  north: Schema.Number.pipe(Schema.between(-90, 90)),
  south: Schema.Number.pipe(Schema.between(-90, 90)),
  east: Schema.Number.pipe(Schema.between(-180, 180)),
  west: Schema.Number.pipe(Schema.between(-180, 180)),
})

// =============================================================================
// View State Schema
// =============================================================================

/**
 * Map view state (camera position)
 */
export const ViewStateSchema = Schema.Struct({
  longitude: Schema.Number.pipe(Schema.between(-180, 180)),
  latitude: Schema.Number.pipe(Schema.between(-90, 90)),
  zoom: Schema.Number.pipe(Schema.between(0, 22)),
  pitch: Schema.optional(Schema.Number.pipe(Schema.between(0, 85))),
  bearing: Schema.optional(Schema.Number.pipe(Schema.between(-180, 180))),
  minZoom: Schema.optional(Schema.Number.pipe(Schema.between(0, 22))),
  maxZoom: Schema.optional(Schema.Number.pipe(Schema.between(0, 22))),
  minPitch: Schema.optional(Schema.Number.pipe(Schema.between(0, 85))),
  maxPitch: Schema.optional(Schema.Number.pipe(Schema.between(0, 85))),
})

// =============================================================================
// Style Configuration Schema
// =============================================================================

/**
 * Map style configuration
 */
export const MapStyleConfigSchema = Schema.Struct({
  id: Schema.String,
  label: Schema.String,
  url: Schema.String, // mapbox://styles/...
})

// =============================================================================
// Complete Map Configuration Schema (AI-streamable)
// =============================================================================

/**
 * Complete map configuration for AI streaming
 *
 * Use with `generateObject`:
 * ```typescript
 * const result = await generateObject({
 *   model: 'claude-3-sonnet',
 *   schema: MapConfigSchema,
 *   prompt: 'Create a map showing coffee shops in San Francisco'
 * })
 * ```
 */
export const MapConfigSchema = Schema.Struct({
  /** Initial/current view state */
  viewState: ViewStateSchema,

  /** Markers to display */
  markers: Schema.optional(Schema.Array(MapMarkerSchema)),

  /** Layers to render */
  layers: Schema.optional(Schema.Array(MapLayerSchema)),

  /** Map style URL or ID */
  style: Schema.optional(Schema.String),

  /** Whether map is interactive */
  interactive: Schema.optional(Schema.Boolean),

  /** Title for the map */
  title: Schema.optional(Schema.String),

  /** Description/caption */
  description: Schema.optional(Schema.String),
})

// =============================================================================
// Partial Schemas for Streaming Updates
// =============================================================================

/**
 * Partial marker update (for streaming)
 */
export const PartialMarkerUpdateSchema = Schema.Struct({
  id: Schema.String,
  position: Schema.optional(PositionSchema),
  label: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  color: Schema.optional(RGBColorSchema),
  size: Schema.optional(Schema.Number),
})

/**
 * Partial view state update (for streaming)
 */
export const PartialViewStateUpdateSchema = Schema.Struct({
  longitude: Schema.optional(Schema.Number),
  latitude: Schema.optional(Schema.Number),
  zoom: Schema.optional(Schema.Number),
  pitch: Schema.optional(Schema.Number),
  bearing: Schema.optional(Schema.Number),
})

/**
 * Map update command (for streaming updates)
 */
export const MapUpdateCommandSchema = Schema.Union(
  Schema.Struct({
    _tag: Schema.Literal('SetViewState'),
    viewState: PartialViewStateUpdateSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('AddMarker'),
    marker: MapMarkerSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('UpdateMarker'),
    update: PartialMarkerUpdateSchema,
  }),
  Schema.Struct({
    _tag: Schema.Literal('RemoveMarker'),
    id: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('SetMarkers'),
    markers: Schema.Array(MapMarkerSchema),
  }),
  Schema.Struct({
    _tag: Schema.Literal('SetStyle'),
    style: Schema.String,
  }),
  Schema.Struct({
    _tag: Schema.Literal('FitBounds'),
    bounds: MapBoundsSchema,
    padding: Schema.optional(Schema.Number),
  })
)

// =============================================================================
// Type Exports (inferred from schemas)
// =============================================================================

export type Position = Schema.Schema.Type<typeof PositionSchema>
export type RGBColor = Schema.Schema.Type<typeof RGBColorSchema>
export type MapMarkerConfig = Schema.Schema.Type<typeof MapMarkerSchema>
export type MapLayerType = Schema.Schema.Type<typeof MapLayerTypeSchema>
export type MapLayerConfig = Schema.Schema.Type<typeof MapLayerSchema>
export type MapBoundsConfig = Schema.Schema.Type<typeof MapBoundsSchema>
export type ViewState = Schema.Schema.Type<typeof ViewStateSchema>
export type MapStyleConfig = Schema.Schema.Type<typeof MapStyleConfigSchema>
export type MapConfig = Schema.Schema.Type<typeof MapConfigSchema>
export type MapUpdateCommand = Schema.Schema.Type<typeof MapUpdateCommandSchema>
