#!/usr/bin/env bun
/**
 * Quick query tool for prospect pipeline DB.
 *
 * Usage:
 *   bun src/lib/prospects/migrations/query.ts
 */

import { Effect, Console } from 'effect'
import { SqlClient } from '@effect/sql'
import { ProspectDbLayer } from '../models/sqlite-layer'

const program = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Top CIP-scored decision makers
  yield* Console.log('═══ Top Decision Makers by CIP ═══')
  const topDMs = yield* sql`
    SELECT dm.name, dm.title, dm.cip_capital, dm.cip_interest, dm.cip_power, dm.cip_composite, c.name as company
    FROM decision_makers dm
    JOIN companies c ON dm.company_id = c.id
    ORDER BY dm.cip_composite DESC
  `
  for (const dm of topDMs) {
    const d = dm as any
    yield* Console.log(
      `  ${d.cipComposite} | C:${d.cipCapital} I:${d.cipInterest} P:${d.cipPower} | ${d.name} — ${d.title ?? 'N/A'} @ ${d.company}`
    )
  }

  // Companies by industry
  yield* Console.log('\n═══ Companies by Industry ═══')
  const byIndustry = yield* sql`
    SELECT industry, COUNT(*) as count FROM companies GROUP BY industry ORDER BY count DESC
  `
  for (const row of byIndustry) {
    yield* Console.log(`  ${(row as any).count}x ${(row as any).industry}`)
  }

  // Signal distribution
  yield* Console.log('\n═══ Signals by Type ═══')
  const byType = yield* sql`
    SELECT signal_type, COUNT(*) as cnt, AVG(weight) as avg_w
    FROM signals GROUP BY signal_type ORDER BY cnt DESC
  `
  for (const row of byType) {
    const r = row as any
    yield* Console.log(`  ${r.cnt}x ${r.signalType} (avg weight: ${Number(r.avgW).toFixed(1)})`)
  }

  // Companies with highest signal weight
  yield* Console.log('\n═══ Top Companies by Signal Weight ═══')
  const topSignal = yield* sql`
    SELECT c.name, c.industry, SUM(s.weight) as tw, COUNT(s.id) as sc
    FROM companies c
    JOIN signals s ON s.company_id = c.id
    GROUP BY c.id
    ORDER BY tw DESC
    LIMIT 10
  `
  for (const row of topSignal) {
    const r = row as any
    yield* Console.log(`  ${r.tw} weight (${r.sc} signals) | ${r.name} [${r.industry}]`)
  }
})

Effect.runPromise(
  program.pipe(
    Effect.provide(ProspectDbLayer()),
    Effect.catchAll((error) => Console.error(`❌ ${String(error)}`))
  )
).then(() => process.exit(0))
