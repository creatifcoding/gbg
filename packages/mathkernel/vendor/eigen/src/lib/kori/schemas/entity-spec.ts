/**
 * Entity Spec Schema
 *
 * Data-defined entity specifications stored in NATS KV.
 * Enables runtime construction of entity atom families with
 * spec-driven trait compositions.
 *
 * Flow: AVA → NATS KV → EntitySpec → Atom.family
 *
 * @module kori/schemas/entity-spec
 */

import { Schema } from 'effect'
import { TraitId } from './trait'

// =============================================================================
// Core Schemas
// =============================================================================

/**
 * Entity type identifier (e.g., "car", "boat", "scene3d_entity").
 * Used as the key in NATS KV bucket.
 */
export const EntityTypeId = Schema.String.pipe(
  Schema.brand('EntityTypeId'),
  Schema.minLength(1),
  Schema.maxLength(64),
  Schema.pattern(/^[a-z][a-z0-9_]*$/) // snake_case identifier
)
export type EntityTypeId = typeof EntityTypeId.Type

/**
 * Default value for a trait field.
 * Stored as JSON-compatible value.
 */
export const TraitDefault = Schema.Unknown
export type TraitDefault = typeof TraitDefault.Type

/**
 * Trait requirement within an entity spec.
 * Defines which trait + optional defaults.
 */
export const TraitRequirement = Schema.Struct({
  /** Trait identifier (must exist in trait registry) */
  traitId: TraitId,

  /** Whether this trait is required on spawn (default: true) */
  required: Schema.optional(Schema.Boolean),

  /** Default values for trait fields (merged with trait defaults) */
  defaults: Schema.optional(Schema.Record({
    key: Schema.String,
    value: TraitDefault,
  })),
})
export type TraitRequirement = typeof TraitRequirement.Type

/**
 * Entity Spec version info for cache invalidation.
 */
export const SpecVersion = Schema.Struct({
  /** Semantic version string */
  version: Schema.String.pipe(Schema.pattern(/^\d+\.\d+\.\d+$/)),

  /** Timestamp when spec was last modified */
  updatedAt: Schema.Number, // epoch ms

  /** Hash of spec contents for change detection */
  contentHash: Schema.String,
})
export type SpecVersion = typeof SpecVersion.Type

// =============================================================================
// Entity Spec Schema
// =============================================================================

/**
 * Entity Spec — defines trait composition for an entity type.
 *
 * Stored in NATS KV at: `entity-specs/{entityTypeId}`
 *
 * @example
 * ```json
 * {
 *   "_tag": "EntitySpec",
 *   "entityTypeId": "scene3d_entity",
 *   "displayName": "3D Scene Entity",
 *   "description": "Entities rendered in Scene3DBlock",
 *   "traits": [
 *     { "traitId": "Position3D", "defaults": { "x": 0, "y": 0, "z": 0 } },
 *     { "traitId": "Velocity3D", "defaults": { "vx": 0, "vy": 0, "vz": 0 } },
 *     { "traitId": "Renderable3D", "defaults": { "type": "sphere", "color": "#00ff88", "scale": 1 } }
 *   ],
 *   "version": { "version": "1.0.0", "updatedAt": 1703721600000, "contentHash": "abc123" }
 * }
 * ```
 */
export const EntitySpec = Schema.TaggedStruct('EntitySpec', {
  /** Unique entity type identifier */
  entityTypeId: EntityTypeId,

  /** Human-readable display name */
  displayName: Schema.NonEmptyString,

  /** Optional description */
  description: Schema.optional(Schema.String),

  /** Traits required for this entity type */
  traits: Schema.Array(TraitRequirement),

  /** Version info for cache invalidation */
  version: SpecVersion,

  /** Category for grouping in UI (e.g., "rendering", "physics", "ava") */
  category: Schema.optional(Schema.String),

  /** Whether entities of this type are singleton (only one per world) */
  singleton: Schema.optional(Schema.Boolean),

  /** Tags for filtering/querying (e.g., ["3d", "animated", "streaming"]) */
  tags: Schema.optional(Schema.Array(Schema.String)),
})
export type EntitySpec = typeof EntitySpec.Type

// =============================================================================
// Spec Registry (for fast lookup without NATS round-trip)
// =============================================================================

/**
 * In-memory cache of entity specs.
 * Populated from NATS KV on startup, updated via watch.
 */
export const EntitySpecRegistry = Schema.Struct({
  /** Map of entityTypeId → EntitySpec */
  specs: Schema.Record({
    key: Schema.String,
    value: EntitySpec,
  }),

  /** Timestamp of last sync from NATS KV */
  lastSyncAt: Schema.Number,

  /** Whether registry is fully loaded */
  isReady: Schema.Boolean,
})
export type EntitySpecRegistry = typeof EntitySpecRegistry.Type

// =============================================================================
// NATS KV Integration Types
// =============================================================================

/**
 * Bucket name for entity specs in NATS KV.
 */
export const ENTITY_SPEC_BUCKET = 'kori-entity-specs' as const

/**
 * Key pattern for entity specs: `{entityTypeId}`
 */
export function specKey(entityTypeId: EntityTypeId): string {
  return entityTypeId as string
}

/**
 * Watch pattern for all entity specs.
 */
export const SPEC_WATCH_PATTERN = '*' as const

// =============================================================================
// Spec Validation
// =============================================================================

/**
 * Validate that all traits in a spec exist in the trait registry.
 * Returns array of missing trait IDs.
 */
export function validateSpecTraits(
  spec: EntitySpec,
  registeredTraits: ReadonlySet<string>
): ReadonlyArray<string> {
  return spec.traits
    .map(t => t.traitId as string)
    .filter(id => !registeredTraits.has(id))
}

// =============================================================================
// Atom Key Generation
// =============================================================================

/**
 * Generate atom family key for an entity instance.
 * Format: `{entityTypeId}:{entityId}`
 */
export function entityAtomKey(
  entityTypeId: EntityTypeId,
  entityId: string
): string {
  return `${entityTypeId}:${entityId}`
}

/**
 * Parse atom family key back to components.
 */
export function parseEntityAtomKey(
  key: string
): { entityTypeId: string; entityId: string } | null {
  const [entityTypeId, entityId] = key.split(':')
  if (!entityTypeId || !entityId) return null
  return { entityTypeId, entityId }
}

// =============================================================================
// Default Specs (Pre-registered)
// =============================================================================

/**
 * Scene3D entity spec — matches existing Scene3DBlock EntityData.
 */
export const Scene3DEntitySpec: EntitySpec = {
  _tag: 'EntitySpec',
  entityTypeId: 'scene3d_entity' as EntityTypeId,
  displayName: '3D Scene Entity',
  description: 'Entities rendered in react-three-fiber Scene3DBlock',
  traits: [
    {
      traitId: 'Position3D' as TraitId,
      required: true,
      defaults: { x: 0, y: 0, z: 0 },
    },
    {
      traitId: 'Velocity3D' as TraitId,
      required: false,
      defaults: { vx: 0, vy: 0, vz: 0 },
    },
    {
      traitId: 'Renderable3D' as TraitId,
      required: true,
      defaults: {
        type: 'sphere',
        color: '#00ff88',
        scale: 1,
        metalness: 0.7,
        roughness: 0.3,
        emissiveIntensity: 0.2,
      },
    },
    {
      traitId: 'Name' as TraitId,
      required: false,
    },
  ],
  version: {
    version: '1.0.0',
    updatedAt: Date.now(),
    contentHash: 'builtin-scene3d-v1',
  },
  category: 'rendering',
  tags: ['3d', 'animated', 'streaming'],
}

/**
 * AVA View entity spec — for AVA artifact streaming.
 */
export const AvaViewEntitySpec: EntitySpec = {
  _tag: 'EntitySpec',
  entityTypeId: 'ava_view' as EntityTypeId,
  displayName: 'AVA View Entity',
  description: 'Entities representing AVA view artifacts',
  traits: [
    {
      traitId: 'ViewData' as TraitId,
      required: true,
    },
    {
      traitId: 'ViewMeta' as TraitId,
      required: true,
    },
    {
      traitId: 'ViewStatus' as TraitId,
      required: true,
      defaults: { state: 'idle', lastError: null },
    },
    {
      traitId: 'Name' as TraitId,
      required: false,
    },
  ],
  version: {
    version: '1.0.0',
    updatedAt: Date.now(),
    contentHash: 'builtin-ava-view-v1',
  },
  category: 'ava',
  tags: ['ava', 'streaming', 'artifact'],
  singleton: false,
}

/**
 * Built-in entity specs.
 */
export const BUILTIN_SPECS: ReadonlyArray<EntitySpec> = [
  Scene3DEntitySpec,
  AvaViewEntitySpec,
]
