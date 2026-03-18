/**
 * @tmnl/entity — Universal Entity Metadata Envelope
 *
 * Every entity carries 12 base metadata fields injected by
 * `Entity.withMeta('Tag')(domainFields)`.
 *
 * Two construction paths:
 *   - `new Todo({ ...allFields })` — deserialization, all fields required
 *   - `Todo.create({ ...domainFields })` — smart factory, meta auto-fills
 *
 * Auto-fill sources:
 *   - Deterministic: entityId (UUID v4), timestamps, deletedAt/archivedAt (null), version (0)
 *   - From EntityContext: createdBy, updatedBy, ownerId, tenantId, source, classification
 *
 * ┌────────────────────────────────────────────────────────────┐
 * │                  Entity Metadata Envelope                  │
 * ├────────────────┬──────────────┬────────────────────────────┤
 * │ Field          │ Auto-fill    │ Source                     │
 * ├────────────────┼──────────────┼────────────────────────────┤
 * │ entityId       │ UUID v4      │ crypto.randomUUID()        │
 * │ createdAt      │ Date.now()   │ deterministic              │
 * │ updatedAt      │ Date.now()   │ deterministic              │
 * │ deletedAt      │ null         │ deterministic              │
 * │ archivedAt     │ null         │ deterministic              │
 * │ version        │ 0            │ deterministic              │
 * │ mutationCount  │ 0            │ deterministic              │
 * │ createdBy      │ ctx.userId   │ EntityContext               │
 * │ updatedBy      │ ctx.userId   │ EntityContext               │
 * │ ownerId        │ ctx.userId   │ EntityContext               │
 * │ tenantId       │ ctx.tenantId │ EntityContext               │
 * │ sourceIds      │ [ctx.srcId]  │ EntityContext (initial)     │
 * │ classification │ ctx.class.   │ EntityContext               │
 * └────────────────┴──────────────┴────────────────────────────┘
 *
 * @since 0.1.0
 * @module
 */

import * as Schema from 'effect-v4/Schema'
import { Entity, type EntityConfig } from './entity.js'
import { EntityContext } from './context.js'

// ─── Sub-Schemas ─────────────────────────────────────────────

/**
 * IC/DoD classification markings.
 * Required on every entity. Never sent over the wire (sensitive).
 */
export const Classification = Schema.Literals([
  'UNCLASSIFIED',
  'CUI',
  'CONFIDENTIAL',
  'SECRET',
  'TOP_SECRET',
  'TOP_SECRET_SCI',
] as const)
export type Classification = typeof Classification.Type

/**
 * Typed reference to a user-defined SourceDefinition.
 *
 * The entity framework doesn't prescribe source types — domains
 * register their own. This field is the foreign key.
 *
 * ```ts
 * // Domain defines sources
 * const SOURCES = {
 *   analyst:   { id: 'analyst',   label: 'Analyst (manual)',   reliability: 'A' },
 *   sensor:    { id: 'sensor',    label: 'Sensor feed',        reliability: 'B' },
 *   import:    { id: 'import',    label: 'Legacy import',      reliability: 'C' },
 * } as const
 *
 * // Entity carries the reference
 * const aoi = AreaOfInterest.create({ ...fields, sourceId: 'sensor' })
 * ```
 */
export const SourceId = Schema.String

// ─── EntityId ────────────────────────────────────────────────

/**
 * Branded UUID v4 string for entity identity.
 *
 * Generated via `crypto.randomUUID()` — universally available
 * (Node 19+, Bun, browsers). Paired with `createdAt` for
 * chronological ordering when needed.
 */
export const EntityId = Schema.String.pipe(Schema.brand('EntityId'))
export type EntityId = typeof EntityId.Type

// ─── The Envelope ────────────────────────────────────────────

/**
 * The 12 base metadata fields injected into every entity.
 *
 * | Field          | Kind      | Insert | Update | Wire  | Auto-fill      |
 * |----------------|-----------|--------|--------|-------|----------------|
 * | entityId       | generated | ✗      | ✗      | ✓     | UUID v4        |
 * | createdAt      | timestamp | opt    | opt    | ✓     | Date.now()     |
 * | updatedAt      | timestamp | opt    | opt    | ✓     | Date.now()     |
 * | deletedAt      | readonly  | ✗      | ✗      | ✓     | null           |
 * | archivedAt     | readonly  | ✗      | ✗      | ✓     | null           |
 * | version        | readonly  | ✗      | ✗      | ✓     | 0              |
 * | mutationCount  | readonly  | ✗      | ✗      | ✓     | 0              |
 * | createdBy      | data      | ✓      | ✓      | ✓     | ctx.userId     |
 * | updatedBy      | data      | ✓      | ✓      | ✓     | ctx.userId     |
 * | ownerId        | data      | ✓      | ✓      | ✓     | ctx.userId     |
 * | tenantId       | data      | ✓      | ✓      | ✓     | ctx.tenantId   |
 * | sourceIds      | readonly  | ✗      | ✗      | ✓     | [ctx.sourceId] |
 * | classification | sensitive | ✓      | ✓      | ✗     | ctx.class.     |
 */
export const EntityMetaFields = {
  // ── Identity ──
  entityId: Entity.generated(EntityId),

  // ── Temporal (auto-managed) ──
  createdAt: Entity.timestamp(),
  updatedAt: Entity.timestamp(),

  // ── Soft delete / archive (server-managed, nullable) ──
  deletedAt:  Entity.readonly(Schema.NullOr(Schema.Number)),
  archivedAt: Entity.readonly(Schema.NullOr(Schema.Number)),

  // ── Optimistic concurrency ──
  version: Entity.readonly(Schema.Number),

  // ── Multi-source provenance ──
  mutationCount: Entity.readonly(Schema.Number),

  // ── Audit / Provenance ──
  createdBy: Schema.String,
  updatedBy: Schema.String,
  ownerId:   Schema.String,
  tenantId:  Schema.String,
  sourceIds: Entity.readonly(Schema.Array(SourceId)),

  // ── Security ──
  classification: Entity.sensitive(Classification),
} as const

/**
 * Field names that belong to the metadata envelope.
 */
export const META_FIELD_NAMES = Object.keys(EntityMetaFields) as ReadonlyArray<keyof typeof EntityMetaFields>

/**
 * Number of metadata fields injected by withMeta.
 */
export const META_FIELD_COUNT = META_FIELD_NAMES.length // 12

// ─── Auto-Fill Defaults ──────────────────────────────────────

/**
 * Build the auto-fill defaults for `.create()`.
 *
 * Deterministic fields are computed inline.
 * Context-dependent fields are read from EntityContext.
 *
 * @internal
 */
function buildDefaults(): Record<string, unknown> {
  const ctx = EntityContext.get()
  const now = Date.now()

  return {
    // Deterministic
    entityId:      globalThis.crypto.randomUUID(),
    createdAt:     now,
    updatedAt:     now,
    deletedAt:     null,
    archivedAt:    null,
    version:       0,
    mutationCount: 0,

    // From EntityContext
    createdBy:      ctx.userId,
    updatedBy:      ctx.userId,
    ownerId:        ctx.userId,
    tenantId:       ctx.tenantId,
    sourceIds:      [ctx.sourceId],
    classification: ctx.classification,
  }
}

// ─── Provenance Dereferencing Schema ─────────────────────────

/**
 * Provenance reference — the dereference key for field-level provenance.
 *
 * This is NOT the provenance data. It's the **pointer** that tells you
 * how to go fetch it from the sidecar store (Postgres table, API, cache).
 *
 * ```ts
 * // The entity carries the ref
 * const ref = ProvenanceRef.make({
 *   entityId: aoi.entityId,
 *   fieldName: 'polygonWkt',
 * })
 *
 * // The sidecar resolves it
 * const trail = await provenanceStore.query(ref)
 * // → [{ sourceId: 'analyst', confidence: 95, ... }, { sourceId: 'sensor-003', ... }]
 * ```
 */
export const ProvenanceRef = Schema.Struct({
  /** Entity this provenance belongs to */
  entityId: Schema.String,
  /** Specific field being tracked */
  fieldName: Schema.String,
})
export type ProvenanceRef = typeof ProvenanceRef.Type

/**
 * Provenance summary — lightweight warm-cache hint per tracked field.
 *
 * This is what you display in a tooltip, badge, or sidebar without
 * hitting the full sidecar. Small enough to carry on the entity
 * or in a parallel sync shape.
 *
 * ```ts
 * // "Last updated by sensor-003 at 92% confidence, 2 min ago"
 * const summary: ProvenanceSummary = {
 *   fieldName:   'coverageScore',
 *   sourceId:    'sensor-003',
 *   actor:       'ml-pipeline',
 *   confidence:  92,
 *   timestamp:   1741834956000,
 *   sourceCount: 3,  // 3 different sources have touched this field
 * }
 * ```
 */
export const ProvenanceSummary = Schema.Struct({
  /** Which field this summary describes */
  fieldName: Schema.String,
  /** Most recent source that set this field */
  sourceId: Schema.String,
  /** Actor who performed the mutation */
  actor: Schema.String,
  /** Confidence score of the most recent mutation (0-100) */
  confidence: Schema.Number,
  /** When this field was last set */
  timestamp: Schema.Number,
  /** How many distinct sources have contributed to this field */
  sourceCount: Schema.Number,
})
export type ProvenanceSummary = typeof ProvenanceSummary.Type

/**
 * Full provenance record — one row in the sidecar table.
 *
 * This is what the sidecar stores. Each row captures a single
 * field attribution from a single source at a single point in time.
 *
 * ```sql
 * CREATE TABLE field_provenance (
 *   id          TEXT PRIMARY KEY,
 *   entity_id   TEXT NOT NULL,
 *   field_name  TEXT NOT NULL,
 *   source_id   TEXT NOT NULL,
 *   actor       TEXT NOT NULL,
 *   timestamp   BIGINT NOT NULL,
 *   confidence  INTEGER NOT NULL,
 *   old_value   JSONB,
 *   new_value   JSONB NOT NULL
 * );
 *
 * CREATE INDEX idx_prov_entity_field ON field_provenance(entity_id, field_name);
 * CREATE INDEX idx_prov_source       ON field_provenance(source_id);
 * CREATE INDEX idx_prov_timestamp    ON field_provenance(timestamp);
 * ```
 */
export const ProvenanceRecord = Schema.Struct({
  /** Unique provenance record ID */
  id: Schema.String,
  /** Entity this record belongs to */
  entityId: Schema.String,
  /** Field that was mutated */
  fieldName: Schema.String,
  /** Source that performed the mutation */
  sourceId: Schema.String,
  /** Actor (user/agent/system) who triggered it */
  actor: Schema.String,
  /** When the mutation occurred */
  timestamp: Schema.Number,
  /** Confidence score (0-100) */
  confidence: Schema.Number,
  /** Previous value (null on first write) */
  oldValue: Schema.Unknown,
  /** New value after mutation */
  newValue: Schema.Unknown,
})
export type ProvenanceRecord = typeof ProvenanceRecord.Type

/**
 * Build ProvenanceRef keys for all tracked fields on an entity.
 *
 * ```ts
 * const refs = buildProvenanceRefs(aoi.entityId, AreaOfInterest.TRACKED_FIELDS)
 * // → [
 * //     { entityId: 'abc', fieldName: 'polygonWkt' },
 * //     { entityId: 'abc', fieldName: 'centroidLat' },
 * //     ...
 * //   ]
 * ```
 */
export function buildProvenanceRefs(
  entityId: string,
  trackedFields: readonly string[],
): readonly ProvenanceRef[] {
  return trackedFields.map(fieldName => ({ entityId, fieldName }))
}

// ─── withMeta Factory ────────────────────────────────────────

/**
 * Higher-order Entity factory that auto-injects the metadata envelope
 * and attaches a `.create()` smart constructor.
 *
 * **Two construction paths:**
 *
 * ```ts
 * // Smart create — only domain fields required
 * // Meta auto-fills from deterministic defaults + EntityContext
 * const todo = Todo.create({ text: 'Buy milk', completed: false })
 *
 * // Override any default
 * const imported = Todo.create({
 *   text: 'Historical item',
 *   completed: true,
 *   createdAt: importedTimestamp,     // override auto-fill
 *   classification: 'SECRET',         // override context default
 * })
 *
 * // Full constructor — all fields required (deserialization)
 * const deserialized = new Todo({ entityId: '...', createdAt: ..., ... })
 * ```
 *
 * @param tag - Entity name tag
 */
export function withMeta<Tag extends string>(tag: Tag) {
  return <Fields extends Record<string, any>>(
    domainFields: Fields,
    config?: EntityConfig,
  ) => {
    // Domain fields override metadata fields (intentional escape hatch)
    const mergedFields = { ...EntityMetaFields, ...domainFields }
    const ModelClass = Entity(tag)(mergedFields, config) as any

    /**
     * Smart constructor — only domain fields required.
     *
     * Auto-fills all 12 metadata fields:
     *   - entityId:       crypto.randomUUID()
     *   - createdAt:      Date.now()
     *   - updatedAt:      Date.now()
     *   - deletedAt:      null
     *   - archivedAt:     null
     *   - version:        0
     *   - mutationCount:  0
     *   - createdBy:      EntityContext.userId
     *   - updatedBy:      EntityContext.userId
     *   - ownerId:        EntityContext.userId
     *   - tenantId:       EntityContext.tenantId
     *   - sourceIds:      [EntityContext.sourceId]
     *   - classification: EntityContext.classification
     *
     * Any field can be overridden by passing it explicitly.
     */
    ModelClass.create = (props: any) => {
      const defaults = buildDefaults()
      // Props override defaults — caller wins
      return new ModelClass({ ...defaults, ...props })
    }

    return ModelClass
  }
}
