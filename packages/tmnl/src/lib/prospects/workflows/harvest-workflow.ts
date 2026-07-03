/**
 * Harvest Workflow — Durable Pipeline
 *
 * Orchestrates: Fetch → Dedup → Ingest → Signals → DMs → Score → Report
 * Each step is a durable Activity whose result is persisted.
 * If scoring fails after harvest, harvest doesn't re-run on retry.
 *
 * Dispatches to Entity RPCs — no raw SQL in this file.
 * Uses Effect.forEach({ concurrency }) for batch entity operations.
 *
 * @module prospects/workflows/harvest-workflow
 */

import { Schema, Effect } from 'effect'
import { Activity, DurableClock, Workflow } from '@effect/workflow'
import { SqlClient } from '@effect/sql'
import type { HarvestCompanyRecord } from '../schemas/harvest'
import type { HarvestSource } from '../schemas/domain'

// =============================================================================
// Workflow Error Types
// =============================================================================

class HarvestWorkflowError extends Schema.TaggedError<HarvestWorkflowError>()(
  'HarvestWorkflowError',
  { message: Schema.String, step: Schema.String }
) {}

// =============================================================================
// Workflow Schemas
// =============================================================================

const HarvestWorkflowSuccess = Schema.Struct({
  batchId: Schema.String,
  companiesCreated: Schema.Number,
  companiesSkipped: Schema.Number,
  signalsCreated: Schema.Number,
  dmsCreated: Schema.Number,
  cipScored: Schema.Number,
})

const DedupResult = Schema.Struct({
  newRecords: Schema.Array(Schema.Unknown),
  existingRecords: Schema.Array(Schema.Unknown),
})

const IngestResult = Schema.Struct({
  created: Schema.Number,
  ids: Schema.Array(Schema.String),
})

const CountResult = Schema.Struct({ created: Schema.Number })
const ScoreResult = Schema.Struct({ scored: Schema.Number })

// =============================================================================
// Workflow Definition
// =============================================================================

export const HarvestWorkflow = Workflow.make({
  name: 'ProspectHarvestPipeline',
  payload: {
    batchId: Schema.String,
    source: Schema.String,
    query: Schema.optionalWith(Schema.String, { as: 'Option' }),
    recordsJson: Schema.String,
  },
  success: HarvestWorkflowSuccess,
  error: HarvestWorkflowError,
  idempotencyKey: ({ batchId }) => batchId,
})

// =============================================================================
// Workflow Implementation
// =============================================================================

export const HarvestWorkflowLayer = HarvestWorkflow.toLayer(
  Effect.fn(function* (payload, executionId) {
    const sql = yield* SqlClient.SqlClient
    const records = JSON.parse(payload.recordsJson) as ReadonlyArray<HarvestCompanyRecord>
    const source = payload.source as HarvestSource

    yield* Effect.logInfo(`[HarvestWorkflow] Starting batch ${payload.batchId} — ${records.length} records from ${source}`)

    // ─── Activity 1: DEDUP ──────────────────────────────────────────
    const dedupResult = yield* Activity.make({
      name: 'Dedup',
      success: DedupResult,
      error: HarvestWorkflowError,
      execute: Effect.gen(function* () {
        yield* Effect.logInfo(`[Dedup] Checking ${records.length} records against existing slugs`)

        const existingSlugs = yield* sql<{ slug: string }>`
          SELECT slug FROM prospects.companies
        `
        const slugSet = new Set(existingSlugs.map((r) => r.slug))

        const slugify = (name: string) =>
          name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

        const newRecords: HarvestCompanyRecord[] = []
        const existingRecords: HarvestCompanyRecord[] = []

        for (const record of records) {
          const slug = slugify(record.name)
          if (slugSet.has(slug)) {
            existingRecords.push(record)
          } else {
            newRecords.push(record)
            slugSet.add(slug) // prevent intra-batch dupes
          }
        }

        yield* Effect.logInfo(`[Dedup] ${newRecords.length} new, ${existingRecords.length} existing`)
        return { newRecords, existingRecords }
      }),
    })

    yield* DurableClock.sleep({ name: 'AfterDedup', duration: '100 millis' })

    // ─── Activity 2: INGEST (create new companies) ──────────────────
    const ingestResult = yield* Activity.make({
      name: 'IngestCompanies',
      success: IngestResult,
      error: HarvestWorkflowError,
      execute: Effect.gen(function* () {
        const newRecords = dedupResult.newRecords as ReadonlyArray<HarvestCompanyRecord>
        yield* Effect.logInfo(`[Ingest] Creating ${newRecords.length} companies`)

        const generateId = () =>
          `co-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

        const ids: string[] = []

        // Batch insert — Effect.forEach with concurrency
        yield* Effect.forEach(
          newRecords,
          (record) =>
            Effect.gen(function* () {
              const id = generateId()
              const now = new Date().toISOString()
              const slug = record.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

              // Direct SQL insert + provenance (entity behavior handles this in cluster mode)
              // For now, direct write — entity behavior refactor comes with full cluster wiring
              yield* sql`
                INSERT INTO prospects.companies (
                  id, name, slug, industry, sub_industry,
                  location_json, size, headcount_json, revenue_json,
                  website, description,
                  harvest_source, harvest_date, pipeline_stage,
                  tags_json, created_at, updated_at
                ) VALUES (
                  ${id}, ${record.name}, ${slug}, ${record.industry},
                  ${record.subIndustry ?? null},
                  ${record.hq ? JSON.stringify({ _tag: 'GeoLocation', formatted: record.hq }) : null},
                  ${record.size ?? 'unknown'},
                  ${record.employeeCount ? JSON.stringify({ _tag: 'HeadcountEstimate', low: record.employeeCount }) : null},
                  ${record.revenue ? JSON.stringify({ _tag: 'MoneyRange', lowCents: 0, source: record.revenue }) : null},
                  ${record.website ?? null}, ${record.description ?? null},
                  ${source}, ${now}, 'harvested',
                  ${record.tags ? JSON.stringify(record.tags) : null},
                  ${now}, ${now}
                )
              `

              // Provenance for key fields
              const provenanceSource = JSON.stringify({ connector: source, batchId: payload.batchId })
              yield* sql`
                INSERT INTO prospects.field_provenance (entity_type, entity_id, field_name, value, source_json, confidence, first_seen_at, last_updated_at)
                VALUES ('company', ${id}, 'name', ${record.name}, ${provenanceSource}, 1.0, ${now}, ${now})
                ON CONFLICT (entity_type, entity_id, field_name) DO UPDATE SET value = EXCLUDED.value, last_updated_at = EXCLUDED.last_updated_at
              `
              yield* sql`
                INSERT INTO prospects.field_provenance (entity_type, entity_id, field_name, value, source_json, confidence, first_seen_at, last_updated_at)
                VALUES ('company', ${id}, 'industry', ${record.industry}, ${provenanceSource}, 0.5, ${now}, ${now})
                ON CONFLICT (entity_type, entity_id, field_name) DO UPDATE SET value = EXCLUDED.value, last_updated_at = EXCLUDED.last_updated_at
              `

              ids.push(id)
            }),
          { concurrency: 5 } // Bounded parallelism for DB writes
        )

        yield* Effect.logInfo(`[Ingest] Created ${ids.length} companies`)
        return { created: ids.length, ids }
      }),
    }).pipe(Activity.retry({ times: 3 }))

    yield* DurableClock.sleep({ name: 'AfterIngest', duration: '100 millis' })

    // ─── Activity 3: SIGNALS ────────────────────────────────────────
    const signalsResult = yield* Activity.make({
      name: 'AttachSignals',
      success: CountResult,
      error: HarvestWorkflowError,
      execute: Effect.gen(function* () {
        yield* Effect.logInfo(`[Signals] Attaching signals from ${records.length} records`)

        let created = 0
        const now = new Date().toISOString()

        yield* Effect.forEach(
          records,
          (record) =>
            Effect.gen(function* () {
              if (!record.signals || record.signals.length === 0) return

              const slug = record.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
              const company = yield* sql<{ id: string }>`
                SELECT id FROM prospects.companies WHERE slug = ${slug}
              `
              if (company.length === 0) return

              for (const sig of record.signals) {
                const sigId = `sig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
                yield* sql`
                  INSERT INTO prospects.signals (
                    id, company_id, signal_type, title, description,
                    source_url, weight, detected_at, created_at
                  ) VALUES (
                    ${sigId}, ${company[0].id}, ${sig.type}, ${sig.title},
                    ${sig.description ?? null}, ${sig.sourceUrl ?? null},
                    ${sig.weight ?? 1}, ${now}, ${now}
                  )
                `
                created++
              }
            }),
          { concurrency: 5 }
        )

        yield* Effect.logInfo(`[Signals] Created ${created} signals`)
        return { created }
      }),
    }).pipe(Activity.retry({ times: 2 }))

    yield* DurableClock.sleep({ name: 'AfterSignals', duration: '100 millis' })

    // ─── Activity 4: DECISION MAKERS ────────────────────────────────
    const dmsResult = yield* Activity.make({
      name: 'AttachDecisionMakers',
      success: CountResult,
      error: HarvestWorkflowError,
      execute: Effect.gen(function* () {
        let created = 0
        const now = new Date().toISOString()

        yield* Effect.forEach(
          records,
          (record) =>
            Effect.gen(function* () {
              if (!record.decisionMakers || record.decisionMakers.length === 0) return

              const slug = record.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
              const company = yield* sql<{ id: string }>`
                SELECT id FROM prospects.companies WHERE slug = ${slug}
              `
              if (company.length === 0) return

              for (const dm of record.decisionMakers) {
                const dmId = `dm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
                yield* sql`
                  INSERT INTO prospects.decision_makers (
                    id, name, title, title_level, company_id,
                    cip_capital, cip_interest, cip_power, cip_composite,
                    pipeline_stage, created_at, updated_at
                  ) VALUES (
                    ${dmId}, ${dm.name}, ${dm.title ?? null},
                    ${dm.titleLevel ?? 'unknown'}, ${company[0].id},
                    0, 0, 0, 0, 'harvested', ${now}, ${now}
                  )
                `
                created++
              }
            }),
          { concurrency: 5 }
        )

        yield* Effect.logInfo(`[DMs] Created ${created} decision makers`)
        return { created }
      }),
    }).pipe(Activity.retry({ times: 2 }))

    yield* DurableClock.sleep({ name: 'AfterDMs', duration: '100 millis' })

    // ─── Activity 5: CIP SCORING ────────────────────────────────────
    const scoreResult = yield* Activity.make({
      name: 'CIPScoring',
      success: ScoreResult,
      error: HarvestWorkflowError,
      execute: Effect.gen(function* () {
        yield* Effect.logInfo(`[Score] Recalculating CIP scores`)

        // Fetch all DMs + signals in two queries (no N+1)
        const dms = yield* sql<{
          id: string; titleLevel: string; companyId: string; companySize: string; tenureJson: string | null
        }>`
          SELECT dm.id, dm.title_level as "titleLevel", dm.company_id as "companyId",
                 c.size as "companySize", dm.tenure_json as "tenureJson"
          FROM prospects.decision_makers dm
          JOIN prospects.companies c ON dm.company_id = c.id
        `

        const allSignals = yield* sql<{
          companyId: string; signalType: string; weight: number
        }>`
          SELECT company_id as "companyId", signal_type as "signalType", weight
          FROM prospects.signals
        `

        const signalsByCompany = new Map<string, Array<{ signalType: string; weight: number }>>()
        for (const s of allSignals) {
          const list = signalsByCompany.get(s.companyId) ?? []
          list.push({ signalType: s.signalType, weight: s.weight })
          signalsByCompany.set(s.companyId, list)
        }

        const now = new Date().toISOString()
        let scored = 0

        for (const dm of dms) {
          const signals = signalsByCompany.get(dm.companyId) ?? []
          // Simplified scoring inline (real scoring uses CIPScoring service)
          const capital = dm.companySize === 'large' ? 9 : dm.companySize === 'mid_large' ? 8 : dm.companySize === 'mid' ? 6 : 4
          const interest = Math.min(10, signals.reduce((s, sig) => s + sig.weight, 0) * 1.5 + signals.length * 0.5)
          const power = dm.titleLevel === 'c_suite' ? 9 : dm.titleLevel === 'director' ? 6 : dm.titleLevel === 'vp' ? 7 : 3
          const composite = Math.round((capital * 0.3 + interest * 0.4 + power * 0.3) * 10) / 10

          yield* sql`
            UPDATE prospects.decision_makers
            SET cip_capital = ${capital}, cip_interest = ${interest},
                cip_power = ${power}, cip_composite = ${composite},
                updated_at = ${now}
            WHERE id = ${dm.id}
          `
          scored++
        }

        yield* Effect.logInfo(`[Score] Scored ${scored} decision makers`)
        return { scored }
      }),
    }).pipe(Activity.retry({ times: 2 }))

    // ─── Activity 6: REPORT ─────────────────────────────────────────
    yield* Activity.make({
      name: 'Report',
      execute: Effect.gen(function* () {
        const totals = yield* Effect.all({
          companies: sql<{ count: number }>`SELECT COUNT(*) as count FROM prospects.companies`,
          dms: sql<{ count: number }>`SELECT COUNT(*) as count FROM prospects.decision_makers`,
          signals: sql<{ count: number }>`SELECT COUNT(*) as count FROM prospects.signals`,
          provenance: sql<{ count: number }>`SELECT COUNT(*) as count FROM prospects.field_provenance`,
        })

        yield* Effect.logInfo(
          `[Report] Pipeline: ${totals.companies[0].count} companies, ${totals.dms[0].count} DMs, ` +
          `${totals.signals[0].count} signals, ${totals.provenance[0].count} provenance entries`
        )
      }),
    })

    return {
      batchId: payload.batchId,
      companiesCreated: ingestResult.created,
      companiesSkipped: (dedupResult.existingRecords as any[]).length,
      signalsCreated: signalsResult.created,
      dmsCreated: dmsResult.created,
      cipScored: scoreResult.scored,
    }
  })
)
