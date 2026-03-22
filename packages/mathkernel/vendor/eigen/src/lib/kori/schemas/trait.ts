/**
 * KORI Trait Schema System
 *
 * Traits as Effect.Schema.TaggedStruct with defu-style composition.
 * Runtime validation, encode/decode, and merge semantics.
 *
 * @module
 */

import { Schema, Effect, pipe } from "effect"
import type { ParseError } from "effect/ParseResult"
import { TraitValidationFailed } from "../errors"

// ─────────────────────────────────────────────────────────────────────────────
// Core Trait Schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base trait identifier schema.
 */
export const TraitId = Schema.String.pipe(
  Schema.brand("TraitId"),
  Schema.minLength(1)
)
export type TraitId = typeof TraitId.Type

/**
 * Trait metadata attached to all traits.
 */
export const TraitMeta = Schema.Struct({
  id: TraitId,
  version: Schema.Number.pipe(Schema.int(), Schema.positive()),
  createdAt: Schema.DateFromSelf,
  updatedAt: Schema.DateFromSelf,
})
export type TraitMeta = typeof TraitMeta.Type

// ─────────────────────────────────────────────────────────────────────────────
// Trait Definition Factory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Define a trait schema with automatic _tag and metadata.
 *
 * @example
 * ```ts
 * const Position = defineTrait("Position", {
 *   x: Schema.Number,
 *   y: Schema.Number,
 *   z: Schema.Number,
 * })
 *
 * const pos: Position = { _tag: "Position", x: 0, y: 0, z: 0, ... }
 * ```
 */
export function defineTrait<
  Tag extends string,
  Fields extends Schema.Struct.Fields
>(
  tag: Tag,
  fields: Fields
): Schema.TaggedStruct<Tag, Fields> {
  return Schema.TaggedStruct(tag, fields)
}

/**
 * Define a tag-only trait (no data, just marker).
 *
 * @example
 * ```ts
 * const IsPlayer = defineTagTrait("IsPlayer")
 * const IsEnemy = defineTagTrait("IsEnemy")
 * ```
 */
export function defineTagTrait<Tag extends string>(
  tag: Tag
): Schema.TaggedStruct<Tag, {}> {
  return Schema.TaggedStruct(tag, {})
}

// ─────────────────────────────────────────────────────────────────────────────
// Built-in Traits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 2D Position trait.
 */
export const Position2D = defineTrait("Position2D", {
  x: Schema.Number,
  y: Schema.Number,
})
export type Position2D = typeof Position2D.Type

/**
 * 3D Position trait.
 */
export const Position3D = defineTrait("Position3D", {
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
})
export type Position3D = typeof Position3D.Type

/**
 * Velocity trait (2D).
 */
export const Velocity2D = defineTrait("Velocity2D", {
  vx: Schema.Number,
  vy: Schema.Number,
})
export type Velocity2D = typeof Velocity2D.Type

/**
 * Velocity trait (3D).
 */
export const Velocity3D = defineTrait("Velocity3D", {
  vx: Schema.Number,
  vy: Schema.Number,
  vz: Schema.Number,
})
export type Velocity3D = typeof Velocity3D.Type

/**
 * Health trait with min/max.
 */
export const Health = defineTrait("Health", {
  current: Schema.Number.pipe(Schema.nonNegative()),
  max: Schema.Number.pipe(Schema.positive()),
})
export type Health = typeof Health.Type

/**
 * Name trait.
 */
export const Name = defineTrait("Name", {
  value: Schema.NonEmptyString,
})
export type Name = typeof Name.Type

/**
 * Lifetime trait with TTL.
 */
export const Lifetime = defineTrait("Lifetime", {
  spawnedAt: Schema.DateFromSelf,
  ttlMs: Schema.Number.pipe(Schema.positive()),
})
export type Lifetime = typeof Lifetime.Type

/**
 * Parent-child relationship trait.
 */
export const ParentOf = defineTrait("ParentOf", {
  children: Schema.Array(Schema.String),
})
export type ParentOf = typeof ParentOf.Type

/**
 * Child-parent relationship trait.
 */
export const ChildOf = defineTrait("ChildOf", {
  parentId: Schema.String,
})
export type ChildOf = typeof ChildOf.Type

// ─────────────────────────────────────────────────────────────────────────────
// Rendering Traits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderable3D trait for Scene3DBlock entities.
 * Maps to react-three-fiber mesh rendering.
 */
export const Renderable3D = defineTrait("Renderable3D", {
  type: Schema.Literal("sphere", "box", "torus", "mesh"),
  color: Schema.String,
  scale: Schema.Number.pipe(Schema.positive()),
  metalness: Schema.Number.pipe(Schema.clamp(0, 1)),
  roughness: Schema.Number.pipe(Schema.clamp(0, 1)),
  emissiveIntensity: Schema.Number.pipe(Schema.clamp(0, 1)),
})
export type Renderable3D = typeof Renderable3D.Type

// ─────────────────────────────────────────────────────────────────────────────
// AVA View Traits
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ViewData trait — payload from AVA artifact.
 * Stores the actual data content from the view.
 */
export const ViewData = defineTrait("ViewData", {
  viewId: Schema.String,
  payload: Schema.Unknown,
  version: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
})
export type ViewData = typeof ViewData.Type

/**
 * ViewMeta trait — metadata from AVA artifact.
 * Stores hydration and spec information.
 */
export const ViewMeta = defineTrait("ViewMeta", {
  viewId: Schema.String,
  specHash: Schema.String,
  hydratedAt: Schema.Number, // timestamp in ms
})
export type ViewMeta = typeof ViewMeta.Type

/**
 * ViewStatus trait — runtime status of view entity.
 * Tracks lifecycle state and errors.
 */
export const ViewStatus = defineTrait("ViewStatus", {
  state: Schema.Literal("idle", "hydrating", "ready", "error", "stale"),
  lastError: Schema.NullOr(Schema.String),
})
export type ViewStatus = typeof ViewStatus.Type

// ─────────────────────────────────────────────────────────────────────────────
// Tag Traits (Markers)
// ─────────────────────────────────────────────────────────────────────────────

export const IsPlayer = defineTagTrait("IsPlayer")
export type IsPlayer = typeof IsPlayer.Type

export const IsEnemy = defineTagTrait("IsEnemy")
export type IsEnemy = typeof IsEnemy.Type

export const IsActive = defineTagTrait("IsActive")
export type IsActive = typeof IsActive.Type

export const IsDestroyed = defineTagTrait("IsDestroyed")
export type IsDestroyed = typeof IsDestroyed.Type

// ─────────────────────────────────────────────────────────────────────────────
// Trait Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate trait data against its schema.
 * Returns Effect with TraitValidationFailed error on failure.
 */
export function validateTrait<A, I>(
  schema: Schema.Schema<A, I>,
  data: unknown,
  traitId: string
): Effect.Effect<A, TraitValidationFailed> {
  return pipe(
    Schema.decodeUnknown(schema)(data),
    Effect.mapError((parseError): TraitValidationFailed =>
      new TraitValidationFailed({
        traitId,
        reason: formatParseError(parseError),
        data,
      })
    )
  )
}

/**
 * Encode trait data for serialization.
 */
export function encodeTrait<A, I>(
  schema: Schema.Schema<A, I>,
  data: A,
  traitId: string
): Effect.Effect<I, TraitValidationFailed> {
  return pipe(
    Schema.encode(schema)(data),
    Effect.mapError((parseError): TraitValidationFailed =>
      new TraitValidationFailed({
        traitId,
        reason: formatParseError(parseError),
        data,
      })
    )
  )
}

/**
 * Format ParseError for human-readable message.
 */
function formatParseError(error: ParseError): string {
  // Simple formatting — in production, use Schema.TreeFormatter
  return `Validation failed: ${JSON.stringify(error.issue, null, 2)}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Trait Uniqueness
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the unique key from trait data.
 * The key is used to enforce uniqueness across all entities.
 */
export type UniqueKeyExtractor = (data: unknown) => string

/**
 * Uniqueness constraint configuration for a trait.
 */
export interface TraitUniqueness {
  /** Whether this trait's value must be unique across all entities */
  readonly unique: true
  /** Extracts the unique key from trait data */
  readonly uniqueKey: UniqueKeyExtractor
}

// ─────────────────────────────────────────────────────────────────────────────
// Trait Registry (Runtime Type Info)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registry entry for a trait schema.
 */
export interface TraitRegistryEntry {
  readonly id: TraitId
  readonly schema: Schema.Schema.AnyNoContext
  readonly isTag: boolean
  /** Optional uniqueness constraint */
  readonly uniqueness?: TraitUniqueness
}

/**
 * Mutable trait registry for runtime schema lookup.
 */
const traitRegistry = new Map<string, TraitRegistryEntry>()

/**
 * Options for registering a trait.
 */
export interface RegisterTraitOptions {
  /** Whether this is a tag trait (no data, just marker) */
  readonly isTag?: boolean
  /** Uniqueness constraint */
  readonly uniqueness?: TraitUniqueness
}

/**
 * Register a trait schema.
 */
export function registerTrait(
  id: TraitId,
  schema: Schema.Schema.AnyNoContext,
  options: RegisterTraitOptions | boolean = {}
): void {
  // Backwards compatibility: if options is a boolean, treat as isTag
  const opts: RegisterTraitOptions = typeof options === "boolean"
    ? { isTag: options }
    : options

  traitRegistry.set(id as string, {
    id,
    schema,
    isTag: opts.isTag ?? false,
    uniqueness: opts.uniqueness,
  })
}

/**
 * Check if a trait has uniqueness constraints.
 */
export function isUniqueTrait(id: TraitId): boolean {
  const entry = traitRegistry.get(id as string)
  return entry?.uniqueness?.unique === true
}

/**
 * Get the unique key extractor for a trait.
 */
export function getUniqueKeyExtractor(id: TraitId): UniqueKeyExtractor | undefined {
  const entry = traitRegistry.get(id as string)
  return entry?.uniqueness?.uniqueKey
}

/**
 * Get a registered trait schema.
 */
export function getTraitSchema(id: TraitId): TraitRegistryEntry | undefined {
  return traitRegistry.get(id as string)
}

/**
 * List all registered trait IDs.
 */
export function listTraits(): ReadonlyArray<TraitId> {
  return Array.from(traitRegistry.keys()) as TraitId[]
}

// Pre-register built-in traits
registerTrait("Position2D" as TraitId, Position2D)
registerTrait("Position3D" as TraitId, Position3D)
registerTrait("Velocity2D" as TraitId, Velocity2D)
registerTrait("Velocity3D" as TraitId, Velocity3D)
registerTrait("Health" as TraitId, Health)
registerTrait("Name" as TraitId, Name, {
  uniqueness: {
    unique: true,
    uniqueKey: (data) => (data as { value: string }).value,
  },
})
registerTrait("Lifetime" as TraitId, Lifetime)
registerTrait("ParentOf" as TraitId, ParentOf)
registerTrait("ChildOf" as TraitId, ChildOf)
registerTrait("IsPlayer" as TraitId, IsPlayer, true)
registerTrait("IsEnemy" as TraitId, IsEnemy, true)
registerTrait("IsActive" as TraitId, IsActive, true)
registerTrait("IsDestroyed" as TraitId, IsDestroyed, true)

// Rendering traits
registerTrait("Renderable3D" as TraitId, Renderable3D)

// AVA View traits
registerTrait("ViewData" as TraitId, ViewData)
registerTrait("ViewMeta" as TraitId, ViewMeta)
registerTrait("ViewStatus" as TraitId, ViewStatus)
