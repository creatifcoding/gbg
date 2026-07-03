#!/usr/bin/env bun
/**
 * Harvest Run — Execute connectors and ingest into pipeline DB.
 *
 * Usage:
 *   bun src/lib/prospects/connectors/harvest-run.ts
 *   bun src/lib/prospects/connectors/harvest-run.ts --source=edgar
 *   bun src/lib/prospects/connectors/harvest-run.ts --source=all
 *
 * @module
 */

import { Effect, Console, Layer } from 'effect'
import { SECEdgarConnector } from './sec-edgar'
import { CrunchbaseConnector } from './crunchbase'
import { JobPostingConnector } from './job-postings'
import { USASpendingConnector } from './usa-spending'
import { WebScraperConnector } from './web-scraper'
import { OpenDataConnector } from './open-data'
import { StateRegistryConnector } from './state-registry'
import { HarvestService } from '../services/harvest'
import { CIPScoring } from '../services/cip-scoring'
import { ProspectDbLayer } from '../models/sqlite-layer'

const sourceArg = process.argv.find((a) => a.startsWith('--source='))?.split('=')[1] ?? 'all'

const harvestEdgar = Effect.gen(function* () {
  yield* Console.log('\n═══ Harvesting: SEC EDGAR ═══')
  const connector = yield* SECEdgarConnector
  const harvest = yield* HarvestService

  const result = yield* connector.fetchAll({
    maxPages: 5,
    since: '2025-01-01',
  })

  yield* Console.log(`  Fetched: ${result.records.length} companies from ${result.totalAvailable} total filings`)

  if (result.records.length > 0) {
    const ingested = yield* harvest.ingestBatch('sec_edgar', result.records, 'EDGAR digital transformation + capex scan')
    yield* Console.log(`  Ingested: ${ingested.recordsNew} new, ${ingested.recordsSkipped} skipped`)
  }
})

const harvestCrunchbase = Effect.gen(function* () {
  yield* Console.log('\n═══ Harvesting: Crunchbase ═══')
  const connector = yield* CrunchbaseConnector

  const health = yield* connector.healthCheck.pipe(
    Effect.catchAll(() => Effect.succeed({ healthy: false, latencyMs: 0, lastSuccessAt: null, errorMessage: 'Not configured' }))
  )
  if (!health.healthy) {
    yield* Console.log(`  Skipped — ${health.errorMessage ?? 'unhealthy'}`)
    return
  }

  const harvest = yield* HarvestService
  const result = yield* connector.fetchAll({ maxPages: 2 })
  yield* Console.log(`  Fetched: ${result.records.length} companies`)

  if (result.records.length > 0) {
    const ingested = yield* harvest.ingestBatch('crunchbase', result.records, 'Crunchbase industrial/construction/logistics scan')
    yield* Console.log(`  Ingested: ${ingested.recordsNew} new, ${ingested.recordsSkipped} skipped`)
  }
})

const harvestUSASpending = Effect.gen(function* () {
  yield* Console.log('\n═══ Harvesting: USASpending.gov ═══')
  const connector = yield* USASpendingConnector
  const harvest = yield* HarvestService

  const result = yield* connector.fetchAll({
    maxPages: 3,
    since: '2025-01-01',
  }).pipe(Effect.catchAll((e) => {
    return Console.log(`  Error: ${String(e)}`).pipe(
      Effect.map(() => ({ records: [] as any[], totalAvailable: 0, nextPage: null }))
    )
  }))

  yield* Console.log(`  Fetched: ${result.records.length} companies from federal awards`)

  if (result.records.length > 0) {
    const ingested = yield* harvest.ingestBatch('sam_gov', result.records, 'USASpending SCADA/DT/automation contract awards')
    yield* Console.log(`  Ingested: ${ingested.recordsNew} new, ${ingested.recordsSkipped} skipped`)
  }
})

const harvestWebScraper = Effect.gen(function* () {
  yield* Console.log('\n═══ Harvesting: Web Scraper (Thomasnet) ═══')
  const connector = yield* WebScraperConnector
  const harvest = yield* HarvestService

  const result = yield* connector.fetchAll({}).pipe(
    Effect.catchAll((e) => {
      return Console.log(`  Error: ${String(e)}`).pipe(
        Effect.map(() => ({ records: [] as any[], totalAvailable: 0, nextPage: null }))
      )
    })
  )

  yield* Console.log(`  Fetched: ${result.records.length} companies from web scraping`)

  if (result.records.length > 0) {
    const ingested = yield* harvest.ingestBatch('thomasnet', result.records, 'Thomasnet category scrape')
    yield* Console.log(`  Ingested: ${ingested.recordsNew} new, ${ingested.recordsSkipped} skipped`)
  }
})

const harvestOpenData = Effect.gen(function* () {
  yield* Console.log('\n═══ Harvesting: Open Data Portals (State Registries) ═══')
  const connector = yield* OpenDataConnector
  const harvest = yield* HarvestService

  const result = yield* connector.fetchAll({}).pipe(
    Effect.catchAll((e) => {
      return Console.log(`  Error: ${String(e)}`).pipe(
        Effect.map(() => ({ records: [] as any[], totalAvailable: 0, nextPage: null }))
      )
    })
  )

  yield* Console.log(`  Fetched: ${result.records.length} matching companies from ${result.totalAvailable} total entities`)

  if (result.records.length > 0) {
    const ingested = yield* harvest.ingestBatch('state_license', result.records, 'State registry open data portal scan')
    yield* Console.log(`  Ingested: ${ingested.recordsNew} new, ${ingested.recordsSkipped} skipped`)
  }
})

const harvestJobs = Effect.gen(function* () {
  yield* Console.log('\n═══ Harvesting: Job Postings ═══')
  const connector = yield* JobPostingConnector

  const health = yield* connector.healthCheck.pipe(
    Effect.catchAll(() => Effect.succeed({ healthy: false, latencyMs: 0, lastSuccessAt: null, errorMessage: 'Not configured' }))
  )
  if (!health.healthy) {
    yield* Console.log(`  Skipped — ${health.errorMessage ?? 'unhealthy'}`)
    return
  }

  const harvest = yield* HarvestService
  const result = yield* connector.fetchAll({ maxPages: 3 })
  yield* Console.log(`  Fetched: ${result.records.length} job postings`)

  if (result.records.length > 0) {
    const ingested = yield* harvest.ingestBatch('web_search', result.records, 'Job posting signal scan')
    yield* Console.log(`  Ingested: ${ingested.recordsNew} new, ${ingested.recordsSkipped} skipped`)
  }
})

// =============================================================================
// Main
// =============================================================================

const program = Effect.gen(function* () {
  yield* Console.log('🌾 Prospect Harvest Run')
  yield* Console.log(`   Source: ${sourceArg}`)

  if (sourceArg === 'edgar' || sourceArg === 'all') yield* harvestEdgar
  if (sourceArg === 'spending' || sourceArg === 'all') yield* harvestUSASpending
  if (sourceArg === 'scraper' || sourceArg === 'all') yield* harvestWebScraper
  if (sourceArg === 'opendata' || sourceArg === 'all') yield* harvestOpenData
  if (sourceArg === 'crunchbase' || sourceArg === 'all') yield* harvestCrunchbase
  if (sourceArg === 'jobs' || sourceArg === 'all') yield* harvestJobs

  // Recalculate CIP after harvest
  yield* Console.log('\n═══ Recalculating CIP ═══')
  const scoring = yield* CIPScoring
  const updated = yield* scoring.recalculateAll
  yield* Console.log(`  Scored: ${updated} decision makers`)

  // Summary
  const harvest = yield* HarvestService
  const summary = yield* harvest.pipelineSummary()
  yield* Console.log(`\n📋 Pipeline: ${summary.totalCompanies} companies, ${summary.totalDecisionMakers} DMs, ${summary.totalSignals} signals`)
})

const AppLayer = Layer.mergeAll(
  SECEdgarConnector.Default,
  CrunchbaseConnector.Default,
  JobPostingConnector.Default,
  USASpendingConnector.Default,
  WebScraperConnector.Default,
  OpenDataConnector.Default,
  HarvestService.Default,
  CIPScoring.Default,
).pipe(Layer.provideMerge(ProspectDbLayer()))

Effect.runPromise(
  program.pipe(
    Effect.provide(AppLayer),
    Effect.catchAll((error) => Console.error(`❌ ${String(error)}`))
  )
).then(() => { console.log('\n✨ Harvest complete!'); process.exit(0) })
  .catch((e) => { console.error(e); process.exit(1) })
