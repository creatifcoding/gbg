/**
 * IndustryClassifier — Effect.Service for industry reclassification
 *
 * Reads companies tagged 'other' via Stream, classifies in chunks,
 * writes results back via SQL, tracks provenance.
 *
 * Data flow:
 *   SQL query → Stream.fromIterableEffect
 *     → Stream.grouped(100) (chunk into batches)
 *       → Stream.mapEffect (classify + write each chunk)
 *         → Stream.runFold (accumulate results)
 *
 * @module prospects/enrichment/industry-classifier
 */

import { Effect, Stream, Chunk } from 'effect'
import { SqlClient } from '@effect/sql'
import { classifyIndustry } from './industry-maps'
import { QualitySnapshot, EnrichmentResult } from './types'
import { ProvenanceService } from '../services/provenance'

// =============================================================================
// Types
// =============================================================================

interface CompanyRow {
  readonly id: string
  readonly name: string
  readonly description: string | null
  readonly industry: string
  readonly notes: string | null
  readonly tags_json: string | null
}

interface ClassificationHit {
  readonly companyId: string
  readonly oldIndustry: string
  readonly newIndustry: string
  readonly confidence: number
  readonly method: string
}

// =============================================================================
// Service
// =============================================================================

const CHUNK_SIZE = 100

export class IndustryClassifier extends Effect.Service<IndustryClassifier>()(
  'prospects/enrichment/IndustryClassifier',
  {
    dependencies: [ProvenanceService.Default],

    scoped: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient
      const provenance = yield* ProvenanceService

      // ── Quality measurement ────────────────────────────────────────
      const measureQuality = () => Effect.gen(function* () {
          const stats = yield* sql.unsafe(`
            SELECT
              COUNT(*)::int as total,
              COUNT(*) FILTER (WHERE industry != 'other')::int as filled,
              COALESCE(AVG(fp.confidence), 0) as avg_conf
            FROM prospects.companies c
            LEFT JOIN prospects.field_provenance fp
              ON fp.entity_type = 'company' AND fp.entity_id = c.id AND fp.field_name = 'industry'
          `) as any[]
          const r = stats[0]
          return QualitySnapshot.fromCounts(
            Number(r.total), Number(r.filled), Number(r.avg_conf)
          )
        }
      )

      // ── Extract query hints from structured notes ──────────────────
      const extractQueryHint = (notes: string | null): string | null => {
        if (!notes || !notes.startsWith('{')) return null
        try {
          const parsed = JSON.parse(notes)
          return parsed.queryId ?? parsed.queryLabel ?? null
        } catch { return null }
      }

      // ── Classify a single company ──────────────────────────────────
      const classifyOne = (row: CompanyRow): ClassificationHit | null => {
        // Extract any NAICS-like hint from tags
        const tags = (() => {
          try { return row.tags_json ? JSON.parse(row.tags_json) : [] }
          catch { return [] }
        })() as string[]

        const queryHint = extractQueryHint(row.notes)

        const result = classifyIndustry({
          name: row.name,
          description: row.description,
          // Tags like ["automation", "controls"] inform classification
          entityType: tags.filter(t => t !== 'state-registry' && t.length > 2).join(' '),
        })

        if (!result) return null

        return {
          companyId: row.id,
          oldIndustry: row.industry,
          newIndustry: result.industry,
          confidence: result.confidence,
          method: result.method,
        }
      }

      // ── Write a chunk of classifications to PG ─────────────────────
      const writeChunk = (hits: ReadonlyArray<ClassificationHit>) => Effect.gen(function* () {
          if (hits.length === 0) return

          const now = new Date().toISOString()

          // Batch UPDATE via unnest — single SQL statement for the whole chunk
          const ids = hits.map(h => h.companyId)
          const industries = hits.map(h => h.newIndustry)

          yield* sql.unsafe(`
            UPDATE prospects.companies c
            SET industry = v.industry, updated_at = $3
            FROM unnest($1::text[], $2::text[]) AS v(id, industry)
            WHERE c.id = v.id
          `, [ids, industries, now])

          // Provenance — batch write
          yield* provenance.trackBatch(
            hits.map(h => ({
              entityType: 'company' as const,
              entityId: h.companyId,
              fieldName: 'industry',
              value: h.newIndustry,
              source: { connector: 'enrichment', method: h.method },
              transform: {
                function: 'classifyIndustry',
                inputs: ['name', 'description', 'tags'],
                version: '2.0',
              },
              confidence: h.confidence,
            }))
          )
        }
      )

      // ── Main batch classification ──────────────────────────────────
      const classifyBatch = () => Effect.gen(function* () {
          const t0 = Date.now()
          const before = yield* measureQuality()

          yield* Effect.logInfo(
            `[IndustryClassifier] Starting. Before: ${before.coverage}% industry coverage`
          )

          // Stream: SQL query → chunk → classify → write
          const companies = yield* sql.unsafe(
            `SELECT id, name, description, industry, notes, tags_json
             FROM prospects.companies WHERE industry = 'other'`
          ) as CompanyRow[]

          yield* Effect.logInfo(`[IndustryClassifier] ${companies.length} companies to evaluate`)

          // Process via Stream in chunks
          const stats = yield* Stream.fromIterable(companies).pipe(
            // Chunk into batches of CHUNK_SIZE
            Stream.grouped(CHUNK_SIZE),
            // Classify each chunk
            Stream.mapEffect((chunk) =>
              Effect.gen(function* () {
                const rows = Chunk.toReadonlyArray(chunk)
                const hits = rows.map(classifyOne).filter((h): h is ClassificationHit => h !== null)

                if (hits.length > 0) {
                  yield* writeChunk(hits)
                }

                return {
                  evaluated: rows.length,
                  modified: hits.length,
                  skipped: rows.length - hits.length,
                  breakdown: hits.reduce((acc, h) => {
                    acc.set(h.newIndustry, (acc.get(h.newIndustry) ?? 0) + 1)
                    return acc
                  }, new Map<string, number>()),
                }
              }),
              { concurrency: 1 } // Sequential chunks — ordered writes
            ),
            // Fold all chunk results into one
            Stream.runFold(
              { evaluated: 0, modified: 0, skipped: 0, errors: 0, breakdown: new Map<string, number>() },
              (acc, chunk) => ({
                evaluated: acc.evaluated + chunk.evaluated,
                modified: acc.modified + chunk.modified,
                skipped: acc.skipped + chunk.skipped,
                errors: acc.errors,
                breakdown: (() => {
                  const merged = new Map(acc.breakdown)
                  for (const [k, v] of chunk.breakdown) {
                    merged.set(k, (merged.get(k) ?? 0) + v)
                  }
                  return merged
                })(),
              })
            ),
          )

          const after = yield* measureQuality()
          const durationMs = Date.now() - t0

          const breakdown = Array.from(stats.breakdown.entries())
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count)

          yield* Effect.logInfo(
            `[IndustryClassifier] Done in ${durationMs}ms. ` +
            `${stats.modified}/${stats.evaluated} reclassified. ` +
            `Coverage: ${before.coverage}% → ${after.coverage}%`
          )

          return new EnrichmentResult({
            track: 'industry-classification',
            before,
            after,
            evaluated: stats.evaluated,
            modified: stats.modified,
            skipped: stats.skipped,
            errors: stats.errors,
            durationMs,
            breakdown,
          })
        }
      )

      return { classifyOne, classifyBatch, measureQuality } as const
    }),
  }
) {}
