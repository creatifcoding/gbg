/**
 * POI Entity - Points of Interest
 *
 * Represents points of interest from OSM, manual entry, etc.
 * Composes: Spatial, Temporal (optional), Identifiable traits
 *
 * @module geoint/entities/poi
 */

import { Schema } from 'effect'
import { EntityId, EntityProvenance } from '@/lib/ecs'
import { SpatialTrait, TemporalTrait, IdentifiableTrait } from '../schemas/traits'

// =============================================================================
// POI-Specific Schemas
// =============================================================================

/**
 * POI category types.
 */
export const PoiCategory = Schema.Literal(
  'amenity',
  'shop',
  'leisure',
  'tourism',
  'building',
  'natural',
  'highway',
  'railway',
  'aeroway',
  'military',
  'landuse',
  'other'
).pipe(
  Schema.annotations({
    identifier: 'PoiCategory',
    title: 'POI Category',
    description: 'OpenStreetMap POI category.',
  })
)
export type PoiCategory = typeof PoiCategory.Type

/**
 * OSM element types.
 */
export const OsmElementType = Schema.Literal('node', 'way', 'relation').pipe(
  Schema.annotations({
    identifier: 'OsmElementType',
    title: 'OSM Element Type',
    description: 'OpenStreetMap element type.',
  })
)
export type OsmElementType = typeof OsmElementType.Type

/**
 * OSM tags record.
 */
export const OsmTags = Schema.Record({
  key: Schema.String,
  value: Schema.String,
}).pipe(
  Schema.annotations({
    identifier: 'OsmTags',
    title: 'OSM Tags',
    description: 'OpenStreetMap key-value tags.',
  })
)
export type OsmTags = typeof OsmTags.Type

// =============================================================================
// POI Entity
// =============================================================================

/**
 * POI entity - point of interest from OSM, manual entry, etc.
 */
export class PoiEntity extends Schema.TaggedClass<PoiEntity>()(
  'PoiEntity',
  {
    // Base entity fields
    id: EntityId,
    entityType: Schema.Literal('poi'),
    provenance: EntityProvenance,
    metadata: Schema.optionalWith(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      { default: () => ({}) }
    ),

    // Embedded traits
    spatial: SpatialTrait,
    temporal: Schema.optional(TemporalTrait),
    identifiable: IdentifiableTrait,

    // POI-specific fields
    /** POI category (amenity, shop, leisure, etc.). */
    category: PoiCategory,
    /** OSM element type (node, way, relation). */
    osmType: Schema.optional(OsmElementType),
    /** OSM tags as key-value pairs. */
    tags: Schema.optionalWith(OsmTags, { default: () => ({}) }),
    /** Opening hours (OSM format). */
    openingHours: Schema.optional(Schema.String),
    /** Website URL. */
    website: Schema.optional(Schema.String),
    /** Phone number. */
    phone: Schema.optional(Schema.String),
  },
  {
    identifier: 'PoiEntity',
    title: 'POI Entity',
    description: 'Point of interest from OSM or manual entry. Includes spatial and identifiable traits.',
  }
) {}
