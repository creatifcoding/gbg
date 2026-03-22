/**
 * GEOINT Domain-Specific Trait Schemas
 *
 * These are domain-specific trait schemas for GEOINT entities.
 * ECS provides only coordination primitives (EntityId, Provenance).
 * Domain modules define their own trait schemas.
 *
 * @module geoint/schemas/traits
 */

import { Schema } from 'effect'
import { Position3D, BBox, Position2D } from '@/lib/ecs'

// =============================================================================
// Spatial Trait (GEOINT domain)
// =============================================================================

/**
 * Spatial trait - entity has a geographic position.
 * For GEOINT entities like flights, POIs, tracks.
 */
export class SpatialTrait extends Schema.Class<SpatialTrait>('SpatialTrait')({
  /** 3D position [lon, lat, alt] in WGS84. Altitude in meters. */
  position: Position3D,
  /** Optional bounding box for area features. */
  bounds: Schema.optional(BBox),
}) {}

/**
 * Spatial trait for 2D-only entities (POIs without altitude).
 */
export class Spatial2DTrait extends Schema.Class<Spatial2DTrait>('Spatial2DTrait')({
  /** 2D position [lon, lat] in WGS84. */
  position: Position2D,
  /** Optional bounding box for area features. */
  bounds: Schema.optional(BBox),
}) {}

// =============================================================================
// Temporal Trait (GEOINT domain)
// =============================================================================

/**
 * Temporal trait - entity has time validity and observation.
 * For time-bounded observations like flights, weather.
 */
export class TemporalTrait extends Schema.Class<TemporalTrait>('TemporalTrait')({
  /** When this data becomes valid. */
  validFrom: Schema.Date,
  /** When this data expires (null = indefinite). */
  validTo: Schema.NullOr(Schema.Date),
  /** When this observation was recorded. */
  observedAt: Schema.Date,
}) {}

// =============================================================================
// Kinetic Trait (GEOINT domain)
// =============================================================================

/**
 * Heading in degrees (0-360).
 */
export const Heading = Schema.Number.pipe(
  Schema.between(0, 360),
  Schema.annotations({
    identifier: 'Heading',
    description: 'True heading in degrees (0-360). 0=North, 90=East.',
  })
)
export type Heading = typeof Heading.Type

/**
 * Speed in meters per second.
 */
export const SpeedMps = Schema.Number.pipe(
  Schema.nonNegative(),
  Schema.annotations({
    identifier: 'SpeedMps',
    description: 'Speed in meters per second.',
  })
)
export type SpeedMps = typeof SpeedMps.Type

/**
 * Kinetic trait - entity has motion (heading, speed, vertical rate).
 * For moving entities like flights, vessels, vehicles.
 */
export class KineticTrait extends Schema.Class<KineticTrait>('KineticTrait')({
  /** True heading in degrees (0-360). */
  heading: Heading,
  /** Ground speed in m/s. */
  speed: SpeedMps,
  /** Vertical rate in m/s (positive = ascending). */
  verticalRate: Schema.Number,
}) {}

// =============================================================================
// Identifiable Trait (GEOINT domain)
// =============================================================================

/**
 * External IDs map (source → id).
 */
export const ExternalIds = Schema.Record({
  key: Schema.String,
  value: Schema.String,
}).pipe(
  Schema.annotations({
    identifier: 'ExternalIds',
    description: 'Map of external identifiers by source. E.g., { "icao24": "a1b2c3", "registration": "N12345" }',
  })
)
export type ExternalIds = typeof ExternalIds.Type

/**
 * Identifiable trait - entity has external IDs and human-readable names.
 * For entities with callsigns, registrations, OSM IDs, etc.
 */
export class IdentifiableTrait extends Schema.Class<IdentifiableTrait>('IdentifiableTrait')({
  /** External identifiers by source. */
  externalIds: Schema.optionalWith(ExternalIds, { default: () => ({}) }),
  /** Callsign (for flights, vessels). */
  callsign: Schema.optional(Schema.String),
  /** Human-readable name. */
  name: Schema.optional(Schema.String),
}) {}

// =============================================================================
// Classified Trait (GEOINT domain)
// =============================================================================

import { Classification, ObjectType } from '@/lib/ecs'

/**
 * Classified trait - entity has IFF classification.
 * For tactical entities requiring friend/foe identification.
 */
export class ClassifiedTrait extends Schema.Class<ClassifiedTrait>('ClassifiedTrait')({
  /** Friend/Foe classification. */
  classification: Schema.optionalWith(Classification, { default: () => 'unknown' as const }),
  /** Object type category. */
  objectType: ObjectType,
  /** Allegiance (country, org, etc.). */
  allegiance: Schema.optional(Schema.String),
}) {}
