/**
 * GEOINT Source Confidence Traits
 *
 * Traits for multi-INT fusion and source attribution.
 *
 * @module
 */

import { Schema } from 'effect'
import { defineTrait, registerTrait, type TraitId } from '../../../kori/schemas/trait'
import { IntelSource } from '../../schemas/search'

// ─────────────────────────────────────────────────────────────────────────────
// Source Confidence Trait
// ─────────────────────────────────────────────────────────────────────────────

/**
 * SourceConfidence trait - data quality and provenance.
 *
 * Tracks where data came from and how confident we are in it.
 */
export const SourceConfidence = defineTrait('SourceConfidence', {
  /** Primary data source */
  primarySource: IntelSource,
  /** Contributing sources for fused data */
  contributingSources: Schema.optionalWith(Schema.Array(IntelSource), { default: () => [] }),
  /** Overall confidence score (0-1) */
  confidence: Schema.Number.pipe(Schema.between(0, 1)),
  /** Data freshness (time since last update in ms) */
  staleness: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  /** Whether data is corroborated by multiple sources */
  corroborated: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})
export type SourceConfidence = typeof SourceConfidence.Type

/**
 * SourceTiming trait - temporal quality metrics.
 */
export const SourceTiming = defineTrait('SourceTiming', {
  /** When data was retrieved from source */
  retrievedAt: Schema.DateFromSelf,
  /** Source's reported timestamp */
  sourceTimestamp: Schema.optional(Schema.DateFromSelf),
  /** Latency in ms between source and retrieval */
  latencyMs: Schema.optional(Schema.Number),
  /** Time to live before data is stale (ms) */
  ttlMs: Schema.optionalWith(Schema.Number, { default: () => 60000 }),
})
export type SourceTiming = typeof SourceTiming.Type

/**
 * SourceQuality trait - data quality indicators.
 */
export const SourceQuality = defineTrait('SourceQuality', {
  /** Positional accuracy in meters */
  positionAccuracyM: Schema.optional(Schema.Number),
  /** Altitude accuracy in meters */
  altitudeAccuracyM: Schema.optional(Schema.Number),
  /** Completeness score (0-1, how many fields populated) */
  completeness: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  /** Quality flags/warnings */
  qualityFlags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
})
export type SourceQuality = typeof SourceQuality.Type

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

registerTrait('SourceConfidence' as TraitId, SourceConfidence)
registerTrait('SourceTiming' as TraitId, SourceTiming)
registerTrait('SourceQuality' as TraitId, SourceQuality)
