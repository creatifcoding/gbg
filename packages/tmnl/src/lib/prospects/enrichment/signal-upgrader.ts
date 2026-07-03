/**
 * SignalUpgrader — Effect.Service for signal quality improvement
 *
 * Three operations:
 * 1. Derive typed signals from structured data we already have
 *    (federal contracts, SEC filings, state registry metadata)
 * 2. Reclassify valuable manual_observation signals that have
 *    rich title text into proper typed signals
 * 3. Expire stale manual_observation signals that add no value
 *
 * Uses Stream.grouped for chunked processing.
 *
 * @module prospects/enrichment/signal-upgrader
 */

import { Effect, Stream, Chunk } from 'effect'
import { SqlClient } from '@effect/sql'
import { QualitySnapshot, EnrichmentResult } from './types'

// =============================================================================
// Signal derivation rules
// =============================================================================

interface DerivedSignal {
  readonly companyId: string
  readonly signalType: string
  readonly title: string
  readonly description: string
  readonly weight: number
  readonly sourceUrl: string | null
}

/**
 * Derive signals from harvest source metadata.
 * A company's harvest_source tells us something about them:
 *   - sam_gov → has federal contracts (weight 2)
 *   - sec_edgar → publicly traded / SEC filer (weight 2)
 *   - state_license with 'automation'/'controls' tags → automation buyer (weight 1)
 */
const deriveFromSource = (row: {
  id: string; name: string; harvestSource: string;
  tagsJson: any; notes: string | null
}): DerivedSignal[] => {
  const signals: DerivedSignal[] = []

  if (row.harvestSource === 'sam_gov') {
    signals.push({
      companyId: row.id,
      signalType: 'federal_contract',
      title: `Federal contractor: ${row.name}`,
      description: 'Registered in SAM.gov federal contractor database. Has federal purchasing authority.',
      weight: 2,
      sourceUrl: 'https://sam.gov',
    })
  }

  if (row.harvestSource === 'sec_edgar') {
    signals.push({
      companyId: row.id,
      signalType: 'sec_filing',
      title: `SEC filer: ${row.name}`,
      description: 'Files with SEC (10-K, 10-Q). Publicly traded or regulated entity with disclosed financials.',
      weight: 2,
      sourceUrl: 'https://www.sec.gov/cgi-bin/browse-edgar',
    })
  }

  // Tags — PG JSONB returns parsed arrays directly
  const tags = (Array.isArray(row.tagsJson) ? row.tagsJson : []) as string[]

  if (tags.includes('automation') || tags.includes('controls')) {
    signals.push({
      companyId: row.id,
      signalType: 'tech_interest',
      title: `Automation/controls company: ${row.name}`,
      description: 'Matched automation or controls keywords in state business registry.',
      weight: 1,
      sourceUrl: null,
    })
  }

  if (tags.includes('scada') || tags.includes('telemetry')) {
    signals.push({
      companyId: row.id,
      signalType: 'tech_interest',
      title: `SCADA/telemetry company: ${row.name}`,
      description: 'Matched SCADA or telemetry keywords in state business registry.',
      weight: 2,
      sourceUrl: null,
    })
  }

  return signals
}

/**
 * Reclassify manual_observation signals with rich titles.
 * Some manual signals have titles like "Hiring Python Developer" or
 * "$350M revenue" — these should be typed properly.
 */
const reclassifyManual = (signal: {
  id: string; title: string; description: string | null
}): { newType: string; newWeight: number } | null => {
  const t = signal.title.toLowerCase()

  if (/hiring|recruit|job.*open|looking for/i.test(t))
    return { newType: 'job_posting', newWeight: 2 }
  if (/\$\d+[mkb]?\s*(revenue|contract|award|deal)/i.test(t))
    return { newType: 'contract_value', newWeight: 3 }
  if (/rfp|request for proposal|bid.*open/i.test(t))
    return { newType: 'rfp', newWeight: 3 }
  if (/acquisition|acquired|merger|merged/i.test(t))
    return { newType: 'acquisition', newWeight: 3 }
  if (/moderniz|upgrad|digital transform|iot|iiot|scada/i.test(t))
    return { newType: 'pain_admission', newWeight: 3 }
  if (/director|vp|cto|cio|president|chief/i.test(t))
    return { newType: 'leadership_change', newWeight: 2 }
  if (/certified|nwbe|mbe|wbe|dbe|set-aside/i.test(t))
    return { newType: 'certification', newWeight: 1 }

  return null
}

// =============================================================================
// Service
// =============================================================================

const CHUNK_SIZE = 200

export class SignalUpgrader extends Effect.Service<SignalUpgrader>()(
  'prospects/enrichment/SignalUpgrader',
  {
    scoped: Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient

      const measureQuality = () => Effect.gen(function* () {
        const stats = yield* sql.unsafe(`
          SELECT
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE signal_type != 'manual_observation')::int as typed,
            ROUND(AVG(weight)::numeric, 2) as avg_weight
          FROM prospects.signals
        `) as any[]
        const r = stats[0]
        return QualitySnapshot.fromCounts(
          Number(r.total), Number(r.typed), Number(r.avg_weight) / 3 // normalize weight to 0-1
        )
      })

      const upgradeBatch = () => Effect.gen(function* () {
        const t0 = Date.now()
        const before = yield* measureQuality()

        yield* Effect.logInfo(`[SignalUpgrader] Starting. ${before.filled}/${before.total} typed signals`)

        // ── Phase 1: Derive new signals from company metadata ────────
        const companies = yield* sql.unsafe(`
          SELECT id, name, harvest_source, tags_json, notes
          FROM prospects.companies
        `) as any[]

        // Get existing signal company_id + type combos to avoid dupes
        const existingKeys = new Set<string>()
        const existing = yield* sql.unsafe(
          `SELECT company_id, signal_type FROM prospects.signals`
        ) as any[]
        // transformResultNames converts snake_case → camelCase
        for (const e of existing) existingKeys.add(`${e.companyId}:${e.signalType}`)

        const derived: DerivedSignal[] = []
        for (const co of companies) {
          for (const sig of deriveFromSource(co)) {
            const key = `${sig.companyId}:${sig.signalType}`
            if (!existingKeys.has(key)) {
              derived.push(sig)
              existingKeys.add(key)
            }
          }
        }

        yield* Effect.logInfo(`[SignalUpgrader] Phase 1: ${derived.length} new typed signals to create`)

        // Write derived signals in chunks via Stream
        let derivedCreated = 0
        yield* Stream.fromIterable(derived).pipe(
          Stream.grouped(CHUNK_SIZE),
          Stream.mapEffect((chunk) => Effect.gen(function* () {
            const rows = Chunk.toReadonlyArray(chunk)
            const now = new Date().toISOString()
            for (const sig of rows) {
              const sigId = `sig-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
              yield* sql.unsafe(
                `INSERT INTO prospects.signals (id, company_id, signal_type, title, description, source_url, weight, detected_at, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
                [sigId, sig.companyId, sig.signalType, sig.title, sig.description, sig.sourceUrl, sig.weight, now]
              )
              derivedCreated++
            }
          })),
          Stream.runDrain,
        )

        // ── Phase 2: Reclassify valuable manual_observation signals ──
        const manuals = yield* sql.unsafe(`
          SELECT id, title, description FROM prospects.signals
          WHERE signal_type = 'manual_observation'
        `) as any[]

        let reclassified = 0
        const now = new Date().toISOString()
        for (const sig of manuals) {
          const upgrade = reclassifyManual(sig)
          if (upgrade) {
            yield* sql.unsafe(
              `UPDATE prospects.signals SET signal_type = $1, weight = $2 WHERE id = $3`,
              [upgrade.newType, upgrade.newWeight, sig.id]
            )
            reclassified++
          }
        }

        yield* Effect.logInfo(`[SignalUpgrader] Phase 2: ${reclassified} manual signals reclassified`)

        // ── Phase 3: Expire low-value manual_observation signals ──────
        // Signals that are just "[State] registry: [Query]" with weight 1 and
        // the company now has typed signals → expire them
        const expired = yield* sql.unsafe(`
          UPDATE prospects.signals s
          SET expires_at = $1
          WHERE s.signal_type = 'manual_observation'
            AND s.weight <= 1
            AND s.expires_at IS NULL
            AND EXISTS (
              SELECT 1 FROM prospects.signals s2
              WHERE s2.company_id = s.company_id
                AND s2.signal_type != 'manual_observation'
                AND s2.expires_at IS NULL
            )
          RETURNING id
        `, [now]) as any[]

        yield* Effect.logInfo(`[SignalUpgrader] Phase 3: ${expired.length} stale manual signals expired`)

        const after = yield* measureQuality()
        const durationMs = Date.now() - t0

        const breakdown = [
          { category: 'derived_created', count: derivedCreated },
          { category: 'manual_reclassified', count: reclassified },
          { category: 'stale_expired', count: expired.length },
        ]

        yield* Effect.logInfo(
          `[SignalUpgrader] Done in ${durationMs}ms. ` +
          `Signal quality: ${before.coverage}% → ${after.coverage}% typed`
        )

        return new EnrichmentResult({
          track: 'signal-upgrade',
          before,
          after,
          evaluated: manuals.length + companies.length,
          modified: derivedCreated + reclassified + expired.length,
          skipped: 0,
          errors: 0,
          durationMs,
          breakdown,
        })
      })

      return { upgradeBatch, measureQuality } as const
    }),
  }
) {}
