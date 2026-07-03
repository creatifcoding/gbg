/**
 * Industry Reclassification Workflow
 *
 * Reclassifies companies tagged 'other' using NAICS/SIC codes + regex patterns.
 * Writes provenance for every reclassification with transform metadata.
 *
 * @module prospects/enrichment/industry-reclass-workflow
 */

import { Schema, Effect } from 'effect'
import { Activity, Workflow } from '@effect/workflow'
import { SqlClient } from '@effect/sql'
import { classifyIndustry } from './industry-maps'
import type { Industry } from '../schemas/domain'

export const IndustryReclassWorkflow = Workflow.make({
  name: 'IndustryReclassification',
  payload: {
    reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
  },
  success: Schema.Struct({
    evaluated: Schema.Number,
    reclassified: Schema.Number,
    remaining: Schema.Number,
    byIndustry: Schema.Array(Schema.Struct({
      industry: Schema.String,
      count: Schema.Number,
    })),
  }),
  idempotencyKey: () => `industry-reclass-${new Date().toISOString().slice(0, 10)}`,
})

export const IndustryReclassWorkflowLayer = IndustryReclassWorkflow.toLayer(
  Effect.fn(function* (_payload, _executionId) {
    yield* Effect.logInfo('[IndustryReclass] Starting reclassification of "other" companies')

    const result = yield* Activity.make({
      name: 'Reclassify',
      success: Schema.Struct({
        evaluated: Schema.Number,
        reclassified: Schema.Number,
        remaining: Schema.Number,
        byIndustry: Schema.Array(Schema.Struct({
          industry: Schema.String,
          count: Schema.Number,
        })),
      }),
      execute: Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient

        // Fetch all 'other' companies with name + description
        const others = yield* sql.unsafe(
          `SELECT id, name, description FROM prospects.companies WHERE industry = 'other'`
        ) as any[]

        yield* Effect.logInfo(`[IndustryReclass] Evaluating ${others.length} 'other' companies`)

        const now = new Date().toISOString()
        let reclassified = 0
        const counts = new Map<string, number>()

        for (const co of others) {
          const result = classifyIndustry({
            name: co.name,
            description: co.description,
          })

          if (result) {
            // Update industry
            yield* sql.unsafe(
              `UPDATE prospects.companies SET industry = $1, updated_at = $2 WHERE id = $3`,
              [result.industry, now, co.id]
            )

            // Provenance with transform metadata
            const src = JSON.stringify({ connector: 'enrichment', method: result.method })
            const transform = JSON.stringify({
              function: 'classifyIndustry',
              inputs: ['name', 'description'],
              version: '2.0',
            })
            yield* sql.unsafe(
              `INSERT INTO prospects.field_provenance
               (entity_type, entity_id, field_name, value, source_json, transform_json, confidence, first_seen_at, last_updated_at)
               VALUES ('company', $1, 'industry', $2, $3, $4, $5, $6, $6)
               ON CONFLICT (entity_type, entity_id, field_name) DO UPDATE SET
                 value = $2, source_json = $3, transform_json = $4, confidence = $5, last_updated_at = $6`,
              [co.id, result.industry, src, transform, result.confidence, now]
            )

            // Changelog
            yield* sql.unsafe(
              `INSERT INTO prospects.field_changelog
               (entity_type, entity_id, field_name, old_value, new_value, source_json, transform_json, confidence, changed_at)
               VALUES ('company', $1, 'industry', 'other', $2, $3, $4, $5, $6)`,
              [co.id, result.industry, src, transform, result.confidence, now]
            )

            counts.set(result.industry, (counts.get(result.industry) ?? 0) + 1)
            reclassified++
          }
        }

        const remaining = others.length - reclassified
        const byIndustry = Array.from(counts.entries())
          .map(([industry, count]) => ({ industry, count }))
          .sort((a, b) => b.count - a.count)

        yield* Effect.logInfo(
          `[IndustryReclass] Reclassified ${reclassified}/${others.length}. ` +
          `Remaining 'other': ${remaining}. ` +
          `Top: ${byIndustry.slice(0, 5).map(r => `${r.industry}(${r.count})`).join(', ')}`
        )

        return { evaluated: others.length, reclassified, remaining, byIndustry }
      }),
    }).pipe(Activity.retry({ times: 2 }))

    return result
  })
)
