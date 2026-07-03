/**
 * Prospect Pipeline — Harvest Schemas
 *
 * Schema-backed payloads for harvest ingestion.
 * No raw interfaces. Runtime-validatable.
 *
 * @module prospects/schemas/harvest
 */

import { Schema } from 'effect'
import {
  Industry,
  CompanySize,
  HarvestSource,
  SignalType,
  TitleLevel,
} from './domain'

// =============================================================================
// Harvest Signal (nested within a company record)
// =============================================================================

export const HarvestSignal = Schema.Struct({
  type: SignalType,
  title: Schema.NonEmptyString,
  description: Schema.optional(Schema.String),
  sourceUrl: Schema.optional(Schema.String),
  weight: Schema.optional(Schema.Number.pipe(
    Schema.greaterThanOrEqualTo(1),
    Schema.lessThanOrEqualTo(3)
  )),
})
export type HarvestSignal = typeof HarvestSignal.Type

// =============================================================================
// Harvest Decision Maker (nested within a company record)
// =============================================================================

export const HarvestDecisionMaker = Schema.Struct({
  name: Schema.NonEmptyString,
  title: Schema.optional(Schema.String),
  titleLevel: Schema.optional(TitleLevel),
  email: Schema.optional(Schema.String),
  linkedinUrl: Schema.optional(Schema.String),
  tenure: Schema.optional(Schema.String),
})
export type HarvestDecisionMaker = typeof HarvestDecisionMaker.Type

// =============================================================================
// Harvest Company Record — one inbound row from any source
// =============================================================================

export const HarvestCompanyRecord = Schema.Struct({
  name: Schema.NonEmptyString,
  industry: Industry,
  subIndustry: Schema.optional(Schema.String),
  hq: Schema.optional(Schema.String),
  size: Schema.optional(CompanySize),
  employeeCount: Schema.optional(Schema.Number),
  revenue: Schema.optional(Schema.String),
  website: Schema.optional(Schema.String),
  linkedinUrl: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  notes: Schema.optional(Schema.String),
  signals: Schema.optional(Schema.Array(HarvestSignal)),
  decisionMakers: Schema.optional(Schema.Array(HarvestDecisionMaker)),
})
export type HarvestCompanyRecord = typeof HarvestCompanyRecord.Type

// =============================================================================
// Harvest Result — returned after batch ingestion
// =============================================================================

export const HarvestResult = Schema.TaggedStruct('HarvestResult', {
  batchId: Schema.NonEmptyString,
  source: HarvestSource,
  recordsFound: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  recordsNew: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  recordsUpdated: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  recordsSkipped: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
})
export type HarvestResult = typeof HarvestResult.Type

// =============================================================================
// CIP Score Result — returned after scoring one decision maker
// =============================================================================

export const CIPScoreResult = Schema.TaggedStruct('CIPScoreResult', {
  capital: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(10)),
  interest: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(10)),
  power: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(10)),
  composite: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0), Schema.lessThanOrEqualTo(10)),
})
export type CIPScoreResult = typeof CIPScoreResult.Type

// =============================================================================
// Pipeline Summary — aggregate stats
// =============================================================================

export const StageCounts = Schema.Struct({
  stage: Schema.String,
  count: Schema.Number,
})

export const TypeCounts = Schema.Struct({
  type: Schema.String,
  count: Schema.Number,
})

export const PipelineSummary = Schema.TaggedStruct('PipelineSummary', {
  totalCompanies: Schema.Number,
  totalDecisionMakers: Schema.Number,
  totalSignals: Schema.Number,
  companiesByStage: Schema.Array(StageCounts),
  dmsByStage: Schema.Array(StageCounts),
  signalsByType: Schema.Array(TypeCounts),
})
export type PipelineSummary = typeof PipelineSummary.Type
