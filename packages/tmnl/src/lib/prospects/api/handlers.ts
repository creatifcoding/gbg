/**
 * Prospect Pipeline — API Handler Implementations
 *
 * Entity-derived groups: EntityProxyServer.layerHttpApi auto-wires handlers.
 * Hand-wired groups: HttpApiBuilder.group for harvest + pipeline.
 *
 * @module prospects/api/handlers
 */

import { Effect, Layer } from 'effect'
import { HttpApiBuilder } from '@effect/platform'
import { EntityProxyServer } from '@effect/cluster'
import { SqlClient } from '@effect/sql'
import { ProspectApi } from './contract'
import { CompanyEntity } from '../entity/CompanyEntity'
import { DecisionMakerEntity } from '../entity/DecisionMakerEntity'
import { SignalEntity } from '../entity/SignalEntity'
import { ProposalEntity } from '../entity/ProposalEntity'
import { OutreachEntity } from '../entity/OutreachEntity'
import { HarvestService } from '../services/harvest'
import { CIPScoring } from '../services/cip-scoring'

// =============================================================================
// Entity-Derived Handler Layers (auto-wired from Entity definitions)
// =============================================================================

const CompanyHandlers = EntityProxyServer.layerHttpApi(
  ProspectApi, 'companies', CompanyEntity
)

const DecisionMakerHandlers = EntityProxyServer.layerHttpApi(
  ProspectApi, 'decisionMakers', DecisionMakerEntity
)

const SignalHandlers = EntityProxyServer.layerHttpApi(
  ProspectApi, 'signals', SignalEntity
)

const ProposalHandlers = EntityProxyServer.layerHttpApi(
  ProspectApi, 'proposals', ProposalEntity
)

const OutreachHandlers = EntityProxyServer.layerHttpApi(
  ProspectApi, 'outreach', OutreachEntity
)

// =============================================================================
// Hand-Wired: Harvest (batch ingestion — not entity CRUD)
// =============================================================================

const HarvestHandlers = HttpApiBuilder.group(ProspectApi, 'harvest', (handlers) =>
  Effect.gen(function* () {
    const harvest = yield* HarvestService
    const scoring = yield* CIPScoring
    const sql = yield* SqlClient.SqlClient

    const generateId = (prefix: string) =>
      `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

    return handlers
      .handle('ingestCompanies', ({ payload }) =>
        harvest.ingestBatch(payload.source, payload.records, payload.query)
      )
      .handle('ingestSignals', ({ payload }) =>
        Effect.gen(function* () {
          // Resolve all slugs in one query
          const allCompanies = yield* sql<{ slug: string; id: string }>`
            SELECT slug, id FROM companies
          `
          const slugMap = new Map(allCompanies.map((c) => [c.slug, c.id]))

          const now = new Date().toISOString()
          let created = 0

          for (const sig of payload.signals) {
            const companyId = slugMap.get(sig.companySlug)
            if (!companyId) continue

            yield* sql`
              INSERT INTO signals (id, company_id, signal_type, title, description, source_url, weight, detected_at, created_at)
              VALUES (${generateId('sig')}, ${companyId}, ${sig.signalType}, ${sig.title},
                      ${sig.description ?? null}, ${sig.sourceUrl ?? null}, ${sig.weight ?? 1}, ${now}, ${now})
            `
            created++
          }

          return {
            _tag: 'HarvestResult' as const,
            batchId: generateId('sig-batch'),
            source: payload.source,
            recordsFound: payload.signals.length,
            recordsNew: created,
            recordsUpdated: 0,
            recordsSkipped: payload.signals.length - created,
          }
        })
      )
      .handle('ingestDecisionMakers', ({ payload }) =>
        Effect.gen(function* () {
          const allCompanies = yield* sql<{ slug: string; id: string }>`
            SELECT slug, id FROM companies
          `
          const slugMap = new Map(allCompanies.map((c) => [c.slug, c.id]))

          const now = new Date().toISOString()
          let created = 0

          for (const dm of payload.decisionMakers) {
            const companyId = slugMap.get(dm.companySlug)
            if (!companyId) continue

            yield* sql`
              INSERT INTO decision_makers (id, name, title, title_level, company_id,
                cip_capital, cip_interest, cip_power, cip_composite,
                pipeline_stage, created_at, updated_at)
              VALUES (${generateId('dm')}, ${dm.name}, ${dm.title ?? null},
                      ${dm.titleLevel ?? 'unknown'}, ${companyId},
                      0, 0, 0, 0, 'harvested', ${now}, ${now})
            `
            created++
          }

          return {
            _tag: 'HarvestResult' as const,
            batchId: generateId('dm-batch'),
            source: payload.source,
            recordsFound: payload.decisionMakers.length,
            recordsNew: created,
            recordsUpdated: 0,
            recordsSkipped: payload.decisionMakers.length - created,
          }
        })
      )
      .handle('ingestEnrichments', ({ payload }) =>
        Effect.gen(function* () {
          const allCompanies = yield* sql<{ slug: string; id: string }>`
            SELECT slug, id FROM companies
          `
          const slugMap = new Map(allCompanies.map((c) => [c.slug, c.id]))

          const now = new Date().toISOString()
          let enriched = 0

          for (const e of payload.enrichments) {
            const companyId = slugMap.get(e.companySlug)
            if (!companyId) continue

            yield* sql`
              INSERT INTO enrichments (id, company_id, source, field, new_value, confidence, enriched_at)
              VALUES (${generateId('enr')}, ${companyId}, ${payload.source},
                      ${e.field}, ${JSON.stringify(e.value)}, ${e.confidence ?? 1.0}, ${now})
            `
            enriched++
          }

          return {
            _tag: 'HarvestResult' as const,
            batchId: generateId('enr-batch'),
            source: payload.source,
            recordsFound: payload.enrichments.length,
            recordsNew: enriched,
            recordsUpdated: 0,
            recordsSkipped: payload.enrichments.length - enriched,
          }
        })
      )
      .handle('recalculateCIP', () =>
        Effect.gen(function* () {
          const updated = yield* scoring.recalculateAll
          return { updated }
        })
      )
  })
)

// =============================================================================
// Hand-Wired: Pipeline (aggregate stats)
// =============================================================================

const PipelineHandlers = HttpApiBuilder.group(ProspectApi, 'pipeline', (handlers) =>
  Effect.gen(function* () {
    const harvest = yield* HarvestService
    return handlers.handle('summary', () => harvest.pipelineSummary())
  })
)

// =============================================================================
// Combined API Implementation Layer
// =============================================================================

/**
 * Complete API implementation layer.
 *
 * Entity groups: auto-wired via EntityProxyServer.layerHttpApi
 * Harvest + Pipeline: hand-wired via HttpApiBuilder.group
 *
 * Requires: SqlClient, HarvestService, CIPScoring, Sharding (for entity proxies)
 */
export const ProspectApiLive = HttpApiBuilder.api(ProspectApi).pipe(
  // Entity-derived
  Layer.provide(CompanyHandlers),
  Layer.provide(DecisionMakerHandlers),
  Layer.provide(SignalHandlers),
  Layer.provide(ProposalHandlers),
  Layer.provide(OutreachHandlers),
  // Hand-wired
  Layer.provide(HarvestHandlers),
  Layer.provide(PipelineHandlers),
)
