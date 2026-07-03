/**
 * CIP Scoring Workflows
 *
 * 1. CIPScoringWorkflow — batch recalculate all DMs
 * 2. CIPSingleScoreWorkflow — score one DM on demand
 *
 * Both delegate to CIPScoring service. Durable via @effect/workflow.
 *
 * @module prospects/workflows/cip-scoring-workflow
 */

import { Schema, Effect } from 'effect'
import { Activity, Workflow } from '@effect/workflow'
import { CIPScoring } from '../services/cip-scoring'

// =============================================================================
// Batch CIP Scoring Workflow
// =============================================================================

export const CIPScoringWorkflow = Workflow.make({
  name: 'CIPScoringBatch',
  payload: {
    reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
  },
  success: Schema.Struct({
    scored: Schema.Number,
  }),
  idempotencyKey: () => `cip-batch-${new Date().toISOString().slice(0, 10)}`,
})

export const CIPScoringWorkflowLayer = CIPScoringWorkflow.toLayer(
  Effect.fn(function* (_payload, _executionId) {
    yield* Effect.logInfo('[CIPScoringWorkflow] Starting batch recalculation')

    const result = yield* Activity.make({
      name: 'RecalculateAll',
      success: Schema.Struct({ scored: Schema.Number }),
      execute: Effect.gen(function* () {
        const cip = yield* CIPScoring
        const count = yield* cip.recalculateAll
        yield* Effect.logInfo(`[CIPScoringWorkflow] Scored ${count} decision makers`)
        return { scored: count }
      }),
    }).pipe(Activity.retry({ times: 2 }))

    return result
  })
)

// =============================================================================
// Single DM CIP Scoring Workflow
// =============================================================================

export const CIPSingleScoreWorkflow = Workflow.make({
  name: 'CIPSingleScore',
  payload: {
    decisionMakerId: Schema.String,
  },
  success: Schema.Struct({
    capital: Schema.Number,
    interest: Schema.Number,
    power: Schema.Number,
    composite: Schema.Number,
  }),
  idempotencyKey: ({ decisionMakerId }) => `cip-single-${decisionMakerId}`,
})

export const CIPSingleScoreWorkflowLayer = CIPSingleScoreWorkflow.toLayer(
  Effect.fn(function* (payload, _executionId) {
    const result = yield* Activity.make({
      name: 'RecalculateOne',
      success: Schema.Struct({
        capital: Schema.Number,
        interest: Schema.Number,
        power: Schema.Number,
        composite: Schema.Number,
      }),
      execute: Effect.gen(function* () {
        const cip = yield* CIPScoring
        const score = yield* cip.recalculateOne(payload.decisionMakerId)
        if (!score) return yield* Effect.die(`DM not found: ${payload.decisionMakerId}`)
        return score
      }),
    })

    return result
  })
)
