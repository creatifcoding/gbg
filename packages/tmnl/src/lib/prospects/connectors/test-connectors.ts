#!/usr/bin/env bun
/**
 * Connector Smoke Test — hit each source and report results.
 *
 * Usage:
 *   bun src/lib/prospects/connectors/test-connectors.ts
 *   bun src/lib/prospects/connectors/test-connectors.ts --source=edgar
 *   bun src/lib/prospects/connectors/test-connectors.ts --source=crunchbase
 *   bun src/lib/prospects/connectors/test-connectors.ts --source=jobs
 *
 * @module
 */

import { Effect, Console, Layer } from 'effect'
import { SECEdgarConnector } from './sec-edgar'
import { CrunchbaseConnector } from './crunchbase'
import { JobPostingConnector } from './job-postings'

const sourceArg = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1]

const testEdgar = Effect.gen(function* () {
  yield* Console.log('\n═══ SEC EDGAR ═══')
  const connector = yield* SECEdgarConnector

  const health = yield* connector.healthCheck.pipe(
    Effect.catchAll((e) => Effect.succeed({ healthy: false, latencyMs: 0, lastSuccessAt: null, errorMessage: String(e) }))
  )
  yield* Console.log(`Health: ${health.healthy ? '✓' : '✗'} (${health.latencyMs}ms)${health.errorMessage ? ` — ${health.errorMessage}` : ''}`)

  if (!health.healthy) return

  const result = yield* connector.fetch({
    query: '"digital transformation" AND "capital expenditure"',
    limit: 5,
  }).pipe(Effect.catchAll((e) => {
    return Console.log(`Fetch failed: ${String(e)}`).pipe(
      Effect.map(() => ({ records: [], totalAvailable: 0, nextPage: null }))
    )
  }))

  yield* Console.log(`Results: ${result.records.length} records (${result.totalAvailable} total available)`)
  for (const r of result.records.slice(0, 3)) {
    yield* Console.log(`  ${r.name} [${r.industry}] — ${r.signals?.[0]?.title ?? 'no signal'}`)
  }
})

const testCrunchbase = Effect.gen(function* () {
  yield* Console.log('\n═══ CRUNCHBASE ═══')
  const connector = yield* CrunchbaseConnector

  const health = yield* connector.healthCheck.pipe(
    Effect.catchAll((e) => Effect.succeed({ healthy: false, latencyMs: 0, lastSuccessAt: null, errorMessage: String(e) }))
  )
  yield* Console.log(`Health: ${health.healthy ? '✓' : '✗'} (${health.latencyMs}ms)${health.errorMessage ? ` — ${health.errorMessage}` : ''}`)

  if (!health.healthy) {
    yield* Console.log('Skipping fetch — not healthy')
    return
  }

  const result = yield* connector.fetch({
    query: 'manufacturing OR construction OR logistics',
    limit: 5,
  }).pipe(Effect.catchAll((e) => {
    return Console.log(`Fetch failed: ${String(e)}`).pipe(
      Effect.map(() => ({ records: [], totalAvailable: 0, nextPage: null }))
    )
  }))

  yield* Console.log(`Results: ${result.records.length} records`)
  for (const r of result.records.slice(0, 3)) {
    yield* Console.log(`  ${r.name} [${r.industry}] ${r.size} — ${r.signals?.[0]?.title ?? 'no signal'}`)
  }
})

const testJobs = Effect.gen(function* () {
  yield* Console.log('\n═══ JOB POSTINGS ═══')
  const connector = yield* JobPostingConnector

  const health = yield* connector.healthCheck.pipe(
    Effect.catchAll((e) => Effect.succeed({ healthy: false, latencyMs: 0, lastSuccessAt: null, errorMessage: String(e) }))
  )
  yield* Console.log(`Health: ${health.healthy ? '✓' : '✗'} (${health.latencyMs}ms)${health.errorMessage ? ` — ${health.errorMessage}` : ''}`)

  if (!health.healthy) {
    yield* Console.log('Skipping fetch — not healthy')
    return
  }

  const result = yield* connector.fetch({
    query: '"digital transformation" hiring engineer manufacturing',
    limit: 5,
  }).pipe(Effect.catchAll((e) => {
    return Console.log(`Fetch failed: ${String(e)}`).pipe(
      Effect.map(() => ({ records: [], totalAvailable: 0, nextPage: null }))
    )
  }))

  yield* Console.log(`Results: ${result.records.length} records`)
  for (const r of result.records.slice(0, 3)) {
    yield* Console.log(`  ${r.name} [${r.industry}] — ${r.signals?.[0]?.title ?? 'no signal'}`)
  }
})

// =============================================================================
// Run
// =============================================================================

const program = Effect.gen(function* () {
  yield* Console.log('🔌 Connector Smoke Test')

  if (!sourceArg || sourceArg === 'edgar') yield* testEdgar
  if (!sourceArg || sourceArg === 'crunchbase') yield* testCrunchbase
  if (!sourceArg || sourceArg === 'jobs') yield* testJobs

  yield* Console.log('\n✨ Done')
})

const AppLayer = Layer.mergeAll(
  SECEdgarConnector.Default,
  CrunchbaseConnector.Default,
  JobPostingConnector.Default,
)

Effect.runPromise(
  program.pipe(
    Effect.provide(AppLayer),
    Effect.catchAll((error) => Console.error(`❌ ${String(error)}`))
  )
).then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
