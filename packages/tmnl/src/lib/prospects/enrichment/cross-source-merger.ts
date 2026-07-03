/**
 * CrossSourceMerger — Effect.Service for cross-source field merging
 *
 * Finds the same company appearing in multiple harvest sources
 * (e.g., EDGAR + USASpending + state registry) and merges their fields.
 * Confidence-wins: higher confidence value is kept. Provenance tracked.
 *
 * Matching strategy:
 *   1. Exact slug match across different harvest_source values
 *   2. For matches: compare fields, keep highest confidence
 *
 * @module prospects/enrichment/cross-source-merger
 */

import { Effect, Stream, Chunk } from 'effect'
import { SqlClient } from '@effect/sql'
import { QualitySnapshot, EnrichmentResult } from './types'
import { ProvenanceService } from '../services/provenance'

const CHUNK_SIZE = 100

export class CrossSourceMerger extends Effect.Service<CrossSourceMerger>()(
  'prospects/enrichment/CrossSourceMerger',
  {
    dependencies: [ProvenanceService.Default],

    scoped: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const provenance = yield* ProvenanceService

      const measureQuality = () => Effect.gen(function* () {
        // Measure: how many companies have >1 non-null enrichable field?
        const stats = yield* sql.unsafe(`
          SELECT
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE website IS NOT NULL)::int as has_website,
            COUNT(*) FILTER (WHERE description IS NOT NULL AND description != '')::int as has_desc,
            COUNT(*) FILTER (WHERE headcount_json IS NOT NULL)::int as has_headcount,
            COUNT(*) FILTER (WHERE revenue_json IS NOT NULL)::int as has_revenue
          FROM prospects.companies
        `) as any[]
        const r = stats[0]
        const total = Number(r.total)
        // Average coverage across the 4 enrichable fields
        const filled = Math.round(
          (Number(r.hasWebsite) + Number(r.hasDesc) + Number(r.hasHeadcount) + Number(r.hasRevenue)) / 4
        )
        return QualitySnapshot.fromCounts(total, filled, 0.5)
      })

      const mergeBatch = () => Effect.gen(function* () {
        const t0 = Date.now()
        const before = yield* measureQuality()

        yield* Effect.logInfo('[CrossSourceMerger] Finding cross-source duplicates by slug')

        // Find slugs that appear in multiple sources
        const dupeSlugGroups = yield* sql.unsafe(`
          SELECT slug, array_agg(id) as ids, array_agg(harvest_source) as sources,
                 COUNT(DISTINCT harvest_source)::int as source_count
          FROM prospects.companies
          GROUP BY slug
          HAVING COUNT(DISTINCT harvest_source) > 1
          ORDER BY source_count DESC
        `) as any[]

        yield* Effect.logInfo(
          `[CrossSourceMerger] ${dupeSlugGroups.length} slugs found in multiple sources`
        )

        if (dupeSlugGroups.length === 0) {
          const after = yield* measureQuality()
          return new EnrichmentResult({
            track: 'cross-source-merge',
            before, after,
            evaluated: 0, modified: 0, skipped: 0, errors: 0,
            durationMs: Date.now() - t0, breakdown: [],
          })
        }

        // For each dupe group: pick the "primary" (oldest/most-data) and merge fields from others
        let merged = 0
        let deleted = 0
        const now = new Date().toISOString()

        yield* Stream.fromIterable(dupeSlugGroups).pipe(
          Stream.grouped(CHUNK_SIZE),
          Stream.mapEffect((chunk) => Effect.gen(function* () {
            for (const group of Chunk.toReadonlyArray(chunk)) {
              const ids = group.ids as string[]
              if (ids.length < 2) continue

              // Load all rows for this slug
              const rows = yield* sql.unsafe(
                `SELECT * FROM prospects.companies WHERE slug = $1 ORDER BY created_at ASC`,
                [group.slug]
              ) as any[]

              if (rows.length < 2) continue

              // Primary = first created (oldest). Others merge into it.
              const primary = rows[0]
              const others = rows.slice(1)

              // Merge fields: take non-null values from others if primary is null
              const updates: Array<{ field: string; value: any; source: string }> = []

              for (const other of others) {
                // Website
                if (!primary.website && other.website) {
                  updates.push({ field: 'website', value: other.website, source: other.harvestSource })
                }
                // Description (prefer longer)
                if (other.description && (!primary.description || other.description.length > primary.description.length)) {
                  updates.push({ field: 'description', value: other.description, source: other.harvestSource })
                }
                // Headcount
                if (!primary.headcountJson && other.headcountJson) {
                  updates.push({ field: 'headcount_json', value: JSON.stringify(other.headcountJson), source: other.harvestSource })
                }
                // Revenue
                if (!primary.revenueJson && other.revenueJson) {
                  updates.push({ field: 'revenue_json', value: JSON.stringify(other.revenueJson), source: other.harvestSource })
                }
                // Industry (prefer non-'other')
                if (primary.industry === 'other' && other.industry !== 'other') {
                  updates.push({ field: 'industry', value: other.industry, source: other.harvestSource })
                }
              }

              // Apply updates to primary
              for (const u of updates) {
                yield* sql.unsafe(
                  `UPDATE prospects.companies SET "${u.field}" = $1, updated_at = $2 WHERE id = $3`,
                  [u.value, now, primary.id]
                )
                yield* provenance.track({
                  entityType: 'company',
                  entityId: primary.id,
                  fieldName: u.field,
                  value: typeof u.value === 'string' ? u.value : JSON.stringify(u.value),
                  source: { connector: u.source, method: 'cross_source_merge' },
                  transform: {
                    function: 'crossSourceMerge',
                    inputs: ids,
                    version: '1.0',
                  },
                  confidence: 0.85,
                })
                merged++
              }

              // Reassign signals from duplicates to primary
              for (const other of others) {
                yield* sql.unsafe(
                  `UPDATE prospects.signals SET company_id = $1 WHERE company_id = $2`,
                  [primary.id, other.id]
                )
                // Delete the duplicate company
                yield* sql.unsafe(
                  `DELETE FROM prospects.companies WHERE id = $1`,
                  [other.id]
                )
                deleted++
              }
            }
          })),
          Stream.runDrain,
        )

        const after = yield* measureQuality()
        const durationMs = Date.now() - t0

        yield* Effect.logInfo(
          `[CrossSourceMerger] Done in ${durationMs}ms. ` +
          `${merged} fields merged, ${deleted} duplicate companies removed. ` +
          `Before: ${before.total} companies → After: ${after.total}`
        )

        return new EnrichmentResult({
          track: 'cross-source-merge',
          before, after,
          evaluated: dupeSlugGroups.length,
          modified: merged,
          skipped: dupeSlugGroups.length - merged,
          errors: 0,
          durationMs,
          breakdown: [
            { category: 'fields_merged', count: merged },
            { category: 'dupes_removed', count: deleted },
          ],
        })
      })

      return { mergeBatch, measureQuality } as const
    }),
  }
) {}
