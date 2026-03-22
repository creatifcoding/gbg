/**
 * AMS v2 Property Schema
 *
 * Asset property values with provenance tracking.
 *
 * @module @gbg/tmnl/ams/v2/base/schemas/property
 */

import { Schema } from 'effect'
import { PropertyKey } from '../../core/schemas/identifiers'
import { Provenance } from '../../core/schemas/provenance'

// ─────────────────────────────────────────────────────────────────────────────
// Property Value
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Raw property value — unknown type, validated via external registry.
 */
export const PropertyValue = Schema.Unknown.pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Property/fields/PropertyValue'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/PropertyValue',
    description: 'Raw property value (validated via property definition)',
  })
)
export type PropertyValue = typeof PropertyValue.Type

/**
 * Whether a property is mutable under current policy.
 */
export const PropertyMutable = Schema.Boolean.pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Property/fields/PropertyMutable'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/PropertyMutable',
    description: 'Whether property is mutable under current policy',
  })
)
export type PropertyMutable = typeof PropertyMutable.Type

// ─────────────────────────────────────────────────────────────────────────────
// Asset Property (value + provenance)
// ─────────────────────────────────────────────────────────────────────────────

export class AssetProperty extends Schema.TaggedClass<AssetProperty>()('AssetProperty', {
  key: PropertyKey,
  value: PropertyValue,
  provenance: Provenance,
  mutable: PropertyMutable,
}) {}
export type AssetPropertyType = typeof AssetProperty.Type

/**
 * Array of asset properties.
 */
export const AssetProperties = Schema.Array(AssetProperty).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Property/fields/AssetProperties'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/AssetProperties',
    description: 'Array of asset properties with provenance',
  })
)
export type AssetProperties = typeof AssetProperties.Type

// ─────────────────────────────────────────────────────────────────────────────
// Property Definition (schema for a property type)
// ─────────────────────────────────────────────────────────────────────────────

export const PropertyValueType = Schema.Literal('string', 'number', 'boolean', 'json').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Property/fields/PropertyValueType'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/PropertyValueType',
    description: 'Type of property value',
  })
)
export type PropertyValueType = typeof PropertyValueType.Type

export class PropertyDefinition extends Schema.TaggedClass<PropertyDefinition>()('PropertyDefinition', {
  id: PropertyKey,
  key: PropertyKey,
  valueType: PropertyValueType,
  required: Schema.optional(Schema.Boolean),
  description: Schema.optional(Schema.String),
}) {}
export type PropertyDefinitionType = typeof PropertyDefinition.Type
