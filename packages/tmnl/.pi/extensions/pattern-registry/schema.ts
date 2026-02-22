import { Schema } from 'effect'

// =============================================================================
// Branded IDs
// =============================================================================

export const PatternId = Schema.String.pipe(
  Schema.brand('PatternId'),
  Schema.minLength(1),
)
export type PatternId = typeof PatternId.Type

export const PatternVariantId = Schema.String.pipe(
  Schema.brand('PatternVariantId'),
  Schema.minLength(1),
)
export type PatternVariantId = typeof PatternVariantId.Type

export const DiscoveryEventId = Schema.String.pipe(
  Schema.brand('DiscoveryEventId'),
  Schema.minLength(1),
)
export type DiscoveryEventId = typeof DiscoveryEventId.Type

export const AnnotationId = Schema.String.pipe(
  Schema.brand('AnnotationId'),
  Schema.minLength(1),
)
export type AnnotationId = typeof AnnotationId.Type

// =============================================================================
// Core pattern taxonomy
// =============================================================================

export const PatternKind = Schema.Literal('plan', 'pattern', 'implementation', 'idea')
export type PatternKind = typeof PatternKind.Type

export const LifecycleStatus = Schema.Literal('draft', 'active', 'deprecated', 'archived')
export type LifecycleStatus = typeof LifecycleStatus.Type

export const ConfidenceScore = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1),
)
export type ConfidenceScore = typeof ConfidenceScore.Type

export class AllowedContext extends Schema.Class<AllowedContext>('AllowedContext')({
  domain: Schema.String,
  pathGlob: Schema.optional(Schema.String),
  capabilities: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
}) {}

export class AntiPattern extends Schema.Class<AntiPattern>('AntiPattern')({
  antiPatternId: Schema.String,
  title: Schema.String,
  description: Schema.String,
  rationale: Schema.optional(Schema.String),
  severity: Schema.optionalWith(Schema.Literal('low', 'medium', 'high', 'critical'), { default: () => 'medium' as const }),
}) {}

export class PatternVariant extends Schema.Class<PatternVariant>('PatternVariant')({
  variantId: PatternVariantId,
  title: Schema.String,
  summary: Schema.String,
  codeExample: Schema.optional(Schema.String),
  constraints: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
}) {}

export const ManualProvenance = Schema.TaggedStruct('ManualProvenance', {
  sourceId: Schema.String,
  author: Schema.String,
  location: Schema.optional(Schema.String),
  note: Schema.optional(Schema.String),
})

export const CodeProvenance = Schema.TaggedStruct('CodeProvenance', {
  sourceId: Schema.String,
  filePath: Schema.String,
  symbol: Schema.optional(Schema.String),
  extractor: Schema.String,
  commitRef: Schema.optional(Schema.String),
})

export const SkillProvenance = Schema.TaggedStruct('SkillProvenance', {
  sourceId: Schema.String,
  skillName: Schema.String,
  skillPath: Schema.String,
})

export const Provenance = Schema.Union(ManualProvenance, CodeProvenance, SkillProvenance)
export type Provenance = typeof Provenance.Type

export class Pattern extends Schema.Class<Pattern>('Pattern')({
  patternId: PatternId,
  kind: PatternKind,
  title: Schema.String,
  summary: Schema.String,
  description: Schema.String,
  lifecycle: LifecycleStatus,
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  allowedContexts: Schema.optionalWith(Schema.Array(AllowedContext), { default: () => [] }),
  antiPatterns: Schema.optionalWith(Schema.Array(AntiPattern), { default: () => [] }),
  variants: Schema.optionalWith(Schema.Array(PatternVariant), { default: () => [] }),
  provenance: Schema.Array(Provenance),
  createdAt: Schema.String,
  updatedAt: Schema.String,
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.String }), { default: () => ({}) }),
}) {}

// =============================================================================
// Discovery ledger + annotations
// =============================================================================

export const DiscoverySourceType = Schema.Literal('manual', 'ast', 'semantic', 'tool', 'hook')
export type DiscoverySourceType = typeof DiscoverySourceType.Type

export class DiscoveryMetadata extends Schema.Class<DiscoveryMetadata>('DiscoveryMetadata')({
  sourceType: DiscoverySourceType,
  sourceId: Schema.String,
  filePath: Schema.optional(Schema.String),
  symbol: Schema.optional(Schema.String),
  extractor: Schema.optional(Schema.String),
  confidence: ConfidenceScore,
  discoveredBy: Schema.String,
  discoveredAt: Schema.String,
  revisionRef: Schema.optional(Schema.String),
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.String }), { default: () => ({}) }),
}) {}

export class DiscoveredPatternEvent extends Schema.Class<DiscoveredPatternEvent>('DiscoveredPatternEvent')({
  eventId: DiscoveryEventId,
  patternId: PatternId,
  metadata: DiscoveryMetadata,
  tags: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  note: Schema.optional(Schema.String),
  payload: Schema.optional(Schema.Unknown),
}) {}

export const AnnotationStatus = Schema.Literal('active', 'resolved', 'superseded')
export type AnnotationStatus = typeof AnnotationStatus.Type

export class AnnotationRecord extends Schema.Class<AnnotationRecord>('AnnotationRecord')({
  annotationId: AnnotationId,
  eventId: DiscoveryEventId,
  patternId: PatternId,
  author: Schema.String,
  message: Schema.String,
  status: Schema.optionalWith(AnnotationStatus, { default: () => 'active' as const }),
  labels: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  createdAt: Schema.String,
  updatedAt: Schema.optional(Schema.String),
  metadata: Schema.optionalWith(Schema.Record({ key: Schema.String, value: Schema.String }), { default: () => ({}) }),
}) {}

export class DiscoveryQueryFilter extends Schema.Class<DiscoveryQueryFilter>('DiscoveryQueryFilter')({
  patternId: Schema.optional(Schema.String),
  sourceType: Schema.optional(DiscoverySourceType),
  author: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  dateFrom: Schema.optional(Schema.String),
  dateTo: Schema.optional(Schema.String),
  minConfidence: Schema.optional(ConfidenceScore),
  maxConfidence: Schema.optional(ConfidenceScore),
  limit: Schema.optionalWith(Schema.Number, { default: () => 50 }),
  offset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
}) {}

export class DiscoveryLedgerEntry extends Schema.Class<DiscoveryLedgerEntry>('DiscoveryLedgerEntry')({
  event: DiscoveredPatternEvent,
  annotations: Schema.Array(AnnotationRecord),
}) {}

export class DiscoveryQueryResult extends Schema.Class<DiscoveryQueryResult>('DiscoveryQueryResult')({
  entries: Schema.Array(DiscoveryLedgerEntry),
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number,
  hasMore: Schema.Boolean,
}) {}

export class PatternSearchFilter extends Schema.Class<PatternSearchFilter>('PatternSearchFilter')({
  query: Schema.optional(Schema.String),
  kind: Schema.optional(PatternKind),
  tags: Schema.optional(Schema.Array(Schema.String)),
  lifecycle: Schema.optional(LifecycleStatus),
  limit: Schema.optionalWith(Schema.Number, { default: () => 25 }),
  offset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
}) {}

// =============================================================================
// Merge run + conflict ledger
// =============================================================================

export const MergeConflictStatus = Schema.Literal('open', 'resolved', 'ignored')
export type MergeConflictStatus = typeof MergeConflictStatus.Type

export const MergeDecisionReason = Schema.Literal('single_candidate', 'winner_curated', 'winner_score', 'conflict')
export type MergeDecisionReason = typeof MergeDecisionReason.Type

export class MergeRunRecord extends Schema.Class<MergeRunRecord>('MergeRunRecord')({
  runId: Schema.String,
  createdAt: Schema.String,
  dryRun: Schema.Boolean,
  totalGroups: Schema.Number,
  mergedCount: Schema.Number,
  conflictCount: Schema.Number,
  payload: Schema.optional(Schema.Unknown),
}) {}

export class MergeDecisionRecord extends Schema.Class<MergeDecisionRecord>('MergeDecisionRecord')({
  decisionId: Schema.String,
  runId: Schema.String,
  canonicalKey: Schema.String,
  winnerPatternId: PatternId,
  mergedPatternId: PatternId,
  sourceRank: Schema.Number,
  score: Schema.Number,
  reason: MergeDecisionReason,
  createdAt: Schema.String,
  payload: Schema.optional(Schema.Unknown),
}) {}

export class MergeConflictRecord extends Schema.Class<MergeConflictRecord>('MergeConflictRecord')({
  conflictId: Schema.String,
  runId: Schema.String,
  canonicalKey: Schema.String,
  winnerPatternId: PatternId,
  contenderPatternId: PatternId,
  reason: Schema.String,
  status: Schema.optionalWith(MergeConflictStatus, { default: () => 'open' as const }),
  createdAt: Schema.String,
  resolvedAt: Schema.optional(Schema.String),
  payload: Schema.optional(Schema.Unknown),
}) {}

export class MergeConflictFilter extends Schema.Class<MergeConflictFilter>('MergeConflictFilter')({
  status: Schema.optional(MergeConflictStatus),
  runId: Schema.optional(Schema.String),
  canonicalKey: Schema.optional(Schema.String),
  limit: Schema.optionalWith(Schema.Number, { default: () => 50 }),
  offset: Schema.optionalWith(Schema.Number, { default: () => 0 }),
}) {}

export class MergeConflictQueryResult extends Schema.Class<MergeConflictQueryResult>('MergeConflictQueryResult')({
  conflicts: Schema.Array(MergeConflictRecord),
  total: Schema.Number,
  limit: Schema.Number,
  offset: Schema.Number,
  hasMore: Schema.Boolean,
}) {}
