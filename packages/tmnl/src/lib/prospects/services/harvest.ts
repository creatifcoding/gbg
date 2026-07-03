/**
 * Prospect Pipeline — Harvest Service
 *
 * Ingests bulk data from various sources into the pipeline.
 * Schema-backed payloads. Batch SQL operations — no per-record queries.
 * Marshals inbound records into rich JSON column types on insert.
 *
 * Exposed as Effect.Service for DI, testability, and Layer composition.
 *
 * @module prospects/services/harvest
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'
import type { HarvestSource } from '../schemas/domain'
import type {
  HarvestCompanyRecord,
  HarvestResult,
  PipelineSummary,
} from '../schemas/harvest'
import { parseLocation } from '../schemas/value-objects'

// =============================================================================
// Helpers
// =============================================================================

const slugify = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const generateId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Marshal headcount fields into HeadcountEstimate JSON or null */
const marshalHeadcount = (r: HarvestCompanyRecord): string | null => {
  if (r.employeeCount == null) return null
  return JSON.stringify({
    _tag: 'HeadcountEstimate',
    low: r.employeeCount,
    source: 'manual',
    confidence: 'estimated',
  })
}

/** Marshal revenue string into MoneyRange JSON or null */
const marshalRevenue = (r: HarvestCompanyRecord): string | null => {
  if (!r.revenue) return null
  // Try to parse structured money from string
  const { parseMoneyRange } = require('../schemas/value-objects')
  const parsed = parseMoneyRange(r.revenue)
  if (parsed) return JSON.stringify(parsed)
  // Fallback: store as note in a zero-value range
  return JSON.stringify({
    _tag: 'MoneyRange',
    lowCents: 0,
    confidence: 'unknown',
    source: r.revenue,
  })
}

/** Marshal location string into GeoLocation JSON or null */
const marshalLocation = (r: HarvestCompanyRecord): string | null => {
  if (!r.hq) return null
  return JSON.stringify(parseLocation(r.hq))
}

/** Marshal DM contacts from harvest fields into ContactMethod[] JSON or null */
const marshalContacts = (dm: {
  email?: string
  linkedinUrl?: string
}): string | null => {
  const methods: Array<Record<string, unknown>> = []
  if (dm.email) {
    methods.push({
      _tag: 'ContactMethod',
      channel: 'email',
      value: dm.email,
      label: 'work',
      isPrimary: true,
    })
  }
  if (dm.linkedinUrl) {
    methods.push({
      _tag: 'ContactMethod',
      channel: 'linkedin',
      value: dm.linkedinUrl,
    })
  }
  return methods.length > 0 ? JSON.stringify(methods) : null
}

/** Marshal tenure string into RoleTenure JSON or null */
const marshalTenure = (tenure?: string): string | null => {
  if (!tenure) return null
  return JSON.stringify({
    _tag: 'RoleTenure',
    origin: tenure === 'new' ? 'external_hire' : 'unknown',
  })
}

// =============================================================================
// HarvestService — Effect.Service
// =============================================================================

export class HarvestService extends Effect.Service<HarvestService>()(
  'prospects/HarvestService',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      return {
        /**
         * Ingest a batch of company records from a harvest source.
         *
         * Strategy:
         *   1. Fetch ALL existing slugs in one query (dedup set)
         *   2. Partition records into new vs existing in memory
         *   3. Marshal rich fields into JSON for insert
         *   4. Batch insert companies, signals, DMs
         */
        ingestBatch: (
          source: HarvestSource,
          records: ReadonlyArray<HarvestCompanyRecord>,
          query?: string
        ): Effect.Effect<HarvestResult, unknown, never> =>
          Effect.gen(function* () {
            const batchId = generateId('batch')
            const now = new Date().toISOString()

            yield* sql`
              INSERT INTO harvest_batches (id, source, query, records_found, started_at, status)
              VALUES (${batchId}, ${source}, ${query ?? null}, ${records.length}, ${now}, 'running')
            `

            // ── Step 1: fetch all existing slugs ──
            const existingRows = yield* sql<{ slug: string; id: string; description: string | null }>`
              SELECT slug, id, description FROM companies
            `
            const existingBySlug = new Map(
              existingRows.map((r) => [r.slug, { id: r.id, description: r.description }])
            )

            // ── Step 2: partition and prepare ──
            const newCompanies: Array<{ id: string; record: HarvestCompanyRecord; slug: string }> = []
            const enrichUpdates: Array<{ id: string; description: string }> = []
            const signalInserts: Array<{ companyId: string; type: string; title: string; description?: string; sourceUrl?: string; weight: number }> = []
            const dmInserts: Array<{ companyId: string; name: string; title?: string; titleLevel: string; email?: string; linkedinUrl?: string; tenure?: string }> = []

            let recordsNew = 0
            let recordsUpdated = 0
            let recordsSkipped = 0

            for (const record of records) {
              const slug = slugify(record.name)
              const existing = existingBySlug.get(slug)

              let companyId: string

              if (!existing) {
                companyId = generateId('co')
                newCompanies.push({ id: companyId, record, slug })
                existingBySlug.set(slug, { id: companyId, description: record.description ?? null })
                recordsNew++
              } else {
                companyId = existing.id
                if (record.description && !existing.description) {
                  enrichUpdates.push({ id: companyId, description: record.description })
                  recordsUpdated++
                } else {
                  recordsSkipped++
                }
              }

              if (record.signals) {
                for (const sig of record.signals) {
                  signalInserts.push({
                    companyId, type: sig.type, title: sig.title,
                    description: sig.description, sourceUrl: sig.sourceUrl,
                    weight: sig.weight ?? 1,
                  })
                }
              }

              if (record.decisionMakers) {
                for (const dm of record.decisionMakers) {
                  dmInserts.push({
                    companyId, name: dm.name, title: dm.title,
                    titleLevel: dm.titleLevel ?? 'unknown',
                    email: dm.email, linkedinUrl: dm.linkedinUrl,
                    tenure: dm.tenure,
                  })
                }
              }
            }

            // ── Step 3: batch insert new companies (with marshalled JSON) ──
            for (const { id, record: r, slug } of newCompanies) {
              yield* sql`
                INSERT INTO companies (
                  id, name, slug, industry, sub_industry,
                  location_json, size, headcount_json, revenue_json,
                  website, linkedin_url, description, capabilities_json,
                  harvest_source, harvest_date, harvest_batch_id, pipeline_stage,
                  tags_json, notes, created_at, updated_at
                ) VALUES (
                  ${id}, ${r.name}, ${slug}, ${r.industry},
                  ${r.subIndustry ?? null},
                  ${marshalLocation(r)},
                  ${r.size ?? 'unknown'},
                  ${marshalHeadcount(r)},
                  ${marshalRevenue(r)},
                  ${r.website ?? null},
                  ${r.linkedinUrl ?? null},
                  ${r.description ?? null},
                  ${null},
                  ${source}, ${now}, ${batchId}, 'harvested',
                  ${r.tags ? JSON.stringify(r.tags) : null},
                  ${r.notes ?? null}, ${now}, ${now}
                )
              `
            }

            // ── Step 4: batch enrich existing ──
            for (const { id, description } of enrichUpdates) {
              yield* sql`
                UPDATE companies SET description = ${description}, updated_at = ${now}
                WHERE id = ${id}
              `
            }

            // ── Step 5: batch insert signals ──
            for (const s of signalInserts) {
              yield* sql`
                INSERT INTO signals (
                  id, company_id, signal_type, title, description,
                  source_url, weight, detected_at, created_at
                ) VALUES (
                  ${generateId('sig')}, ${s.companyId}, ${s.type}, ${s.title},
                  ${s.description ?? null}, ${s.sourceUrl ?? null},
                  ${s.weight}, ${now}, ${now}
                )
              `
            }

            // ── Step 6: batch insert decision makers (with marshalled JSON) ──
            for (const dm of dmInserts) {
              yield* sql`
                INSERT INTO decision_makers (
                  id, name, title, title_level, company_id,
                  contacts_json, tenure_json, contract_estimate_json,
                  cip_capital, cip_interest, cip_power, cip_composite,
                  pipeline_stage, created_at, updated_at
                ) VALUES (
                  ${generateId('dm')}, ${dm.name}, ${dm.title ?? null},
                  ${dm.titleLevel}, ${dm.companyId},
                  ${marshalContacts(dm)},
                  ${marshalTenure(dm.tenure)},
                  ${null},
                  0, 0, 0, 0, 'harvested', ${now}, ${now}
                )
              `
            }

            // ── Step 7: close batch ──
            yield* sql`
              UPDATE harvest_batches
              SET records_new = ${recordsNew},
                  records_updated = ${recordsUpdated},
                  records_skipped = ${recordsSkipped},
                  completed_at = ${new Date().toISOString()},
                  status = 'completed'
              WHERE id = ${batchId}
            `

            const result: HarvestResult = {
              _tag: 'HarvestResult',
              batchId, source,
              recordsFound: records.length,
              recordsNew, recordsUpdated, recordsSkipped,
            }

            yield* Effect.logInfo(
              `[Harvest] Batch ${batchId}: ${recordsNew} new, ${recordsUpdated} updated, ${recordsSkipped} skipped (${signalInserts.length} signals, ${dmInserts.length} DMs)`
            )

            return result
          }),

        getBatchHistory: (limit: number = 20) =>
          sql<{
            id: string; source: string; query: string | null;
            recordsFound: number; recordsNew: number; status: string; startedAt: string
          }>`
            SELECT * FROM harvest_batches ORDER BY started_at DESC LIMIT ${limit}
          `,

        pipelineSummary: (): Effect.Effect<PipelineSummary, unknown, never> =>
          Effect.gen(function* () {
            const [companies, dms, signals, totalC, totalD, totalS] = yield* Effect.all([
              sql<{ stage: string; count: number }>`SELECT pipeline_stage as stage, COUNT(*) as count FROM companies GROUP BY pipeline_stage`,
              sql<{ stage: string; count: number }>`SELECT pipeline_stage as stage, COUNT(*) as count FROM decision_makers GROUP BY pipeline_stage`,
              sql<{ type: string; count: number }>`SELECT signal_type as type, COUNT(*) as count FROM signals GROUP BY signal_type ORDER BY count DESC`,
              sql<{ count: number }>`SELECT COUNT(*) as count FROM companies`,
              sql<{ count: number }>`SELECT COUNT(*) as count FROM decision_makers`,
              sql<{ count: number }>`SELECT COUNT(*) as count FROM signals`,
            ])

            return {
              _tag: 'PipelineSummary' as const,
              totalCompanies: totalC[0]?.count ?? 0,
              totalDecisionMakers: totalD[0]?.count ?? 0,
              totalSignals: totalS[0]?.count ?? 0,
              companiesByStage: companies,
              dmsByStage: dms,
              signalsByType: signals,
            }
          }),
      }
    }),
  }
) {}
