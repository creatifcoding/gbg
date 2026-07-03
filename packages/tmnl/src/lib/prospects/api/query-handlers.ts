/**
 * Prospect Pipeline — Query Handlers
 *
 * HttpApiBuilder.group implementations for stateless query endpoints.
 * Direct SQL via repository services — NOT through entity cluster.
 *
 * @module prospects/api/query-handlers
 */

import { HttpApiBuilder } from '@effect/platform'
import { Effect, Layer } from 'effect'
import { SqlClient } from '@effect/sql'
import { ProspectApi } from './contract'
import { CompanyRepository, DecisionMakerRepository, SignalRepository } from '../services/repositories'

// =============================================================================
// Company Query Handlers
// =============================================================================

const CompanyQueryHandlers = HttpApiBuilder.group(ProspectApi, 'company-queries', (handlers) =>
  handlers
    .handle('searchCompanies', ({ urlParams }) =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const rows = yield* repo.search(urlParams.q)
        return rows.map((r: any) => ({
          id: r.id, name: r.name, slug: r.slug, industry: r.industry,
          subIndustry: r.subIndustry ?? null, size: r.size,
          pipelineStage: r.pipelineStage, website: r.website ?? null,
          description: r.description ?? null,
        }))
      })
    )
    .handle('companiesByIndustry', ({ urlParams }) =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const rows = yield* repo.findByIndustry(urlParams.industry)
        return rows.map((r: any) => ({
          id: r.id, name: r.name, slug: r.slug, industry: r.industry,
          subIndustry: r.subIndustry ?? null, size: r.size,
          pipelineStage: r.pipelineStage, website: r.website ?? null,
          description: r.description ?? null,
        }))
      })
    )
    .handle('companiesByStage', ({ urlParams }) =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const rows = yield* repo.findByStage(urlParams.stage)
        return rows.map((r: any) => ({
          id: r.id, name: r.name, slug: r.slug, industry: r.industry,
          subIndustry: r.subIndustry ?? null, size: r.size,
          pipelineStage: r.pipelineStage, website: r.website ?? null,
          description: r.description ?? null,
        }))
      })
    )
    .handle('companyCountBySource', () =>
      Effect.gen(function* () {
        const repo = yield* CompanyRepository
        const rows = yield* repo.countBySource()
        return rows.map((r: any) => ({ source: r.source, count: Number(r.count) }))
      })
    )
)

// =============================================================================
// DM Query Handlers
// =============================================================================

const DMQueryHandlers = HttpApiBuilder.group(ProspectApi, 'dm-queries', (handlers) =>
  handlers
    .handle('topCIP', ({ urlParams }) =>
      Effect.gen(function* () {
        const repo = yield* DecisionMakerRepository
        const limit = urlParams.limit ?? 25
        const rows = yield* repo.topByCIP(limit)
        return rows.map((r: any) => ({
          id: r.id, name: r.name, title: r.title ?? null,
          titleLevel: r.titleLevel, companyId: r.companyId,
          cipCapital: r.cipCapital, cipInterest: r.cipInterest,
          cipPower: r.cipPower, cipComposite: r.cipComposite,
          pipelineStage: r.pipelineStage,
        }))
      })
    )
    .handle('readyForOutreach', ({ urlParams }) =>
      Effect.gen(function* () {
        const repo = yield* DecisionMakerRepository
        const minCip = urlParams.minCip ?? 5.0
        const rows = yield* repo.readyForOutreach(minCip)
        return rows.map((r: any) => ({
          id: r.id, name: r.name, title: r.title ?? null,
          titleLevel: r.titleLevel, companyId: r.companyId,
          cipCapital: r.cipCapital, cipInterest: r.cipInterest,
          cipPower: r.cipPower, cipComposite: r.cipComposite,
          pipelineStage: r.pipelineStage,
        }))
      })
    )
)

// =============================================================================
// Signal Query Handlers
// =============================================================================

const SignalQueryHandlers = HttpApiBuilder.group(ProspectApi, 'signal-queries', (handlers) =>
  handlers
    .handle('recentSignals', ({ urlParams }) =>
      Effect.gen(function* () {
        const repo = yield* SignalRepository
        const limit = urlParams.limit ?? 50
        const rows = yield* repo.recent(limit)
        return rows.map((r: any) => ({
          id: r.id, companyId: r.companyId,
          decisionMakerId: r.decisionMakerId ?? null,
          signalType: r.signalType, title: r.title,
          description: r.description ?? null,
          sourceUrl: r.sourceUrl ?? null,
          weight: r.weight,
          detectedAt: typeof r.detectedAt === 'string' ? r.detectedAt : r.detectedAt?.toISOString?.() ?? '',
        }))
      })
    )
    .handle('signalWeightByCompany', () =>
      Effect.gen(function* () {
        const repo = yield* SignalRepository
        return yield* repo.weightByCompany()
      })
    )
)

// =============================================================================
// Pipeline Query Handlers
// =============================================================================

const PipelineQueryHandlers = HttpApiBuilder.group(ProspectApi, 'pipeline-queries', (handlers) =>
  handlers
    .handle('pipelineSummary', () =>
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient
        const [companies, signals, dms, outreach, proposals, provenance, byStage, bySource, byIndustry] = yield* Effect.all([
          sql<{ n: number }>`SELECT COUNT(*) as n FROM prospects.companies`,
          sql<{ n: number }>`SELECT COUNT(*) as n FROM prospects.signals`,
          sql<{ n: number }>`SELECT COUNT(*) as n FROM prospects.decision_makers`,
          sql<{ n: number }>`SELECT COUNT(*) as n FROM prospects.outreach`,
          sql<{ n: number }>`SELECT COUNT(*) as n FROM prospects.proposals`,
          sql<{ n: number }>`SELECT COUNT(*) as n FROM prospects.field_provenance`,
          sql<{ stage: string; count: number }>`SELECT pipeline_stage as stage, COUNT(*) as count FROM prospects.companies GROUP BY pipeline_stage ORDER BY count DESC`,
          sql<{ source: string; count: number }>`SELECT harvest_source as source, COUNT(*) as count FROM prospects.companies GROUP BY harvest_source ORDER BY count DESC`,
          sql<{ industry: string; count: number }>`SELECT industry, COUNT(*) as count FROM prospects.companies GROUP BY industry ORDER BY count DESC LIMIT 15`,
        ])
        return {
          totalCompanies: Number((companies[0] as any).n),
          totalSignals: Number((signals[0] as any).n),
          totalDMs: Number((dms[0] as any).n),
          totalOutreach: Number((outreach[0] as any).n),
          totalProposals: Number((proposals[0] as any).n),
          totalProvenance: Number((provenance[0] as any).n),
          companiesByStage: (byStage as any[]).map((r: any) => ({ stage: r.stage, count: Number(r.count) })),
          companiesBySource: (bySource as any[]).map((r: any) => ({ source: r.source, count: Number(r.count) })),
          companiesByIndustry: (byIndustry as any[]).map((r: any) => ({ industry: r.industry, count: Number(r.count) })),
        }
      })
    )
)

// =============================================================================
// Combined Query Handlers Layer
// =============================================================================

export const QueryHandlers = Layer.mergeAll(
  CompanyQueryHandlers,
  DMQueryHandlers,
  SignalQueryHandlers,
  PipelineQueryHandlers,
)
