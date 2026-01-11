/**
 * ConfidenceService - Aggregate Confidence Calculation
 *
 * Calculates aggregate confidence from multi-source contributions.
 * Uses weighted averaging based on source registry weights.
 *
 * @module ecs/services/ConfidenceService
 */

import { Effect, Schema } from 'effect'
import { Confidence, IntelSource } from '../schemas/core'
import { SourceContribution } from '../schemas/provenance'
import { SourceRegistry, SourceNotFoundError } from './SourceRegistry'

// =============================================================================
// Types
// =============================================================================

/**
 * Result of confidence calculation with metadata
 */
export class ConfidenceResult extends Schema.TaggedClass<ConfidenceResult>()(
  'ConfidenceResult',
  {
    /**
     * The aggregate confidence value
     */
    confidence: Confidence,

    /**
     * Number of sources contributing
     */
    sourceCount: Schema.Number,

    /**
     * Total weight used in calculation
     */
    totalWeight: Schema.Number,

    /**
     * Primary source (highest weighted contributor)
     */
    primarySource: Schema.optional(IntelSource),
  }
) {}

// =============================================================================
// Service Definition
// =============================================================================

/**
 * ConfidenceService - calculates aggregate confidence from contributions.
 *
 * Usage:
 * ```typescript
 * const result = yield* ConfidenceService.calculate(contributions)
 * const aggregate = result.confidence
 * ```
 */
export class ConfidenceService extends Effect.Service<ConfidenceService>()(
  'ecs/ConfidenceService',
  {
    accessors: true,
    dependencies: [SourceRegistry.Default],
    effect: Effect.gen(function* () {
      const sourceRegistry = yield* SourceRegistry

      return {
        /**
         * Calculate aggregate confidence from source contributions.
         * Uses weighted average based on source registry weights.
         */
        calculate: (
          contributions: readonly SourceContribution[]
        ): Effect.Effect<ConfidenceResult, SourceNotFoundError> =>
          Effect.gen(function* () {
            if (contributions.length === 0) {
              return new ConfidenceResult({
                confidence: 0 as Confidence,
                sourceCount: 0,
                totalWeight: 0,
              })
            }

            let weightedSum = 0
            let totalWeight = 0
            let maxWeightedConfidence = 0
            let primarySource: IntelSource | undefined

            for (const contribution of contributions) {
              const weight = yield* sourceRegistry.getWeight(contribution.source)
              const weightedConfidence = contribution.confidence * weight

              weightedSum += weightedConfidence
              totalWeight += weight

              if (weightedConfidence > maxWeightedConfidence) {
                maxWeightedConfidence = weightedConfidence
                primarySource = contribution.source
              }
            }

            const aggregate =
              totalWeight > 0 ? Math.min(1, weightedSum / totalWeight) : 0

            return new ConfidenceResult({
              confidence: aggregate as Confidence,
              sourceCount: contributions.length,
              totalWeight,
              primarySource,
            })
          }),

        /**
         * Calculate simple unweighted average confidence.
         */
        calculateSimple: (
          contributions: readonly SourceContribution[]
        ): Effect.Effect<Confidence> =>
          Effect.sync(() => {
            if (contributions.length === 0) {
              return 0 as Confidence
            }
            const sum = contributions.reduce((acc, c) => acc + c.confidence, 0)
            return (sum / contributions.length) as Confidence
          }),

        /**
         * Compare two confidence values.
         * Returns -1 if a < b, 0 if equal, 1 if a > b.
         */
        compare: (a: Confidence, b: Confidence): Effect.Effect<-1 | 0 | 1> =>
          Effect.sync(() => {
            if (a < b) return -1
            if (a > b) return 1
            return 0
          }),

        /**
         * Check if confidence meets a threshold.
         */
        meetsThreshold: (
          confidence: Confidence,
          threshold: number
        ): Effect.Effect<boolean> =>
          Effect.sync(() => confidence >= threshold),

        /**
         * Combine two confidences (average).
         */
        combine: (a: Confidence, b: Confidence): Effect.Effect<Confidence> =>
          Effect.sync(() => ((a + b) / 2) as Confidence),

        /**
         * Decay confidence based on staleness.
         * @param confidence - Original confidence
         * @param ageSeconds - How old the data is
         * @param halfLifeSeconds - Time for confidence to halve
         */
        decay: (
          confidence: Confidence,
          ageSeconds: number,
          halfLifeSeconds: number
        ): Effect.Effect<Confidence> =>
          Effect.sync(() => {
            const decayFactor = Math.pow(0.5, ageSeconds / halfLifeSeconds)
            return (confidence * decayFactor) as Confidence
          }),

        /**
         * Create a confidence value (branded).
         */
        make: (value: number): Effect.Effect<Confidence> =>
          Effect.sync(() => Math.max(0, Math.min(1, value)) as Confidence),
      }
    }),
  }
) {}
