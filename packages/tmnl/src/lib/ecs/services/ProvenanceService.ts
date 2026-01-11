/**
 * ProvenanceService - Entity Provenance Management
 *
 * Creates and updates provenance metadata for entities.
 * Handles multi-source contribution tracking.
 *
 * @module ecs/services/ProvenanceService
 */

import { Effect, Schema } from 'effect'
import { Confidence, IntelSource } from '../schemas/core'
import {
  EntityProvenance,
  SourceContribution,
  RawAuditRef,
} from '../schemas/provenance'
import { ConfidenceService } from './ConfidenceService'
import { SourceRegistry, SourceNotFoundError } from './SourceRegistry'

// =============================================================================
// Types
// =============================================================================

/**
 * Parameters for creating initial provenance
 */
export class CreateProvenanceParams extends Schema.TaggedClass<CreateProvenanceParams>()(
  'CreateProvenanceParams',
  {
    source: IntelSource,
    confidence: Confidence,
    contributedFields: Schema.Array(Schema.String),
    rawRef: RawAuditRef,
    ttlSeconds: Schema.optional(Schema.Number),
    observedAt: Schema.optional(Schema.Date),
  }
) {}

/**
 * Parameters for adding a contribution
 */
export class AddContributionParams extends Schema.TaggedClass<AddContributionParams>()(
  'AddContributionParams',
  {
    source: IntelSource,
    confidence: Confidence,
    contributedFields: Schema.Array(Schema.String),
    rawRef: RawAuditRef,
    observedAt: Schema.optional(Schema.Date),
    notes: Schema.optional(Schema.String),
  }
) {}

// =============================================================================
// Service Definition
// =============================================================================

/**
 * ProvenanceService - manages entity provenance metadata.
 *
 * Usage:
 * ```typescript
 * const provenance = yield* ProvenanceService.create(params)
 * const updated = yield* ProvenanceService.addContribution(provenance, contribution)
 * ```
 */
export class ProvenanceService extends Effect.Service<ProvenanceService>()(
  'ecs/ProvenanceService',
  {
    accessors: true,
    dependencies: [ConfidenceService.Default, SourceRegistry.Default],
    effect: Effect.gen(function* () {
      const confidenceService = yield* ConfidenceService
      const sourceRegistry = yield* SourceRegistry

      return {
        /**
         * Create initial provenance for a new entity.
         */
        create: (
          params: CreateProvenanceParams
        ): Effect.Effect<EntityProvenance, SourceNotFoundError> =>
          Effect.gen(function* () {
            const now = new Date()
            const observedAt = params.observedAt ?? now

            // Get default TTL from source registry if not provided
            const ttlSeconds =
              params.ttlSeconds ??
              (yield* sourceRegistry.getDefaultTtl(params.source))

            const contribution = new SourceContribution({
              source: params.source,
              observedAt,
              ingestedAt: now,
              confidence: params.confidence,
              contributedFields: [...params.contributedFields],
              rawRef: params.rawRef,
            })

            return new EntityProvenance({
              sources: [contribution],
              createdAt: now,
              updatedAt: now,
              revision: 1,
              aggregateConfidence: params.confidence,
              isStale: false,
              ttlSeconds,
              primarySource: params.source,
            })
          }),

        /**
         * Add a contribution to existing provenance.
         * Recalculates aggregate confidence.
         */
        addContribution: (
          provenance: EntityProvenance,
          params: AddContributionParams
        ): Effect.Effect<EntityProvenance, SourceNotFoundError> =>
          Effect.gen(function* () {
            const now = new Date()
            const observedAt = params.observedAt ?? now

            const contribution = new SourceContribution({
              source: params.source,
              observedAt,
              ingestedAt: now,
              confidence: params.confidence,
              contributedFields: [...params.contributedFields],
              rawRef: params.rawRef,
              notes: params.notes,
            })

            const newSources = [...provenance.sources, contribution]

            // Recalculate aggregate confidence
            const result = yield* confidenceService.calculate(newSources)

            return new EntityProvenance({
              sources: newSources,
              createdAt: provenance.createdAt,
              updatedAt: now,
              revision: provenance.revision + 1,
              aggregateConfidence: result.confidence,
              isStale: false,
              ttlSeconds: provenance.ttlSeconds,
              primarySource: result.primarySource,
            })
          }),

        /**
         * Recalculate provenance metadata (e.g., after source weight changes).
         */
        recalculate: (
          provenance: EntityProvenance
        ): Effect.Effect<EntityProvenance, SourceNotFoundError> =>
          Effect.gen(function* () {
            const result = yield* confidenceService.calculate(provenance.sources)

            return new EntityProvenance({
              ...provenance,
              aggregateConfidence: result.confidence,
              primarySource: result.primarySource,
              updatedAt: new Date(),
            })
          }),

        /**
         * Mark provenance as stale.
         */
        markStale: (
          provenance: EntityProvenance
        ): Effect.Effect<EntityProvenance> =>
          Effect.sync(
            () =>
              new EntityProvenance({
                ...provenance,
                isStale: true,
                updatedAt: new Date(),
              })
          ),

        /**
         * Refresh provenance (clear stale flag, bump revision).
         */
        refresh: (
          provenance: EntityProvenance
        ): Effect.Effect<EntityProvenance> =>
          Effect.sync(
            () =>
              new EntityProvenance({
                ...provenance,
                isStale: false,
                updatedAt: new Date(),
                revision: provenance.revision + 1,
              })
          ),

        /**
         * Check if provenance is stale based on TTL.
         */
        checkStaleness: (
          provenance: EntityProvenance
        ): Effect.Effect<boolean> =>
          Effect.sync(() => {
            if (provenance.isStale) return true

            const ageMs = Date.now() - provenance.updatedAt.getTime()
            const ttlMs = provenance.ttlSeconds * 1000
            return ageMs > ttlMs
          }),

        /**
         * Get the age of provenance in seconds.
         */
        getAge: (provenance: EntityProvenance): Effect.Effect<number> =>
          Effect.sync(
            () => (Date.now() - provenance.updatedAt.getTime()) / 1000
          ),

        /**
         * Merge two provenance records (for entity fusion).
         */
        merge: (
          a: EntityProvenance,
          b: EntityProvenance
        ): Effect.Effect<EntityProvenance, SourceNotFoundError> =>
          Effect.gen(function* () {
            // Combine all sources, deduplicating by source+observedAt
            const sourceMap = new Map<string, SourceContribution>()

            for (const source of [...a.sources, ...b.sources]) {
              const key = `${source.source}-${source.observedAt.toISOString()}`
              // Keep the newer contribution if duplicate
              const existing = sourceMap.get(key)
              if (!existing || source.ingestedAt > existing.ingestedAt) {
                sourceMap.set(key, source)
              }
            }

            const mergedSources = [...sourceMap.values()]
            const result = yield* confidenceService.calculate(mergedSources)

            return new EntityProvenance({
              sources: mergedSources,
              createdAt: a.createdAt < b.createdAt ? a.createdAt : b.createdAt,
              updatedAt: new Date(),
              revision: Math.max(a.revision, b.revision) + 1,
              aggregateConfidence: result.confidence,
              isStale: false,
              ttlSeconds: Math.min(a.ttlSeconds, b.ttlSeconds),
              primarySource: result.primarySource,
            })
          }),
      }
    }),
  }
) {}
