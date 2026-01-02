/**
 * ADR Review Unit Schemas
 *
 * Discriminated union of reviewable unit types using Schema.TaggedStruct.
 * Each ADR section becomes one or more typed units.
 */
import { Schema } from 'effect'
import { ReviewStatus } from './status'

// -----------------------------------------------------------------------------
// Base Unit Fields (shared across all unit types)
// -----------------------------------------------------------------------------

const BaseUnitFields = {
  adrId: Schema.String,
  path: Schema.String, // e.g., "context.problem" or "decision.technologies[0]"
  status: ReviewStatus,
}

// -----------------------------------------------------------------------------
// Context Units
// -----------------------------------------------------------------------------

export const ProblemUnit = Schema.TaggedStruct('ProblemUnit', {
  ...BaseUnitFields,
  content: Schema.String,
})
export type ProblemUnit = Schema.Schema.Type<typeof ProblemUnit>

export const ConstraintUnit = Schema.TaggedStruct('ConstraintUnit', {
  ...BaseUnitFields,
  constraint: Schema.String,
})
export type ConstraintUnit = Schema.Schema.Type<typeof ConstraintUnit>

export const AssumptionUnit = Schema.TaggedStruct('AssumptionUnit', {
  ...BaseUnitFields,
  assumption: Schema.String,
})
export type AssumptionUnit = Schema.Schema.Type<typeof AssumptionUnit>

// -----------------------------------------------------------------------------
// Decision Units
// -----------------------------------------------------------------------------

export const SummaryUnit = Schema.TaggedStruct('SummaryUnit', {
  ...BaseUnitFields,
  summary: Schema.String,
})
export type SummaryUnit = Schema.Schema.Type<typeof SummaryUnit>

export const TechnologyUnit = Schema.TaggedStruct('TechnologyUnit', {
  ...BaseUnitFields,
  technology: Schema.String,
  purpose: Schema.String,
  reference: Schema.optional(Schema.String),
})
export type TechnologyUnit = Schema.Schema.Type<typeof TechnologyUnit>

export const PatternUnit = Schema.TaggedStruct('PatternUnit', {
  ...BaseUnitFields,
  name: Schema.String,
  algorithm: Schema.optional(Schema.String),
  codeExample: Schema.optional(Schema.String),
  characteristics: Schema.optional(Schema.String),
})
export type PatternUnit = Schema.Schema.Type<typeof PatternUnit>

export const InterfaceUnit = Schema.TaggedStruct('InterfaceUnit', {
  ...BaseUnitFields,
  interfaceName: Schema.String,
  from: Schema.String,
  to: Schema.String,
  protocol: Schema.String,
  schema: Schema.optional(Schema.String),
})
export type InterfaceUnit = Schema.Schema.Type<typeof InterfaceUnit>

// -----------------------------------------------------------------------------
// Rationale Units
// -----------------------------------------------------------------------------

export const AlternativeUnit = Schema.TaggedStruct('AlternativeUnit', {
  ...BaseUnitFields,
  alternative: Schema.String,
  rejectionReason: Schema.String,
})
export type AlternativeUnit = Schema.Schema.Type<typeof AlternativeUnit>

export const TradeoffUnit = Schema.TaggedStruct('TradeoffUnit', {
  ...BaseUnitFields,
  gain: Schema.String,
  cost: Schema.String,
})
export type TradeoffUnit = Schema.Schema.Type<typeof TradeoffUnit>

export const RiskUnit = Schema.TaggedStruct('RiskUnit', {
  ...BaseUnitFields,
  risk: Schema.String,
  likelihood: Schema.String,
  impact: Schema.String,
  mitigation: Schema.String,
})
export type RiskUnit = Schema.Schema.Type<typeof RiskUnit>

// -----------------------------------------------------------------------------
// Implementation Units
// -----------------------------------------------------------------------------

export const FileUnit = Schema.TaggedStruct('FileUnit', {
  ...BaseUnitFields,
  filePath: Schema.String,
  action: Schema.Literal('create', 'modify', 'delete'),
  description: Schema.String,
})
export type FileUnit = Schema.Schema.Type<typeof FileUnit>

export const DependencyUnit = Schema.TaggedStruct('DependencyUnit', {
  ...BaseUnitFields,
  dependency: Schema.String,
  reason: Schema.optional(Schema.String),
})
export type DependencyUnit = Schema.Schema.Type<typeof DependencyUnit>

export const TestStrategyUnit = Schema.TaggedStruct('TestStrategyUnit', {
  ...BaseUnitFields,
  strategy: Schema.String,
})
export type TestStrategyUnit = Schema.Schema.Type<typeof TestStrategyUnit>

// -----------------------------------------------------------------------------
// Discriminated Union: ReviewUnit
// -----------------------------------------------------------------------------

export const ReviewUnit = Schema.Union(
  // Context
  ProblemUnit,
  ConstraintUnit,
  AssumptionUnit,
  // Decision
  SummaryUnit,
  TechnologyUnit,
  PatternUnit,
  InterfaceUnit,
  // Rationale
  AlternativeUnit,
  TradeoffUnit,
  RiskUnit,
  // Implementation
  FileUnit,
  DependencyUnit,
  TestStrategyUnit
)
export type ReviewUnit = Schema.Schema.Type<typeof ReviewUnit>

// -----------------------------------------------------------------------------
// Unit Tag Type (for filtering)
// -----------------------------------------------------------------------------

export type ReviewUnitTag = ReviewUnit['_tag']

export const UNIT_TAGS = [
  'ProblemUnit',
  'ConstraintUnit',
  'AssumptionUnit',
  'SummaryUnit',
  'TechnologyUnit',
  'PatternUnit',
  'InterfaceUnit',
  'AlternativeUnit',
  'TradeoffUnit',
  'RiskUnit',
  'FileUnit',
  'DependencyUnit',
  'TestStrategyUnit',
] as const

// -----------------------------------------------------------------------------
// Unit Section Mapping
// -----------------------------------------------------------------------------

export const UNIT_SECTIONS: Record<ReviewUnitTag, string> = {
  ProblemUnit: 'context',
  ConstraintUnit: 'context',
  AssumptionUnit: 'context',
  SummaryUnit: 'decision',
  TechnologyUnit: 'decision',
  PatternUnit: 'decision',
  InterfaceUnit: 'decision',
  AlternativeUnit: 'rationale',
  TradeoffUnit: 'rationale',
  RiskUnit: 'rationale',
  FileUnit: 'implementation',
  DependencyUnit: 'implementation',
  TestStrategyUnit: 'implementation',
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

export function getUnitSection(unit: ReviewUnit): string {
  return UNIT_SECTIONS[unit._tag]
}

export function getUnitDisplayName(tag: ReviewUnitTag): string {
  const names: Record<ReviewUnitTag, string> = {
    ProblemUnit: 'Problem',
    ConstraintUnit: 'Constraint',
    AssumptionUnit: 'Assumption',
    SummaryUnit: 'Summary',
    TechnologyUnit: 'Technology',
    PatternUnit: 'Pattern',
    InterfaceUnit: 'Interface',
    AlternativeUnit: 'Alternative',
    TradeoffUnit: 'Tradeoff',
    RiskUnit: 'Risk',
    FileUnit: 'File',
    DependencyUnit: 'Dependency',
    TestStrategyUnit: 'Test Strategy',
  }
  return names[tag]
}
