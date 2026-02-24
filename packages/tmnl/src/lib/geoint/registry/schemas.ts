import { Schema } from 'effect'

// =============================================================================
// GEOINT Registry v1 Schemas
// =============================================================================

export const RegistryVersion = Schema.Literal('geoint.registry.v1')
export type RegistryVersion = typeof RegistryVersion.Type

export const SourceId = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9][a-z0-9-]{1,63}$/),
  Schema.brand('GeointSourceId')
)
export type SourceId = typeof SourceId.Type

export const LayerId = Schema.String.pipe(
  Schema.pattern(/^[a-z0-9][a-z0-9-]{1,63}$/),
  Schema.brand('GeointRegistryLayerId')
)
export type LayerId = typeof LayerId.Type

export const ProviderKind = Schema.Literal('stac', 'ogc-features', 'native', 'stream')
export type ProviderKind = typeof ProviderKind.Type

export const FilterLanguage = Schema.Literal('none', 'cql2-text', 'cql2-json')
export type FilterLanguage = typeof FilterLanguage.Type

export const PagingMode = Schema.Literal('link', 'token', 'offset')
export type PagingMode = typeof PagingMode.Type

export const SourceRole = Schema.Literal('trigger', 'context', 'archive')
export type SourceRole = typeof SourceRole.Type

export const CanonicalIntelSource = Schema.Literal(
  // ECS canonical source vocabulary
  'opensky',
  'adsb-lol',
  'flightradar24',
  'overpass',
  'osm',
  'nominatim',
  'planet',
  'sentinel',
  'maxar',
  'openmeteo',
  'noaa',
  'manual',
  'derived',
  'fused',
  'unknown',
  // GEOINT registry extensions (mapped at boundaries)
  'track',
  'feature',
  'aisstream',
  'marine-traffic',
  'gdacs',
  'firms',
  'usgs',
  'copernicus-stac',
  'planetary-computer',
  'worldpop',
  'gdelt',
  'acled',
  'custom'
)
export type CanonicalIntelSource = typeof CanonicalIntelSource.Type

export const RegistryCollectionRef = Schema.Struct({
  provider: ProviderKind,
  id: Schema.String,
})
export type RegistryCollectionRef = typeof RegistryCollectionRef.Type

export const RegistryFilter = Schema.TaggedStruct('RegistryFilter', {
  lang: FilterLanguage,
  cql2: Schema.optional(Schema.Unknown),
  raw: Schema.optional(Schema.Unknown),
  filterCrs: Schema.optional(Schema.String),
})
export type RegistryFilter = typeof RegistryFilter.Type

export const PagingRequestV1 = Schema.TaggedStruct('PagingRequestV1', {
  mode: PagingMode,
  limit: Schema.Number.pipe(Schema.int(), Schema.between(1, 1000)),
  cursor: Schema.optional(Schema.String),
  offset: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
  nextHref: Schema.optional(Schema.String),
})
export type PagingRequestV1 = typeof PagingRequestV1.Type

export const RegistrySearchQueryV1 = Schema.TaggedStruct('RegistrySearchQueryV1', {
  version: RegistryVersion,
  queryId: Schema.String,
  text: Schema.optional(Schema.String),
  collections: Schema.Array(RegistryCollectionRef),
  bbox: Schema.optional(Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number)),
  intersects: Schema.optional(Schema.Unknown),
  datetime: Schema.optional(Schema.String),
  filter: Schema.optional(RegistryFilter),
  page: PagingRequestV1,
})
export type RegistrySearchQueryV1 = typeof RegistrySearchQueryV1.Type

export const ProvenanceHopV1 = Schema.TaggedStruct('ProvenanceHopV1', {
  provider: ProviderKind,
  endpoint: Schema.String,
  requestedAt: Schema.Date,
  receivedAt: Schema.Date,
  requestHash: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/i)),
  responseHash: Schema.String.pipe(Schema.pattern(/^[a-f0-9]{64}$/i)),
  pageState: Schema.optional(Schema.String),
})
export type ProvenanceHopV1 = typeof ProvenanceHopV1.Type

export const RegistryEntityEnvelopeV1 = Schema.TaggedStruct('RegistryEntityEnvelopeV1', {
  version: RegistryVersion,
  envelopeId: Schema.String,
  entityType: Schema.String,
  source: CanonicalIntelSource,
  collection: RegistryCollectionRef,
  nativeId: Schema.String,
  geometry: Schema.Unknown,
  observedAt: Schema.optional(Schema.Date),
  retrievedAt: Schema.Date,
  confidence: Schema.optional(Schema.Number.pipe(Schema.between(0, 1))),
  properties: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  provenance: Schema.Array(ProvenanceHopV1).pipe(Schema.minItems(1)),
})
export type RegistryEntityEnvelopeV1 = typeof RegistryEntityEnvelopeV1.Type

export const PagingStateV1 = Schema.TaggedStruct('PagingStateV1', {
  mode: PagingMode,
  returned: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  matched: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0))),
  hasNext: Schema.Boolean,
  continuationToken: Schema.optional(Schema.String),
  nextHref: Schema.optional(Schema.String),
})
export type PagingStateV1 = typeof PagingStateV1.Type

export const RegistryPageV1 = Schema.TaggedStruct('RegistryPageV1', {
  version: RegistryVersion,
  queryId: Schema.String,
  items: Schema.Array(RegistryEntityEnvelopeV1),
  paging: PagingStateV1,
  sourceCounts: Schema.Record({ key: Schema.String, value: Schema.Number }),
  errors: Schema.Record({ key: Schema.String, value: Schema.String }),
  executionTimeMs: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
})
export type RegistryPageV1 = typeof RegistryPageV1.Type

export const SourceAlias = Schema.Struct({
  adapter: Schema.String,
  externalId: Schema.String,
  canonical: CanonicalIntelSource,
})
export type SourceAlias = typeof SourceAlias.Type

// STAC semantics from the core spec: Item/Catalog/Collection,
// static vs dynamic catalogs, and extension maturity signaling.
export const StacObjectType = Schema.Literal('Item', 'Catalog', 'Collection')
export type StacObjectType = typeof StacObjectType.Type

export const StacCatalogMode = Schema.Literal('static', 'dynamic', 'hybrid')
export type StacCatalogMode = typeof StacCatalogMode.Type

export const StacExtensionMaturity = Schema.Literal(
  'proposal',
  'pilot',
  'candidate',
  'stable',
  'deprecated'
)
export type StacExtensionMaturity = typeof StacExtensionMaturity.Type

export const StacExtensionDescriptor = Schema.Struct({
  id: Schema.String,
  maturity: StacExtensionMaturity,
})
export type StacExtensionDescriptor = typeof StacExtensionDescriptor.Type

export const StacCapabilityProfile = Schema.Struct({
  stacVersion: Schema.String,
  objectTypes: Schema.Array(StacObjectType),
  catalogMode: StacCatalogMode,
  supportsSearchEndpoint: Schema.Boolean,
  supportsAssets: Schema.Boolean,
  supportsRelationshipLinks: Schema.Boolean,
  extensions: Schema.Array(StacExtensionDescriptor),
})
export type StacCapabilityProfile = typeof StacCapabilityProfile.Type

export const SourceCapabilityProfile = Schema.Struct({
  provider: ProviderKind,
  supportsCollections: Schema.Boolean,
  supportsIds: Schema.Boolean,
  supportsBBox: Schema.Boolean,
  supportsIntersects: Schema.Boolean,
  supportsDatetime: Schema.Boolean,
  supportsFilter: Schema.Boolean,
  supportedFilterLangs: Schema.Array(FilterLanguage),
  supportsFilterCrs: Schema.Boolean,
  pagingModes: Schema.Array(PagingMode),
  supportsPostNextHints: Schema.Boolean,
  defaultTtlSeconds: Schema.Number.pipe(Schema.int(), Schema.greaterThan(0)),
  stac: Schema.optional(StacCapabilityProfile),
})
export type SourceCapabilityProfile = typeof SourceCapabilityProfile.Type

export const SourceRegistryEntry = Schema.TaggedStruct('SourceRegistryEntry', {
  version: RegistryVersion,
  sourceId: SourceId,
  canonicalSource: CanonicalIntelSource,
  displayName: Schema.String,
  endpoint: Schema.String,
  enabled: Schema.Boolean,
  role: SourceRole,
  priority: Schema.Number.pipe(Schema.between(0, 100)),
  weight: Schema.Number.pipe(Schema.between(0, 1)),
  aliases: Schema.Array(SourceAlias),
  capabilities: SourceCapabilityProfile,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})
export type SourceRegistryEntry = typeof SourceRegistryEntry.Type

export const LayerCapabilityProfile = Schema.Struct({
  requiredEntityTypes: Schema.Array(Schema.String),
  requiresTemporalOrdering: Schema.Boolean,
  requiresStreaming: Schema.Boolean,
  requiredFilterLangs: Schema.Array(FilterLanguage),
})
export type LayerCapabilityProfile = typeof LayerCapabilityProfile.Type

export const LayerRegistryEntry = Schema.TaggedStruct('LayerRegistryEntry', {
  version: RegistryVersion,
  layerId: LayerId,
  name: Schema.String,
  zIndex: Schema.Number,
  visible: Schema.Boolean,
  opacity: Schema.Number.pipe(Schema.between(0, 1)),
  capabilities: LayerCapabilityProfile,
  metadata: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})
export type LayerRegistryEntry = typeof LayerRegistryEntry.Type

export const TrustGate = Schema.Struct({
  minScore: Schema.Number.pipe(Schema.between(0, 100)),
  requireCrossSource: Schema.Boolean,
  requireProvenanceDigest: Schema.Boolean,
})
export type TrustGate = typeof TrustGate.Type

export const SourceLayerBinding = Schema.TaggedStruct('SourceLayerBinding', {
  version: RegistryVersion,
  sourceId: SourceId,
  layerId: LayerId,
  enabled: Schema.Boolean,
  precedence: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  trustGate: TrustGate,
})
export type SourceLayerBinding = typeof SourceLayerBinding.Type

export const RegistrySnapshotV1 = Schema.TaggedStruct('RegistrySnapshotV1', {
  version: RegistryVersion,
  generatedAt: Schema.Date,
  sources: Schema.Array(SourceRegistryEntry),
  layers: Schema.Array(LayerRegistryEntry),
  bindings: Schema.Array(SourceLayerBinding),
})
export type RegistrySnapshotV1 = typeof RegistrySnapshotV1.Type

// =============================================================================
// Orchestrator Planning Contracts (P1)
// =============================================================================

export const PlannerStrategy = Schema.Literal('latency-first', 'coverage-first', 'trust-first')
export type PlannerStrategy = typeof PlannerStrategy.Type

export const QueryConstraintV1 = Schema.TaggedStruct('QueryConstraintV1', {
  filterLanguage: Schema.optional(FilterLanguage),
  requiresStreaming: Schema.optional(Schema.Boolean),
  requiresTemporalOrdering: Schema.optional(Schema.Boolean),
  maxSources: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(1, 16))),
})
export type QueryConstraintV1 = typeof QueryConstraintV1.Type

export const PlannerIntentV1 = Schema.TaggedStruct('PlannerIntentV1', {
  version: RegistryVersion,
  queryId: Schema.String,
  requestedAt: Schema.Date,
  text: Schema.optional(Schema.String),
  bbox: Schema.optional(Schema.Tuple(Schema.Number, Schema.Number, Schema.Number, Schema.Number)),
  requestedSources: Schema.Array(CanonicalIntelSource),
  constraints: Schema.optional(QueryConstraintV1),
})
export type PlannerIntentV1 = typeof PlannerIntentV1.Type

export const SourceAttemptV1 = Schema.TaggedStruct('SourceAttemptV1', {
  sourceId: SourceId,
  canonicalSource: CanonicalIntelSource,
  role: SourceRole,
  provider: ProviderKind,
  priority: Schema.Number.pipe(Schema.between(0, 100)),
  weight: Schema.Number.pipe(Schema.between(0, 1)),
  rank: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  rationale: Schema.String,
  fallbackOf: Schema.optional(SourceId),
})
export type SourceAttemptV1 = typeof SourceAttemptV1.Type

export const SourceRejectionV1 = Schema.TaggedStruct('SourceRejectionV1', {
  sourceId: SourceId,
  canonicalSource: CanonicalIntelSource,
  reason: Schema.String,
})
export type SourceRejectionV1 = typeof SourceRejectionV1.Type

export const PlanDecisionV1 = Schema.TaggedStruct('PlanDecisionV1', {
  strategy: PlannerStrategy,
  selected: Schema.Array(SourceAttemptV1),
  rejected: Schema.Array(SourceRejectionV1),
})
export type PlanDecisionV1 = typeof PlanDecisionV1.Type

export const RegistryQueryPlanV1 = Schema.TaggedStruct('RegistryQueryPlanV1', {
  version: RegistryVersion,
  planId: Schema.String,
  intent: PlannerIntentV1,
  decision: PlanDecisionV1,
  generatedAt: Schema.Date,
})
export type RegistryQueryPlanV1 = typeof RegistryQueryPlanV1.Type
