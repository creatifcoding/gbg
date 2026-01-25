/**
 * POI Position Event Schema
 *
 * Event published to DurableStreams when POI data is ingested.
 * Used by OsmEntityMaterializer to reactively update ECS entities.
 *
 * @module geoint/schemas/poi-events
 */

import { Schema } from 'effect'
import { PoiCategory } from './search'

// =============================================================================
// POI Source
// =============================================================================

/**
 * POI data source discriminator.
 */
export const PoiSource = Schema.Literal('overpass', 'nominatim', 'custom').pipe(
  Schema.annotations({
    identifier: 'PoiSource',
    title: 'POI Source',
    description: 'Source of POI data.',
  })
)
export type PoiSource = typeof PoiSource.Type

// =============================================================================
// OSM Type
// =============================================================================

/**
 * OpenStreetMap element type.
 */
export const OsmElementType = Schema.Literal('node', 'way', 'relation').pipe(
  Schema.annotations({
    identifier: 'OsmElementType',
    title: 'OSM Element Type',
    description: 'Type of OpenStreetMap element.',
  })
)
export type OsmElementType = typeof OsmElementType.Type

// =============================================================================
// POI Position Event
// =============================================================================

/**
 * POI position event - published to DurableStream after ingestion.
 *
 * This is the event schema for the poi-positions stream.
 * Contains all data needed to materialize ECS POI entities.
 */
export class PoiPositionEvent extends Schema.TaggedClass<PoiPositionEvent>()(
  'PoiPositionEvent',
  {
    /** OSM ID (unique within type). */
    osmId: Schema.BigIntFromSelf.pipe(
      Schema.annotations({
        title: 'OSM ID',
        description: 'OpenStreetMap element ID.',
      })
    ),

    /** OSM element type (node, way, relation). */
    osmType: OsmElementType,

    /** Data source. */
    source: PoiSource,

    /** Position as [longitude, latitude]. */
    position: Schema.Tuple(Schema.Number, Schema.Number).pipe(
      Schema.annotations({
        title: 'Position',
        description: 'WGS84 position [lon, lat].',
      })
    ),

    /** POI name. */
    name: Schema.optional(Schema.String.pipe(Schema.maxLength(256))),

    /** POI category (restaurant, hospital, etc.). */
    category: Schema.optional(PoiCategory),

    /** OSM tags (key-value pairs). */
    tags: Schema.optional(
      Schema.Record({ key: Schema.String, value: Schema.String })
    ),

    /** Query bounding box [minLon, minLat, maxLon, maxLat]. */
    queryBbox: Schema.optional(
      Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number)
    ),

    /** Ingestion timestamp. */
    ingestedAt: Schema.DateFromSelf,
  }
) {}

export type PoiPositionEventEncoded = typeof PoiPositionEvent.Encoded
