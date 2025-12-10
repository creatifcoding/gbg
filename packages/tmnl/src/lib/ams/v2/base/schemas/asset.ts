/**
 * AMS v2 Asset Schema
 *
 * Core Asset entity with BFO grounding, provenance, traits, properties.
 *
 * @module @gbg/tmnl/ams/v2/base/schemas/asset
 */

import { Schema } from 'effect'
import {
  AssetId,
  AssetKind,
  AssetLabel,
  AssetDescription,
  SiteId,
  SectorId,
  ContainerId,
  PolicyIds,
  Tags,
} from '../../core/schemas/identifiers'
import { BfoMaterialEntity } from '../../core/schemas/bfo'
import { CreatedAt, UpdatedAt } from '../../core/schemas/timestamps'
import { AssetProperties } from './property'
import { AssetTraits } from './trait'
import { AssetLocation } from './location'

// ─────────────────────────────────────────────────────────────────────────────
// Asset Status
// ─────────────────────────────────────────────────────────────────────────────

export const AssetStatus = Schema.Literal(
  'available',
  'reserved',
  'in_transit',
  'maintenance',
  'retired'
).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Asset/fields/AssetStatus'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/AssetStatus',
    description: 'Current operational status of an asset',
  })
)
export type AssetStatus = typeof AssetStatus.Type

// ─────────────────────────────────────────────────────────────────────────────
// Base Properties (common to all assets)
// ─────────────────────────────────────────────────────────────────────────────

export class BaseAssetProperties extends Schema.TaggedClass<BaseAssetProperties>()('BaseAssetProperties', {
  quantity: Schema.Number.pipe(Schema.int(), Schema.positive()),
  weightKg: Schema.optional(Schema.Number.pipe(Schema.positive())),
  dimensionsMm: Schema.optional(
    Schema.Struct({
      l: Schema.Number.pipe(Schema.positive()),
      w: Schema.Number.pipe(Schema.positive()),
      h: Schema.Number.pipe(Schema.positive()),
    })
  ),
}) {
  /**
   * Calculate volume in cubic millimeters (if dimensions available)
   */
  volumeMm3(): number | undefined {
    if (!this.dimensionsMm) return undefined
    return this.dimensionsMm.l * this.dimensionsMm.w * this.dimensionsMm.h
  }
}
export type BaseAssetPropertiesType = typeof BaseAssetProperties.Type

// ─────────────────────────────────────────────────────────────────────────────
// Asset Entity
// ─────────────────────────────────────────────────────────────────────────────

export class Asset extends Schema.TaggedClass<Asset>()('Asset', {
  id: AssetId,
  bfoClass: BfoMaterialEntity,
  kind: AssetKind,
  label: AssetLabel,
  description: Schema.optional(AssetDescription),
  status: AssetStatus,
  location: AssetLocation,
  baseProperties: BaseAssetProperties,
  properties: AssetProperties,
  traits: AssetTraits,
  tags: Tags,
  policyIds: Schema.optional(PolicyIds),
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {
  /**
   * Check if asset is operational (not in maintenance or retired)
   */
  isOperational(): boolean {
    return this.status !== 'maintenance' && this.status !== 'retired'
  }

  /**
   * Check if asset is available for reservation
   */
  isAvailable(): boolean {
    return this.status === 'available'
  }

  /**
   * Get site ID from location
   */
  get siteId(): SiteId {
    return this.location.siteId
  }

  /**
   * Get sector ID from location (optional)
   */
  get sectorId(): SectorId | undefined {
    return this.location.sectorId
  }

  /**
   * Get container ID from location (optional)
   */
  get containerId(): ContainerId | undefined {
    return this.location.containerId
  }
}
export type AssetType = typeof Asset.Type

// ─────────────────────────────────────────────────────────────────────────────
// Asset Summary (lightweight projection for lists)
// ─────────────────────────────────────────────────────────────────────────────

export class AssetSummary extends Schema.TaggedClass<AssetSummary>()('AssetSummary', {
  id: AssetId,
  kind: AssetKind,
  label: AssetLabel,
  status: AssetStatus,
  siteId: SiteId,
  sectorId: Schema.optional(SectorId),
}) {}
export type AssetSummaryType = typeof AssetSummary.Type
