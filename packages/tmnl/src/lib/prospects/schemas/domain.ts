/**
 * Prospect Pipeline — Domain Schemas
 *
 * Core domain types for the CIP (Capital, Interest, Power) prospect framework.
 * People-first: decision makers are the primary entity, companies are context.
 *
 * All rich fields use value objects from ./value-objects.ts.
 * No bare Schema.String for structured data.
 *
 * @module prospects/schemas/domain
 */

import { Schema } from 'effect'
import {
  MoneyRange,
  GeoLocation,
  HeadcountEstimate,
  ContactInfo,
  RoleTenure,
  ContractEstimate,
  CapabilityProfile,
} from './value-objects'

// =============================================================================
// Enums (Schema.Literal)
// =============================================================================

export const Industry = Schema.Literal(
  'manufacturing', 'construction', 'logistics', 'energy',
  'water_wastewater', 'food_beverage', 'pharma', 'mining',
  'aviation', 'maritime', 'agriculture', 'environmental',
  'healthcare', 'cannabis', 'field_services', 'chemical',
  'renewable_energy', 'defense', 'real_estate', 'other'
)
export type Industry = typeof Industry.Type

export const CompanySize = Schema.Literal(
  'micro', 'small', 'mid_small', 'mid', 'mid_large', 'large', 'unknown'
)
export type CompanySize = typeof CompanySize.Type

export const HarvestSource = Schema.Literal(
  'thomasnet', 'enr_list', 'abc_directory', 'agc_directory',
  'cema_directory', 'state_license', 'sam_gov', 'crunchbase',
  'linkedin', 'trade_show', 'uspto', 'sec_edgar',
  'industry_pub', 'web_search', 'manual', 'referral'
)
export type HarvestSource = typeof HarvestSource.Type

export const SignalType = Schema.Literal(
  'job_posting', 'rfp', 'news_article', 'conference_talk',
  'linkedin_post', 'funding_round', 'acquisition',
  'leadership_change', 'product_launch', 'pain_admission',
  'competitor_mention', 'patent_filing', 'partnership',
  'manual_observation'
)
export type SignalType = typeof SignalType.Type

export const PipelineStage = Schema.Literal(
  'harvested', 'enriched', 'scored', 'qualified',
  'outreach_draft', 'contacted', 'responding', 'meeting',
  'proposal', 'negotiating', 'won', 'lost',
  'nurture', 'disqualified'
)
export type PipelineStage = typeof PipelineStage.Type

export const TitleLevel = Schema.Literal(
  'founder_owner', 'c_suite', 'vp', 'director',
  'manager', 'individual', 'unknown'
)
export type TitleLevel = typeof TitleLevel.Type

export const OutreachChannel = Schema.Literal(
  'email', 'linkedin', 'phone', 'conference',
  'referral', 'website_form', 'other'
)
export type OutreachChannel = typeof OutreachChannel.Type

export const OutreachStatus = Schema.Literal(
  'drafted', 'sent', 'opened', 'replied',
  'bounced', 'no_response', 'opted_out'
)
export type OutreachStatus = typeof OutreachStatus.Type

// =============================================================================
// CIP Score Schema
// =============================================================================

export const CIPScore = Schema.Struct({
  capital: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(10)),
  interest: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(10)),
  power: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(10)),
})
export type CIPScore = typeof CIPScore.Type

// =============================================================================
// Domain Structs — using value objects for rich fields
// =============================================================================

/** A company in the pipeline */
export const Company = Schema.TaggedStruct('Company', {
  name: Schema.NonEmptyString,
  slug: Schema.String,
  industry: Industry,
  subIndustry: Schema.optional(Schema.String),
  location: Schema.optional(GeoLocation),
  size: CompanySize,
  headcount: Schema.optional(HeadcountEstimate),
  revenue: Schema.optional(MoneyRange),
  website: Schema.optional(Schema.String),
  linkedinUrl: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  capabilities: Schema.optional(CapabilityProfile),
  harvestSource: HarvestSource,
  harvestDate: Schema.DateFromString,
  pipelineStage: PipelineStage,
  tags: Schema.optional(Schema.Array(Schema.String)),
  notes: Schema.optional(Schema.String),
})
export type Company = typeof Company.Type

/** A decision maker — the PRIMARY entity */
export const DecisionMaker = Schema.TaggedStruct('DecisionMaker', {
  name: Schema.NonEmptyString,
  title: Schema.optional(Schema.String),
  titleLevel: TitleLevel,
  companyId: Schema.String,
  contacts: Schema.optional(ContactInfo),
  tenure: Schema.optional(RoleTenure),
  contractEstimate: Schema.optional(ContractEstimate),
  cipCapital: Schema.Number,
  cipInterest: Schema.Number,
  cipPower: Schema.Number,
  cipComposite: Schema.Number,
  pipelineStage: PipelineStage,
  notes: Schema.optional(Schema.String),
})
export type DecisionMaker = typeof DecisionMaker.Type

/** A signal — evidence of need or opportunity */
export const Signal = Schema.TaggedStruct('Signal', {
  companyId: Schema.String,
  decisionMakerId: Schema.optional(Schema.String),
  signalType: SignalType,
  title: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
  sourceUrl: Schema.optional(Schema.String),
  weight: Schema.Number.pipe(Schema.greaterThanOrEqualTo(1), Schema.lessThanOrEqualTo(3)),
  detectedAt: Schema.DateFromString,
  expiresAt: Schema.optional(Schema.DateFromString),
  raw: Schema.optional(Schema.String),
})
export type Signal = typeof Signal.Type

/** An outreach attempt */
export const Outreach = Schema.TaggedStruct('Outreach', {
  decisionMakerId: Schema.String,
  companyId: Schema.String,
  channel: OutreachChannel,
  status: OutreachStatus,
  subject: Schema.optional(Schema.String),
  body: Schema.optional(Schema.String),
  sentAt: Schema.optional(Schema.DateFromString),
  respondedAt: Schema.optional(Schema.DateFromString),
  notes: Schema.optional(Schema.String),
})
export type Outreach = typeof Outreach.Type
