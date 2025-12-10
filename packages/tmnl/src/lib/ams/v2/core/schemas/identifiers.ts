/**
 * AMS v2 Branded Identifiers
 *
 * All entity identifiers use branded types with versioned paths.
 * Pattern: @gbg/tmnl/ams/v2/{Entity}/fields/{Field}
 *
 * @module @gbg/tmnl/ams/v2/core/schemas/identifiers
 */

import { Schema } from 'effect'

// ─────────────────────────────────────────────────────────────────────────────
// Base Entity Identifier
// ─────────────────────────────────────────────────────────────────────────────

export const EntityId = Schema.Union(
  Schema.UUID,
  Schema.String.pipe(Schema.minLength(1)),
  Schema.Number.pipe(Schema.int())
).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Entity/fields/EntityId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/EntityId',
    description: 'Flexible entity identifier (UUID, string, or number)',
  })
)
export type EntityId = typeof EntityId.Type

// ─────────────────────────────────────────────────────────────────────────────
// Asset Identifiers
// ─────────────────────────────────────────────────────────────────────────────

export const AssetId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Asset/fields/AssetId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/AssetId',
    description: 'Unique identifier for an Asset (DID or UUID)',
  })
)
export type AssetId = typeof AssetId.Type

export const AssetKind = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Asset/fields/AssetKind'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/AssetKind',
    description: 'Asset kind code (e.g., HAND_TOOL, VEHICLE)',
  })
)
export type AssetKind = typeof AssetKind.Type

export const AssetLabel = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Asset/fields/AssetLabel'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/AssetLabel',
    description: 'Human-readable label for an Asset',
  })
)
export type AssetLabel = typeof AssetLabel.Type

export const AssetDescription = Schema.String.pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Asset/fields/AssetDescription'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/AssetDescription',
    description: 'Optional description of an Asset',
  })
)
export type AssetDescription = typeof AssetDescription.Type

// ─────────────────────────────────────────────────────────────────────────────
// Location Identifiers
// ─────────────────────────────────────────────────────────────────────────────

export const SiteId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Site/fields/SiteId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/SiteId',
    description: 'Unique identifier for a Site',
  })
)
export type SiteId = typeof SiteId.Type

export const SectorId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Sector/fields/SectorId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/SectorId',
    description: 'Unique identifier for a Sector within a Site',
  })
)
export type SectorId = typeof SectorId.Type

export const ContainerId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Container/fields/ContainerId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/ContainerId',
    description: 'Unique identifier for a Container',
  })
)
export type ContainerId = typeof ContainerId.Type

export const CarrierId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Carrier/fields/CarrierId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/CarrierId',
    description: 'Unique identifier for a Carrier (mobile container)',
  })
)
export type CarrierId = typeof CarrierId.Type

// ─────────────────────────────────────────────────────────────────────────────
// Policy & Governance
// ─────────────────────────────────────────────────────────────────────────────

export const PolicyId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Policy/fields/PolicyId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/PolicyId',
    description: 'Unique identifier for a Policy',
  })
)
export type PolicyId = typeof PolicyId.Type

export const PolicyIds = Schema.Array(PolicyId).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Policy/fields/PolicyIds'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/PolicyIds',
    description: 'Array of Policy identifiers',
  })
)
export type PolicyIds = typeof PolicyIds.Type

// ─────────────────────────────────────────────────────────────────────────────
// Property & Trait
// ─────────────────────────────────────────────────────────────────────────────

export const PropertyKey = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Property/fields/PropertyKey'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/PropertyKey',
    description: 'Property key for asset properties',
  })
)
export type PropertyKey = typeof PropertyKey.Type

export const TraitId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Trait/fields/TraitId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/TraitId',
    description: 'Unique identifier for a Trait definition',
  })
)
export type TraitId = typeof TraitId.Type

// ─────────────────────────────────────────────────────────────────────────────
// Identity
// ─────────────────────────────────────────────────────────────────────────────

export const IdentityId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Identity/fields/IdentityId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/IdentityId',
    description: 'Identity identifier (user, system, or agent)',
  })
)
export type IdentityId = typeof IdentityId.Type

// ─────────────────────────────────────────────────────────────────────────────
// Ontology Types
// ─────────────────────────────────────────────────────────────────────────────

export const AssetTypeId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/AssetType/fields/AssetTypeId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/AssetTypeId',
    description: 'Identifier for an AssetType in the ontology',
  })
)
export type AssetTypeId = typeof AssetTypeId.Type

export const ContainerTypeId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/ContainerType/fields/ContainerTypeId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/ContainerTypeId',
    description: 'Identifier for a ContainerType in the ontology',
  })
)
export type ContainerTypeId = typeof ContainerTypeId.Type

export const SectorTypeId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/SectorType/fields/SectorTypeId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/SectorTypeId',
    description: 'Identifier for a SectorType in the ontology',
  })
)
export type SectorTypeId = typeof SectorTypeId.Type

// ─────────────────────────────────────────────────────────────────────────────
// Tags
// ─────────────────────────────────────────────────────────────────────────────

export const Tag = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Tag/fields/Tag'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/Tag',
    description: 'Tag for faceted search and profiling',
  })
)
export type Tag = typeof Tag.Type

export const Tags = Schema.Array(Tag).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Tag/fields/Tags'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/Tags',
    description: 'Array of tags',
  })
)
export type Tags = typeof Tags.Type
