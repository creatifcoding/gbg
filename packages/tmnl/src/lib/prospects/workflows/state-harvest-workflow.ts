/**
 * State Registry Harvest Workflow
 *
 * Per-state harvest as a durable Activity, composed into a master orchestrator.
 * Dedup happens at ingestion (CompanyEntity.Create checks slug).
 * Provenance tracked per field by entity handlers.
 *
 * @module prospects/workflows/state-harvest-workflow
 */

import { Schema, Effect } from 'effect'
import { Activity, Workflow } from '@effect/workflow'
import { SqlClient } from '@effect/sql'
import { StateRegistryConnector, STATE_REGISTRY, DEFAULT_QUERIES } from '../connectors/state-registry'
import type { StateSourceConfig, SearchQuery } from '../connectors/state-registry'
import type { HarvestCompanyRecord } from '../schemas/harvest'

// =============================================================================
// Per-State Harvest Activity
// =============================================================================

/**
 * Harvest one state × all queries. Returns raw records.
 * The Activity is the durable boundary — if it completes, the result is persisted.
 */
const stateHarvestActivity = (state: StateSourceConfig) =>
  Activity.make({
    name: `Harvest_${state.stateCode}`,
    success: Schema.Struct({
      stateCode: Schema.String,
      recordCount: Schema.Number,
    }),
    execute: Effect.gen(function* () {
      const connector = yield* StateRegistryConnector
      const sql = yield* SqlClient.SqlClient

      yield* Effect.logInfo(`[Harvest:${state.stateCode}] Starting — ${state.state}`)

      const result = yield* connector.fetchAll({ maxPages: 200 }).pipe(
        Effect.catchAll((err) => {
          return Effect.logWarning(`[Harvest:${state.stateCode}] Failed: ${err}`).pipe(
            Effect.as({ records: [] as HarvestCompanyRecord[], totalAvailable: 0, nextPage: null as null })
          )
        })
      )

      if (result.records.length === 0) {
        yield* Effect.logInfo(`[Harvest:${state.stateCode}] No records`)
        return { stateCode: state.stateCode, recordCount: 0 }
      }

      // Ingest — direct SQL for bulk performance (entity handlers are per-record).
      // Slug dedup via ON CONFLICT DO NOTHING.
      const now = new Date().toISOString()
      let inserted = 0
      const slugify = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

      for (const r of result.records) {
        const id = `co-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
        const slug = slugify(r.name)

        const res = yield* sql`
          INSERT INTO prospects.companies (
            id, name, slug, industry, sub_industry, size,
            location_json, website, description,
            harvest_source, harvest_date, pipeline_stage,
            tags_json, notes, created_at, updated_at
          ) VALUES (
            ${id}, ${r.name}, ${slug}, ${r.industry ?? 'other'},
            ${r.subIndustry ?? null}, ${r.size ?? 'unknown'},
            ${r.hq ? JSON.stringify({ _tag: 'GeoLocation', formatted: r.hq }) : null},
            ${r.website ?? null}, ${r.description ?? null},
            'state_license', ${now}, 'harvested',
            ${r.tags ? JSON.stringify(r.tags) : null}, ${r.notes ?? null},
            ${now}, ${now}
          )
          ON CONFLICT (slug) DO NOTHING
        `
        inserted++

        // Provenance for key fields
        const src = JSON.stringify({ connector: 'state_license', state: state.stateCode, dataset: state.datasetId })
        yield* sql`
          INSERT INTO prospects.field_provenance (entity_type, entity_id, field_name, value, source_json, confidence, first_seen_at, last_updated_at)
          VALUES ('company', ${id}, 'name', ${r.name}, ${src}, 1.0, ${now}, ${now})
          ON CONFLICT (entity_type, entity_id, field_name) DO NOTHING
        `

        // Signals
        if (r.signals) {
          for (const sig of r.signals) {
            const sigId = `sig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
            yield* sql`
              INSERT INTO prospects.signals (id, company_id, signal_type, title, description, weight, detected_at, created_at)
              VALUES (${sigId}, ${id}, ${sig.type}, ${sig.title}, ${sig.description ?? null}, ${sig.weight ?? 1}, ${now}, ${now})
            `.pipe(Effect.catchAll(() => Effect.void))
          }
        }
      }

      yield* Effect.logInfo(`[Harvest:${state.stateCode}] Inserted ${inserted} companies`)
      return { stateCode: state.stateCode, recordCount: inserted }
    }),
  }).pipe(Activity.retry({ times: 2 }))

// =============================================================================
// Single State Harvest Workflow
// =============================================================================

export const StateHarvestWorkflow = Workflow.make({
  name: 'StateRegistryHarvest',
  payload: {
    stateCode: Schema.String,
  },
  success: Schema.Struct({
    stateCode: Schema.String,
    recordCount: Schema.Number,
  }),
  idempotencyKey: ({ stateCode }) => `state-harvest-${stateCode}-${new Date().toISOString().slice(0, 10)}`,
})

export const StateHarvestWorkflowLayer = StateHarvestWorkflow.toLayer(
  Effect.fn(function* (payload, _executionId) {
    const state = STATE_REGISTRY.find((s) => s.stateCode === payload.stateCode || s.id === payload.stateCode)
    if (!state) return yield* Effect.die(`Unknown state: ${payload.stateCode}`)
    return yield* stateHarvestActivity(state)
  })
)

// =============================================================================
// Master Harvest Workflow — all sources
// =============================================================================

export const MasterHarvestWorkflow = Workflow.make({
  name: 'MasterHarvest',
  payload: {
    reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
  },
  success: Schema.Struct({
    totalRecords: Schema.Number,
    stateResults: Schema.Array(Schema.Struct({
      stateCode: Schema.String,
      recordCount: Schema.Number,
    })),
  }),
  idempotencyKey: () => `master-harvest-${new Date().toISOString().slice(0, 10)}`,
})

export const MasterHarvestWorkflowLayer = MasterHarvestWorkflow.toLayer(
  Effect.fn(function* (_payload, _executionId) {
    yield* Effect.logInfo(`[MasterHarvest] Starting — ${STATE_REGISTRY.length} states`)

    // Harvest each state as a separate Activity (durable per-state)
    const results: Array<{ stateCode: string; recordCount: number }> = []
    for (const state of STATE_REGISTRY) {
      const result = yield* stateHarvestActivity(state)
      results.push(result)
    }

    const total = results.reduce((sum, r) => sum + r.recordCount, 0)
    yield* Effect.logInfo(`[MasterHarvest] Complete — ${total} records from ${results.length} states`)

    return {
      totalRecords: total,
      stateResults: results,
    }
  })
)
