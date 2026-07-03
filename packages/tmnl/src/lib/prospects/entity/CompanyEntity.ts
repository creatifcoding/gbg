/**
 * CompanyEntity — Effect Cluster Entity for Company
 *
 * A peer entity in the prospect graph. Not subordinate to DecisionMaker.
 * RPCs expose CRUD + enrichment + stage transitions.
 * Entity.make → EntityProxy.toRpcGroup → EntityProxy.toHttpApiGroup.
 *
 * @module prospects/entity/CompanyEntity
 */

import { Schema } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import {
  Industry,
  CompanySize,
  HarvestSource,
  PipelineStage,
} from '../schemas/domain'
import {
  GeoLocation,
  MoneyRange,
  HeadcountEstimate,
  CapabilityProfile,
} from '../schemas/value-objects'

// =============================================================================
// Response Schemas
// =============================================================================

export const CompanyView = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  industry: Industry,
  subIndustry: Schema.NullishOr(Schema.String),
  size: CompanySize,
  pipelineStage: PipelineStage,
  website: Schema.NullishOr(Schema.String),
  description: Schema.NullishOr(Schema.String),
})

// =============================================================================
// RPC Error Schemas
// =============================================================================

export class CompanyNotFoundError extends Schema.TaggedError<CompanyNotFoundError>()(
  'CompanyNotFoundError',
  { companyId: Schema.String }
) {}

export class CompanyAlreadyExistsError extends Schema.TaggedError<CompanyAlreadyExistsError>()(
  'CompanyAlreadyExistsError',
  { slug: Schema.String }
) {}

// =============================================================================
// RPC Definitions
// =============================================================================

const EntityType = 'Company' as const

export class CreateCompanyRpc extends Rpc.make(`${EntityType}.Create`, {
  payload: Schema.Struct({
    id: Schema.String,
    name: Schema.NonEmptyString,
    industry: Industry,
    subIndustry: Schema.optional(Schema.String),
    hq: Schema.optional(Schema.String),
    size: Schema.optional(CompanySize),
    employeeCount: Schema.optional(Schema.Number),
    revenue: Schema.optional(Schema.String),
    website: Schema.optional(Schema.String),
    description: Schema.optional(Schema.String),
    harvestSource: HarvestSource,
    tags: Schema.optional(Schema.Array(Schema.String)),
  }),
  primaryKey: ({ id }) => id,
  success: CompanyView,
  error: CompanyAlreadyExistsError,
}) {}

export class GetCompanyRpc extends Rpc.make(`${EntityType}.Get`, {
  payload: Schema.Struct({ id: Schema.String }),
  primaryKey: ({ id }) => id,
  success: CompanyView,
  error: CompanyNotFoundError,
}) {}

export class UpdateStageRpc extends Rpc.make(`${EntityType}.UpdateStage`, {
  payload: Schema.Struct({
    id: Schema.String,
    stage: PipelineStage,
  }),
  primaryKey: ({ id }) => id,
  success: CompanyView,
  error: CompanyNotFoundError,
}) {}

export class EnrichCompanyRpc extends Rpc.make(`${EntityType}.Enrich`, {
  payload: Schema.Struct({
    id: Schema.String,
    field: Schema.String,
    value: Schema.Unknown,
    source: Schema.String,
    confidence: Schema.optional(Schema.Number),
  }),
  primaryKey: ({ id }) => id,
  success: CompanyView,
  error: CompanyNotFoundError,
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

export const CompanyEntity = Entity.make(EntityType, [
  CreateCompanyRpc,
  GetCompanyRpc,
  UpdateStageRpc,
  EnrichCompanyRpc,
])
