/**
 * Feature Entity - Static geospatial features
 *
 * Represents static map features (point / lines / polygons) returned from
 * feature services and vector layers.
 *
 * @module geoint/entities/feature
 */

import { Schema } from 'effect'
import { EntityId, EntityProvenance } from '@/lib/ecs'
import { FeatureId } from '../schemas/core'
import { SpatialTrait, TemporalTrait, IdentifiableTrait } from '../schemas/traits'

/**
 * Feature entity - static geospatial feature.
 */
export class FeatureEntity extends Schema.TaggedClass<FeatureEntity>()(
  'FeatureEntity',
  {
    // Base entity fields
    id: EntityId,
    entityType: Schema.Literal('feature'),
    provenance: EntityProvenance,
    metadata: Schema.optionalWith(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      { default: () => ({}) }
    ),

    // Embedded traits
    spatial: SpatialTrait,
    temporal: Schema.optional(TemporalTrait),
    identifiable: Schema.optional(IdentifiableTrait),

    // Feature-specific fields
    featureId: FeatureId,
    geometryType: Schema.Literal('Point', 'LineString', 'Polygon'),
    properties: Schema.optionalWith(
      Schema.Record({ key: Schema.String, value: Schema.Unknown }),
      { default: () => ({}) }
    ),
    sourceLayer: Schema.optional(Schema.String),
    label: Schema.optional(Schema.String),
  },
  {
    identifier: 'FeatureEntity',
    title: 'Feature Entity',
    description: 'Static geospatial map feature with geometry + property payload.',
  }
) {
  get displayLabel(): string {
    return this.label
      ?? this.identifiable?.name
      ?? this.identifiable?.callsign
      ?? this.featureId
  }

  isAreaFeature(): boolean {
    return this.geometryType === 'Polygon'
  }

  hasProperties(): boolean {
    return Object.keys(this.properties).length > 0
  }

  toSummary(): string {
    return `${this.displayLabel} · ${this.geometryType}`
  }
}
