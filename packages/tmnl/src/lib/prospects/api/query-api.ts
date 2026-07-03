/**
 * Prospect Pipeline — Query HttpApiGroups
 *
 * Manual HttpApiGroup definitions for stateless queries that
 * are NOT entity-derived. Direct SQL via repositories.
 *
 * @module prospects/api/query-api
 */

import { HttpApiEndpoint, HttpApiGroup } from '@effect/platform'
import { Schema } from 'effect'
import { CompanyView } from '../entity/CompanyEntity'
import { DecisionMakerView } from '../entity/DecisionMakerEntity'
import { SignalView } from '../entity/SignalEntity'

// =============================================================================
// Company Queries
// =============================================================================

const SearchCompaniesEndpoint = HttpApiEndpoint.get('searchCompanies', '/queries/companies/search')
  .setUrlParams(Schema.Struct({ q: Schema.String }))
  .addSuccess(Schema.Array(CompanyView))

const CompaniesByIndustryEndpoint = HttpApiEndpoint.get('companiesByIndustry', '/queries/companies/by-industry')
  .setUrlParams(Schema.Struct({ industry: Schema.String }))
  .addSuccess(Schema.Array(CompanyView))

const CompaniesByStageEndpoint = HttpApiEndpoint.get('companiesByStage', '/queries/companies/by-stage')
  .setUrlParams(Schema.Struct({ stage: Schema.String }))
  .addSuccess(Schema.Array(CompanyView))

const CompanyCountBySourceEndpoint = HttpApiEndpoint.get('companyCountBySource', '/queries/companies/count-by-source')
  .addSuccess(Schema.Array(Schema.Struct({ source: Schema.String, count: Schema.Number })))

// =============================================================================
// Decision Maker Queries
// =============================================================================

const TopCIPEndpoint = HttpApiEndpoint.get('topCIP', '/queries/dms/top-cip')
  .setUrlParams(Schema.Struct({ limit: Schema.optional(Schema.NumberFromString) }))
  .addSuccess(Schema.Array(DecisionMakerView))

const ReadyForOutreachEndpoint = HttpApiEndpoint.get('readyForOutreach', '/queries/dms/ready-for-outreach')
  .setUrlParams(Schema.Struct({ minCip: Schema.optional(Schema.NumberFromString) }))
  .addSuccess(Schema.Array(DecisionMakerView))

// =============================================================================
// Signal Queries
// =============================================================================

const RecentSignalsEndpoint = HttpApiEndpoint.get('recentSignals', '/queries/signals/recent')
  .setUrlParams(Schema.Struct({ limit: Schema.optional(Schema.NumberFromString) }))
  .addSuccess(Schema.Array(SignalView))

const SignalWeightByCompanyEndpoint = HttpApiEndpoint.get('signalWeightByCompany', '/queries/signals/weight-by-company')
  .addSuccess(Schema.Array(Schema.Struct({
    companyId: Schema.String,
    totalWeight: Schema.Number,
    signalCount: Schema.Number,
  })))

// =============================================================================
// Pipeline Summary
// =============================================================================

const PipelineSummaryEndpoint = HttpApiEndpoint.get('pipelineSummary', '/queries/pipeline/summary')
  .addSuccess(Schema.Struct({
    totalCompanies: Schema.Number,
    totalSignals: Schema.Number,
    totalDMs: Schema.Number,
    totalOutreach: Schema.Number,
    totalProposals: Schema.Number,
    totalProvenance: Schema.Number,
    companiesByStage: Schema.Array(Schema.Struct({ stage: Schema.String, count: Schema.Number })),
    companiesBySource: Schema.Array(Schema.Struct({ source: Schema.String, count: Schema.Number })),
    companiesByIndustry: Schema.Array(Schema.Struct({ industry: Schema.String, count: Schema.Number })),
  }))

// =============================================================================
// Exported Groups
// =============================================================================

export const CompanyQueryGroup = HttpApiGroup.make('company-queries')
  .add(SearchCompaniesEndpoint)
  .add(CompaniesByIndustryEndpoint)
  .add(CompaniesByStageEndpoint)
  .add(CompanyCountBySourceEndpoint)

export const DMQueryGroup = HttpApiGroup.make('dm-queries')
  .add(TopCIPEndpoint)
  .add(ReadyForOutreachEndpoint)

export const SignalQueryGroup = HttpApiGroup.make('signal-queries')
  .add(RecentSignalsEndpoint)
  .add(SignalWeightByCompanyEndpoint)

export const PipelineQueryGroup = HttpApiGroup.make('pipeline-queries')
  .add(PipelineSummaryEndpoint)
