/**
 * GEOINT POI (Point of Interest) Traits
 *
 * Trait definitions for OSM/Overpass POI entities.
 *
 * @module
 */

import { Schema } from 'effect'
import { defineTrait, registerTrait, type TraitId } from '../../../kori/schemas/trait'
import { PoiId, PoiCategory } from '../../schemas/search'

// ─────────────────────────────────────────────────────────────────────────────
// POI Data Trait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * PoiData trait - core POI data from OSM.
 *
 * Combined with GeoPosition for full state.
 */
export const PoiData = defineTrait('PoiData', {
  /** Unique POI identifier */
  poiId: PoiId,
  /** Display name */
  name: Schema.String,
  /** Primary category */
  category: PoiCategory,
  /** OSM element type */
  osmType: Schema.Literal('node', 'way', 'relation'),
  /** OSM element ID */
  osmId: Schema.Number,
})
export type PoiData = typeof PoiData.Type

/**
 * PoiTags trait - raw OSM tags.
 */
export const PoiTags = defineTrait('PoiTags', {
  /** Raw OSM key-value tags */
  tags: Schema.Record({ key: Schema.String, value: Schema.String }),
})
export type PoiTags = typeof PoiTags.Type

/**
 * PoiContact trait - contact information.
 */
export const PoiContact = defineTrait('PoiContact', {
  /** Phone number */
  phone: Schema.optional(Schema.String),
  /** Website URL */
  website: Schema.optional(Schema.String),
  /** Email address */
  email: Schema.optional(Schema.String),
  /** Opening hours */
  openingHours: Schema.optional(Schema.String),
})
export type PoiContact = typeof PoiContact.Type

/**
 * PoiAddress trait - address information.
 */
export const PoiAddress = defineTrait('PoiAddress', {
  /** Street address */
  street: Schema.optional(Schema.String),
  /** House number */
  houseNumber: Schema.optional(Schema.String),
  /** City */
  city: Schema.optional(Schema.String),
  /** Postal code */
  postcode: Schema.optional(Schema.String),
  /** Country */
  country: Schema.optional(Schema.String),
})
export type PoiAddress = typeof PoiAddress.Type

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

registerTrait('PoiData' as TraitId, PoiData, {
  uniqueness: {
    unique: true,
    uniqueKey: (data) => (data as { poiId: string }).poiId,
  },
})
registerTrait('PoiTags' as TraitId, PoiTags)
registerTrait('PoiContact' as TraitId, PoiContact)
registerTrait('PoiAddress' as TraitId, PoiAddress)
