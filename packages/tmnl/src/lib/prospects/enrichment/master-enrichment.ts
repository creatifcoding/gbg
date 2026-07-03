/**
 * MasterEnrichment — Effect.Service that composes all enrichment tracks
 *
 * Execution order (dependency-driven):
 *   1. CrossSourceMerge (dedup first)
 *   2. IndustryClassification (needs clean names)
 *   3. SignalUpgrade (derives from industry + source metadata)
 *   4. CIP Rescore (needs signals updated)
 *
 * Each track is an independent Effect.Service. Master just calls them
 * in order and collects EnrichmentResults.
 *
 * @module prospects/enrichment/master-enrichment
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'
import { IndustryClassifier } from './industry-classifier'
import { SignalUpgrader } from './signal-upgrader'
import { CrossSourceMerger } from './cross-source-merger'
import { CIPScoring } from '../services/cip-scoring'
import type { EnrichmentResult } from './types'

export class MasterEnrichment extends Effect.Service<MasterEnrichment>()(
  'prospects/enrichment/MasterEnrichment',
  {
    dependencies: [
      IndustryClassifier.Default,
      SignalUpgrader.Default,
      CrossSourceMerger.Default,
      CIPScoring.Default,
    ],

    scoped: Effect.gen(function* () {
      const classifier = yield* IndustryClassifier
      const signalUpgrader = yield* SignalUpgrader
      const merger = yield* CrossSourceMerger
      const cip = yield* CIPScoring
      const sql = yield* SqlClient.SqlClient

      const runAll = () => Effect.gen(function* () {
        const t0 = Date.now()
        const results: EnrichmentResult[] = []

        yield* Effect.logInfo('[MasterEnrichment] ═══ Starting full enrichment pipeline ═══')

        // Track 1: Cross-source merge
        yield* Effect.logInfo('[MasterEnrichment] ── Track 1: Cross-Source Merge ──')
        const mergeResult = yield* merger.mergeBatch()
        results.push(mergeResult)

        // Track 2: Industry reclassification
        yield* Effect.logInfo('[MasterEnrichment] ── Track 2: Industry Classification ──')
        const classifyResult = yield* classifier.classifyBatch()
        results.push(classifyResult)

        // Track 3: Signal upgrade
        yield* Effect.logInfo('[MasterEnrichment] ── Track 3: Signal Upgrade ──')
        const signalResult = yield* signalUpgrader.upgradeBatch()
        results.push(signalResult)

        // Track 4: CIP rescore (after signals updated)
        yield* Effect.logInfo('[MasterEnrichment] ── Track 4: CIP Rescore ──')
        const cipCount = yield* cip.recalculateAll
        yield* Effect.logInfo(`[MasterEnrichment] CIP rescored ${cipCount} decision makers`)

        // Final quality snapshot
        const finalStats = yield* sql.unsafe(`
          SELECT
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE industry != 'other')::int as non_other,
            COUNT(*) FILTER (WHERE website IS NOT NULL)::int as has_website,
            COUNT(*) FILTER (WHERE headcount_json IS NOT NULL)::int as has_headcount
          FROM prospects.companies
        `) as any[]
        const sigStats = yield* sql.unsafe(`
          SELECT
            COUNT(*)::int as total,
            COUNT(*) FILTER (WHERE signal_type != 'manual_observation' AND expires_at IS NULL)::int as typed
          FROM prospects.signals
        `) as any[]
        const dmCount = yield* sql.unsafe(
          `SELECT COUNT(*)::int as n FROM prospects.decision_makers`
        ) as any[]

        const f = finalStats[0]
        const s = sigStats[0]
        const total = Number(f.total)

        const totalMs = Date.now() - t0
        const totalModified = results.reduce((sum, r) => sum + r.modified, 0)

        yield* Effect.logInfo(
          `[MasterEnrichment] ═══ Pipeline complete in ${totalMs}ms ═══\n` +
          `  Companies: ${total}\n` +
          `  Industry coverage: ${Math.round(Number(f.nonOther) / total * 1000) / 10}%\n` +
          `  Website coverage: ${Math.round(Number(f.hasWebsite) / total * 1000) / 10}%\n` +
          `  Headcount coverage: ${Math.round(Number(f.hasHeadcount) / total * 1000) / 10}%\n` +
          `  Typed signals: ${Number(s.typed)}/${Number(s.total)} (${Math.round(Number(s.typed) / Number(s.total) * 1000) / 10}%)\n` +
          `  Decision makers: ${Number(dmCount[0].n)}\n` +
          `  Total fields modified: ${totalModified}`
        )

        return {
          tracks: results,
          totalDurationMs: totalMs,
          totalModified,
          finalQuality: {
            industryCoverage: Math.round(Number(f.nonOther) / total * 1000) / 10,
            websiteCoverage: Math.round(Number(f.hasWebsite) / total * 1000) / 10,
            headcountCoverage: Math.round(Number(f.hasHeadcount) / total * 1000) / 10,
            signalQuality: Math.round(Number(s.typed) / Number(s.total) * 1000) / 10,
            dmCoverage: Math.round(Number(dmCount[0].n) / total * 10000) / 100,
          },
        }
      })

      return { runAll } as const
    }),
  }
) {}
