/**
 * GEOINT Card Traits
 *
 * Trait definitions that can be composed onto entities.
 * Each trait contributes:
 * - Data schema (what values it holds)
 * - Renderer contribution (what UI it adds)
 * - Actions it enables (what can be done with it)
 *
 * @module geoint/cards/traits
 */

import { Schema } from 'effect'

// =============================================================================
// TRAIT TYPE ID
// =============================================================================

/** Branded trait identifier */
export const TraitId = Schema.String.pipe(Schema.brand('TraitId'))
export type TraitId = typeof TraitId.Type

// =============================================================================
// CORE TRAIT DEFINITIONS
// =============================================================================

/**
 * Positionable trait - entity has a geographic location.
 * Contributes: mini-map preview, goto action, distance calculations
 */
export const PositionableTrait = Schema.Struct({
  _trait: Schema.Literal('Positionable'),
  position: Schema.Tuple(Schema.Number, Schema.Number), // [lon, lat]
  altitude: Schema.optional(Schema.Number),
})
export type PositionableTrait = typeof PositionableTrait.Type

/**
 * Temporal trait - entity has time-based data.
 * Contributes: timeline view, temporal filter, history action
 */
export const TemporalTrait = Schema.Struct({
  _trait: Schema.Literal('Temporal'),
  timestamp: Schema.Number, // Unix ms
  validFrom: Schema.optional(Schema.Number),
  validTo: Schema.optional(Schema.Number),
})
export type TemporalTrait = typeof TemporalTrait.Type

/**
 * Classifiable trait - entity can be friend/foe classified.
 * Contributes: classification badge, reclassify action
 */
export const ClassifiableTrait = Schema.Struct({
  _trait: Schema.Literal('Classifiable'),
  classification: Schema.Literal('friendly', 'hostile', 'neutral', 'unknown'),
  confidence: Schema.optional(Schema.Number), // 0-1
})
export type ClassifiableTrait = typeof ClassifiableTrait.Type

/**
 * Identifiable trait - entity has unique identifiers.
 * Contributes: ID badge, copy ID action, lookup action
 */
export const IdentifiableTrait = Schema.Struct({
  _trait: Schema.Literal('Identifiable'),
  primaryId: Schema.String,
  secondaryIds: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.String })),
})
export type IdentifiableTrait = typeof IdentifiableTrait.Type

/**
 * Nameable trait - entity has human-readable name.
 * Contributes: title display, rename action (if editable)
 */
export const NameableTrait = Schema.Struct({
  _trait: Schema.Literal('Nameable'),
  name: Schema.String,
  displayName: Schema.optional(Schema.String),
})
export type NameableTrait = typeof NameableTrait.Type

/**
 * Trackable trait - entity can be followed over time.
 * Contributes: follow action, track history, trajectory display
 */
export const TrackableTrait = Schema.Struct({
  _trait: Schema.Literal('Trackable'),
  heading: Schema.optional(Schema.Number), // degrees
  speed: Schema.optional(Schema.Number), // m/s
  course: Schema.optional(Schema.Number), // degrees
})
export type TrackableTrait = typeof TrackableTrait.Type

/**
 * Categorizable trait - entity belongs to a category.
 * Contributes: category badge, filter by category action
 */
export const CategorizableTrait = Schema.Struct({
  _trait: Schema.Literal('Categorizable'),
  category: Schema.String,
  subcategory: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
})
export type CategorizableTrait = typeof CategorizableTrait.Type

/**
 * Sourceable trait - entity came from a data source.
 * Contributes: source badge, source-specific styling
 */
export const SourceableTrait = Schema.Struct({
  _trait: Schema.Literal('Sourceable'),
  source: Schema.Literal(
    'track',
    'osm',
    'opensky',
    'adsb_lol',
    'planet',
    'sentinel',
    'weather',
    'feature',
    'custom'
  ),
  sourceId: Schema.optional(Schema.String),
})
export type SourceableTrait = typeof SourceableTrait.Type

/**
 * Imageable trait - entity has associated imagery.
 * Contributes: image preview, full-screen view action
 */
export const ImageableTrait = Schema.Struct({
  _trait: Schema.Literal('Imageable'),
  thumbnailUrl: Schema.optional(Schema.String),
  fullImageUrl: Schema.optional(Schema.String),
  imageMetadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
export type ImageableTrait = typeof ImageableTrait.Type

// =============================================================================
// TRAIT UNION
// =============================================================================

/**
 * Union of all known traits.
 */
export const AnyTrait = Schema.Union(
  PositionableTrait,
  TemporalTrait,
  ClassifiableTrait,
  IdentifiableTrait,
  NameableTrait,
  TrackableTrait,
  CategorizableTrait,
  SourceableTrait,
  ImageableTrait
)
export type AnyTrait = typeof AnyTrait.Type

/**
 * Trait name literals for type-safe trait checking.
 */
export type TraitName = AnyTrait['_trait']

// =============================================================================
// TRAIT COMPOSITION TYPES
// =============================================================================

/**
 * An entity with its composed traits.
 */
export interface ComposedEntity {
  readonly entityId: string
  readonly traits: ReadonlyMap<TraitName, AnyTrait>
}

/**
 * Check if entity has a specific trait.
 */
export const hasTrait = <T extends TraitName>(
  entity: ComposedEntity,
  trait: T
): boolean => {
  return entity.traits.has(trait)
}

/**
 * Get a trait from an entity, type-safe.
 */
export const getTrait = <T extends TraitName>(
  entity: ComposedEntity,
  trait: T
): Extract<AnyTrait, { _trait: T }> | undefined => {
  return entity.traits.get(trait) as Extract<AnyTrait, { _trait: T }> | undefined
}
