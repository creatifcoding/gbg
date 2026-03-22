/**
 * ECS Provenance Schemas - Data Lineage & Audit
 *
 * Tracks where data came from, when, and with what confidence.
 * Enables multi-source fusion with full audit trail.
 *
 * @module ecs/schemas/provenance
 */

import { Schema } from 'effect'
import { IntelSource, Confidence } from './core'

// =============================================================================
// Raw Data Audit Reference
// =============================================================================

/**
 * Reference to raw ingested data for audit purposes.
 * Points to the original data in DurableStreams.
 */
export class RawAuditRef extends Schema.TaggedClass<RawAuditRef>()(
  'RawAuditRef',
  {
    /**
     * DurableStream URL where raw data was published.
     * e.g., '/ingest/opensky/raw'
     */
    streamUrl: Schema.String.pipe(
      Schema.annotations({
        description: 'DurableStream URL where raw data was published.',
      })
    ),

    /**
     * Offset in the stream (sequence number as string).
     */
    offset: Schema.String.pipe(
      Schema.annotations({
        description: 'Stream offset/sequence number for this message.',
      })
    ),

    /**
     * SHA-256 hash of raw data for integrity verification.
     *
     * Backward-compatibility alias for responseHash.
     */
    hash: Schema.String.pipe(
      Schema.pattern(/^[a-f0-9]{64}$/i),
      Schema.annotations({
        description: 'SHA-256 hash of raw data for integrity verification (alias for responseHash).',
      })
    ),

    /**
     * SHA-256 digest of upstream request payload/query envelope.
     */
    requestHash: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^[a-f0-9]{64}$/i),
        Schema.annotations({
          description: 'SHA-256 digest of request payload/query envelope.',
        })
      )
    ),

    /**
     * SHA-256 digest of upstream response payload.
     */
    responseHash: Schema.optional(
      Schema.String.pipe(
        Schema.pattern(/^[a-f0-9]{64}$/i),
        Schema.annotations({
          description: 'SHA-256 digest of response payload.',
        })
      )
    ),

    /**
     * Size of raw data in bytes.
     */
    sizeBytes: Schema.optionalWith(
      Schema.Number.pipe(
        Schema.greaterThanOrEqualTo(0),
        Schema.annotations({
          description: 'Size of raw data in bytes.',
        })
      ),
      { default: () => 0 }
    ),
  },
  {
    identifier: 'RawAuditRef',
    title: 'Raw Audit Reference',
    description: 'Reference to raw ingested data in DurableStreams for audit trail.',
  }
) {}

// =============================================================================
// Source Contribution
// =============================================================================

/**
 * A single contribution from one source to an entity.
 * Tracks what data came from where and when.
 */
export class SourceContribution extends Schema.TaggedClass<SourceContribution>()(
  'SourceContribution',
  {
    /**
     * Which source provided this data.
     */
    source: IntelSource,

    /**
     * When the source observed the data (source timestamp).
     */
    observedAt: Schema.Date.pipe(
      Schema.annotations({
        description: 'When the source observed this data (source timestamp).',
      })
    ),

    /**
     * When we ingested this data (our timestamp).
     */
    ingestedAt: Schema.Date.pipe(
      Schema.annotations({
        description: 'When we ingested this data (system timestamp).',
      })
    ),

    /**
     * Confidence score for this source's contribution.
     */
    confidence: Confidence,

    /**
     * Which fields this source contributed.
     * e.g., ['position', 'heading', 'speed']
     */
    contributedFields: Schema.Array(Schema.String).pipe(
      Schema.annotations({
        description: 'List of field names this source contributed to the entity.',
      })
    ),

    /**
     * Reference to raw data for audit.
     */
    rawRef: RawAuditRef,

    /**
     * Optional notes about this contribution.
     */
    notes: Schema.optional(
      Schema.String.pipe(
        Schema.annotations({
          description: 'Optional notes about this contribution.',
        })
      )
    ),
  },
  {
    identifier: 'SourceContribution',
    title: 'Source Contribution',
    description: 'Single contribution from one intel source. Tracks what, when, and confidence.',
  }
) {}

// =============================================================================
// Entity Provenance
// =============================================================================

/**
 * Complete provenance metadata for a canonical entity.
 * Embedded in every entity to track its lineage.
 */
export class EntityProvenance extends Schema.TaggedClass<EntityProvenance>()(
  'EntityProvenance',
  {
    /**
     * All sources that contributed to this entity.
     * Ordered by ingestedAt (most recent first).
     */
    sources: Schema.Array(SourceContribution).pipe(
      Schema.annotations({
        description: 'All source contributions, ordered by ingestion time (most recent first).',
      })
    ),

    /**
     * When this entity was first created.
     */
    createdAt: Schema.Date.pipe(
      Schema.annotations({
        description: 'Entity creation timestamp.',
      })
    ),

    /**
     * When this entity was last updated.
     */
    updatedAt: Schema.Date.pipe(
      Schema.annotations({
        description: 'Last update timestamp.',
      })
    ),

    /**
     * Revision number for optimistic locking.
     * Incremented on each update.
     */
    revision: Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(1),
      Schema.int(),
      Schema.annotations({
        description: 'Revision number for optimistic locking. Starts at 1.',
      })
    ),

    /**
     * Aggregate confidence score.
     * Computed from source confidences weighted by recency and priority.
     */
    aggregateConfidence: Confidence,

    /**
     * Is this entity considered stale?
     * Based on TTL and last update time.
     */
    isStale: Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Whether entity has exceeded its TTL without update.',
      })
    ),

    /**
     * Time-to-live in seconds.
     * After this duration without update, entity is marked stale.
     */
    ttlSeconds: Schema.Number.pipe(
      Schema.greaterThan(0),
      Schema.annotations({
        description: 'Time-to-live in seconds. Entity becomes stale after this duration.',
      })
    ),

    /**
     * Primary source (highest confidence recent contributor).
     */
    primarySource: Schema.optional(IntelSource),
  },
  {
    identifier: 'EntityProvenance',
    title: 'Entity Provenance',
    description: 'Complete lineage metadata. Tracks all contributions, confidence, staleness, and revision.',
  }
) {
  /**
   * Get the most recent contribution.
   */
  get latestContribution(): SourceContribution | undefined {
    return this.sources[0]
  }

  /**
   * Check if a specific source has contributed.
   */
  hasSource(source: IntelSource): boolean {
    return this.sources.some((c) => c.source === source)
  }

  /**
   * Get contributions from a specific source.
   */
  getContributionsFrom(source: IntelSource): readonly SourceContribution[] {
    return this.sources.filter((c) => c.source === source)
  }
}

// =============================================================================
// Provenance Builder (for creating new provenance)
// =============================================================================

/**
 * Create initial provenance for a new entity.
 */
export const createInitialProvenance = (
  source: IntelSource,
  rawRef: RawAuditRef,
  confidence: Confidence,
  contributedFields: readonly string[],
  ttlSeconds: number = 300
): EntityProvenance => {
  const now = new Date()
  const contribution = new SourceContribution({
    source,
    observedAt: now,
    ingestedAt: now,
    confidence,
    contributedFields: [...contributedFields],
    rawRef,
  })

  return new EntityProvenance({
    sources: [contribution],
    createdAt: now,
    updatedAt: now,
    revision: 1,
    aggregateConfidence: confidence,
    isStale: false,
    ttlSeconds,
    primarySource: source,
  })
}
