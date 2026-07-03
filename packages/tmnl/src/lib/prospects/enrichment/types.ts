/**
 * Enrichment Pipeline — Shared Types
 *
 * Data quality snapshots, enrichment results, and pipeline metrics.
 * Every enrichment service returns before/after quality snapshots.
 *
 * @module prospects/enrichment/types
 */

import { Schema } from 'effect'

// =============================================================================
// Data Quality Snapshot — measured before and after each enrichment pass
// =============================================================================

export class QualitySnapshot extends Schema.Class<QualitySnapshot>('QualitySnapshot')({
  /** Total entities measured */
  total: Schema.Number,
  /** Count of entities with this field filled (non-null) */
  filled: Schema.Number,
  /** Percentage filled (0–100) */
  coverage: Schema.Number,
  /** Average confidence across filled fields (0–1) */
  avgConfidence: Schema.Number,
  /** Timestamp of measurement */
  measuredAt: Schema.String,
}) {
  static fromCounts(total: number, filled: number, avgConfidence: number) {
    return new QualitySnapshot({
      total,
      filled,
      coverage: total > 0 ? Math.round((filled / total) * 1000) / 10 : 0,
      avgConfidence: Math.round(avgConfidence * 1000) / 1000,
      measuredAt: new Date().toISOString(),
    })
  }
}

// =============================================================================
// Enrichment Result — returned by every enrichment service
// =============================================================================

export class EnrichmentResult extends Schema.Class<EnrichmentResult>('EnrichmentResult')({
  /** Which track produced this result */
  track: Schema.String,
  /** Quality before enrichment */
  before: QualitySnapshot,
  /** Quality after enrichment */
  after: QualitySnapshot,
  /** How many entities were evaluated */
  evaluated: Schema.Number,
  /** How many entities were actually modified */
  modified: Schema.Number,
  /** How many were skipped (no change needed or no data) */
  skipped: Schema.Number,
  /** How many errors occurred (non-fatal) */
  errors: Schema.Number,
  /** Wall-clock duration in milliseconds */
  durationMs: Schema.Number,
  /** Detailed breakdown by category (e.g., by industry for reclassification) */
  breakdown: Schema.Array(Schema.Struct({
    category: Schema.String,
    count: Schema.Number,
  })),
}) {}

// =============================================================================
// Pipeline Result — returned by master enrichment orchestrator
// =============================================================================

export class PipelineResult extends Schema.Class<PipelineResult>('PipelineResult')({
  /** Results from each track in execution order */
  tracks: Schema.Array(EnrichmentResult),
  /** Total wall-clock duration */
  totalDurationMs: Schema.Number,
  /** Total entities modified across all tracks */
  totalModified: Schema.Number,
  /** Overall quality snapshot after all tracks */
  finalQuality: Schema.Struct({
    industryCoverage: Schema.Number,
    websiteCoverage: Schema.Number,
    headcountCoverage: Schema.Number,
    signalQuality: Schema.Number,
    dmCoverage: Schema.Number,
  }),
}) {}
