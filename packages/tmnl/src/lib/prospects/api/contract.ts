/**
 * Prospect Pipeline — HttpApi Contract
 *
 * Composes all 5 entity HttpApiGroups + 4 query groups into a single HttpApi.
 * EntityProxy.toHttpApiGroup() auto-generates POST endpoints for every RPC.
 *
 * Generated endpoint pattern:
 *   POST /api/{domain}/{rpcTag}/:entityId
 *
 * Query endpoint pattern:
 *   GET /api/queries/{domain}/{operation}?params
 *
 * @module prospects/api/contract
 */

import { EntityProxy } from '@effect/cluster'
import { HttpApi } from '@effect/platform'
import { OpenApi } from '@effect/platform'

// Entities
import { CompanyEntity } from '../entity/CompanyEntity'
import { DecisionMakerEntity } from '../entity/DecisionMakerEntity'
import { SignalEntity } from '../entity/SignalEntity'
import { ProposalEntity } from '../entity/ProposalEntity'
import { OutreachEntity } from '../entity/OutreachEntity'

// Query groups
import {
  CompanyQueryGroup,
  DMQueryGroup,
  SignalQueryGroup,
  PipelineQueryGroup,
} from './query-api'

// =============================================================================
// Prospect Pipeline HttpApi
// =============================================================================

/**
 * Combined Prospect Pipeline HttpApi
 *
 * 5 entity domains exposed as REST endpoints:
 *
 * Companies:
 *   POST /api/companies/{Create|Get|UpdateStage|Enrich}/:entityId
 *
 * Decision Makers:
 *   POST /api/dms/{Create|Get|RecalculateCIP|UpdateContacts|SetContractEstimate|UpdateStage}/:entityId
 *
 * Signals:
 *   POST /api/signals/{Create|Get|AttachToDM|Expire}/:entityId
 *
 * Proposals:
 *   POST /api/proposals/{Create|Get|DraftSection|AdvanceStatus|SetEstimate|SetCapabilities}/:entityId
 *
 * Outreach:
 *   POST /api/outreach/{Create|Get|MarkSent|MarkReplied|MarkBounced}/:entityId
 *
 * Queries (stateless, direct SQL):
 *   GET /api/queries/companies/search?q=
 *   GET /api/queries/companies/by-industry?industry=
 *   GET /api/queries/companies/by-stage?stage=
 *   GET /api/queries/companies/count-by-source
 *   GET /api/queries/dms/top-cip?limit=
 *   GET /api/queries/dms/ready-for-outreach?minCip=
 *   GET /api/queries/signals/recent?limit=
 *   GET /api/queries/signals/weight-by-company
 *   GET /api/queries/pipeline/summary
 */
export class ProspectApi extends HttpApi.make('prospect-api')
  .annotateContext(OpenApi.annotations({
    title: 'Prospect Pipeline API',
    version: '1.0.0',
    description: 'CRM/CIP pipeline for prospect discovery, scoring, and outreach. ' +
      'Entity endpoints via Effect Cluster, query endpoints via direct SQL.',
  }))
  // ── Entity Proxy Groups (auto-generated from RPCs) ──
  .add(EntityProxy.toHttpApiGroup('companies', CompanyEntity).prefix('/api/companies'))
  .add(EntityProxy.toHttpApiGroup('dms', DecisionMakerEntity).prefix('/api/dms'))
  .add(EntityProxy.toHttpApiGroup('signals', SignalEntity).prefix('/api/signals'))
  .add(EntityProxy.toHttpApiGroup('proposals', ProposalEntity).prefix('/api/proposals'))
  .add(EntityProxy.toHttpApiGroup('outreach', OutreachEntity).prefix('/api/outreach'))
  // ── Query Groups (stateless, direct SQL) ──
  .add(CompanyQueryGroup.prefix('/api'))
  .add(DMQueryGroup.prefix('/api'))
  .add(SignalQueryGroup.prefix('/api'))
  .add(PipelineQueryGroup.prefix('/api'))
{}
