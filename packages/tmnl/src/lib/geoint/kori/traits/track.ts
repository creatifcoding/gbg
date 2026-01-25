/**
 * GEOINT Track Traits
 *
 * Trait definitions for internal track entities.
 *
 * @module
 */

import { Schema } from 'effect'
import { defineTrait, registerTrait, type TraitId } from '../../../kori/schemas/trait'
import { TrackId, Classification, ObjectType } from '../../schemas/core'

// ─────────────────────────────────────────────────────────────────────────────
// Track Data Trait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * TrackData trait - core track data.
 *
 * Combined with GeoPosition3D, GeoVelocity for full state.
 */
export const TrackData = defineTrait('TrackData', {
  /** Unique track identifier */
  trackId: TrackId,
  /** Track classification */
  classification: Classification,
  /** Object type */
  objectType: ObjectType,
  /** Track label/name */
  label: Schema.optionalWith(Schema.String, { default: () => '' }),
  /** Confidence score (0-1) */
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
  /** Whether track is active */
  active: Schema.optionalWith(Schema.Boolean, { default: () => true }),
})
export type TrackData = typeof TrackData.Type

/**
 * TrackHistory trait - track history reference.
 */
export const TrackHistory = defineTrait('TrackHistory', {
  /** Number of historical positions */
  historyCount: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  /** First seen timestamp */
  firstSeen: Schema.DateFromSelf,
  /** Last updated timestamp */
  lastUpdated: Schema.DateFromSelf,
})
export type TrackHistory = typeof TrackHistory.Type

/**
 * TrackSource trait - track source attribution.
 */
export const TrackSource = defineTrait('TrackSource', {
  /** Primary sensor/source ID */
  primarySource: Schema.String,
  /** Contributing sources */
  contributingSources: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  /** Fusion type */
  fusionType: Schema.optional(Schema.Literal('single', 'fused', 'correlated')),
})
export type TrackSource = typeof TrackSource.Type

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

registerTrait('TrackData' as TraitId, TrackData, {
  uniqueness: {
    unique: true,
    uniqueKey: (data) => (data as { trackId: string }).trackId,
  },
})
registerTrait('TrackHistory' as TraitId, TrackHistory)
registerTrait('TrackSource' as TraitId, TrackSource)
