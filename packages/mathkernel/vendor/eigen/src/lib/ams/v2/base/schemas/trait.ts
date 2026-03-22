/**
 * AMS v2 Trait Schema
 *
 * Extensible behavior attachments for assets.
 *
 * @module @gbg/tmnl/ams/v2/base/schemas/trait
 */

import { Schema } from 'effect'
import { TraitId } from '../../core/schemas/identifiers'

// ─────────────────────────────────────────────────────────────────────────────
// Trait Parameters
// ─────────────────────────────────────────────────────────────────────────────

export const TraitParams = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
}).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Trait/fields/TraitParams'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/TraitParams',
    description: 'Arbitrary parameter map for a trait instance',
  })
)
export type TraitParams = typeof TraitParams.Type

// ─────────────────────────────────────────────────────────────────────────────
// Trait Instance (attached to an asset)
// ─────────────────────────────────────────────────────────────────────────────

export class TraitInstance extends Schema.TaggedClass<TraitInstance>()('TraitInstance', {
  traitId: TraitId,
  params: Schema.optional(TraitParams),
}) {}
export type TraitInstanceType = typeof TraitInstance.Type

/**
 * Array of trait instances attached to an asset.
 */
export const AssetTraits = Schema.Array(TraitInstance).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Trait/fields/AssetTraits'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/AssetTraits',
    description: 'Array of trait instances attached to an asset',
  })
)
export type AssetTraits = typeof AssetTraits.Type

// ─────────────────────────────────────────────────────────────────────────────
// Trait Definition (schema for a trait type)
// ─────────────────────────────────────────────────────────────────────────────

export class TraitDefinition extends Schema.TaggedClass<TraitDefinition>()('TraitDefinition', {
  id: TraitId,
  label: Schema.String,
  description: Schema.optional(Schema.String),
  paramsSchema: Schema.optional(Schema.Unknown), // JSON Schema or Effect Schema ref
}) {}
export type TraitDefinitionType = typeof TraitDefinition.Type
