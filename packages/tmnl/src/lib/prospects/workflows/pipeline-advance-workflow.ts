/**
 * Pipeline Stage Advancement Workflows
 *
 * Stage rules:
 *   harvested → enriched (has >2 non-null enrichment fields)
 *   enriched  → scored   (has CIP > 0 on at least 1 DM)
 *   scored    → qualified (CIP composite > threshold on at least 1 DM)
 *   qualified → contacted (has at least 1 outreach record)
 *   contacted → engaged   (has at least 1 reply)
 *
 * @module prospects/workflows/pipeline-advance-workflow
 */

import { Schema, Effect } from 'effect'
import { Activity, Workflow } from '@effect/workflow'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Stage Transition Rules
// =============================================================================

const QUALIFIED_CIP_THRESHOLD = 5.0

interface CompanyStageData {
  readonly id: string
  readonly currentStage: string
  readonly enrichedFields: number
  readonly maxCip: number
  readonly outreachCount: number
  readonly replyCount: number
}

const evaluateStage = (data: CompanyStageData): string | null => {
  const { currentStage, enrichedFields, maxCip, outreachCount, replyCount } = data

  switch (currentStage) {
    case 'harvested':
      return enrichedFields > 2 ? 'enriched' : null
    case 'enriched':
      return maxCip > 0 ? 'scored' : null
    case 'scored':
      return maxCip >= QUALIFIED_CIP_THRESHOLD ? 'qualified' : null
    case 'qualified':
      return outreachCount > 0 ? 'contacted' : null
    case 'contacted':
      return replyCount > 0 ? 'engaged' : null
    default:
      return null
  }
}

// =============================================================================
// Batch Pipeline Advance Workflow
// =============================================================================

export const PipelineAdvanceWorkflow = Workflow.make({
  name: 'PipelineAdvanceBatch',
  payload: {
    reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
  },
  success: Schema.Struct({
    evaluated: Schema.Number,
    advanced: Schema.Number,
    transitions: Schema.Array(Schema.Struct({
      companyId: Schema.String,
      from: Schema.String,
      to: Schema.String,
    })),
  }),
  idempotencyKey: () => `pipeline-advance-${new Date().toISOString().slice(0, 10)}`,
})

export const PipelineAdvanceWorkflowLayer = PipelineAdvanceWorkflow.toLayer(
  Effect.fn(function* (_payload, _executionId) {
    yield* Effect.logInfo('[PipelineAdvance] Evaluating all companies')

    const result = yield* Activity.make({
      name: 'EvaluateAndAdvance',
      success: Schema.Struct({
        evaluated: Schema.Number,
        advanced: Schema.Number,
        transitions: Schema.Array(Schema.Struct({
          companyId: Schema.String,
          from: Schema.String,
          to: Schema.String,
        })),
      }),
      execute: Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient

        // Single query: company + enrichment count + max CIP + outreach/reply counts
        const companies = yield* sql<{
          id: string
          currentStage: string
          enrichedFields: string
          maxCip: string
          outreachCount: string
          replyCount: string
        }>`
          SELECT
            c.id,
            c.pipeline_stage as "currentStage",
            COALESCE((
              SELECT COUNT(*) FROM prospects.field_provenance fp
              WHERE fp.entity_type = 'company' AND fp.entity_id = c.id
            ), 0) as "enrichedFields",
            COALESCE((
              SELECT MAX(dm.cip_composite) FROM prospects.decision_makers dm
              WHERE dm.company_id = c.id
            ), 0) as "maxCip",
            COALESCE((
              SELECT COUNT(*) FROM prospects.outreach o
              WHERE o.company_id = c.id AND o.status != 'drafted'
            ), 0) as "outreachCount",
            COALESCE((
              SELECT COUNT(*) FROM prospects.outreach o
              WHERE o.company_id = c.id AND o.status = 'replied'
            ), 0) as "replyCount"
          FROM prospects.companies c
        `

        const transitions: Array<{ companyId: string; from: string; to: string }> = []
        const now = new Date().toISOString()

        for (const co of companies) {
          const nextStage = evaluateStage({
            id: co.id,
            currentStage: co.currentStage,
            enrichedFields: Number(co.enrichedFields),
            maxCip: Number(co.maxCip),
            outreachCount: Number(co.outreachCount),
            replyCount: Number(co.replyCount),
          })

          if (nextStage) {
            yield* sql`
              UPDATE prospects.companies
              SET pipeline_stage = ${nextStage}, updated_at = ${now}
              WHERE id = ${co.id}
            `
            transitions.push({ companyId: co.id, from: co.currentStage, to: nextStage })
          }
        }

        yield* Effect.logInfo(`[PipelineAdvance] ${transitions.length}/${companies.length} companies advanced`)
        return {
          evaluated: companies.length,
          advanced: transitions.length,
          transitions,
        }
      }),
    }).pipe(Activity.retry({ times: 2 }))

    return result
  })
)
