/**
 * Site Entity Schema
 *
 * ISA-95 Level 3 (MES/MOM scope - geographic).
 * Site is a physical location containing one or more plants.
 * Distinct from Plant (which is a functional unit within a Site).
 *
 * @module @gbg/tmnl/iiot/schemas/assets/site
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

import { Schema } from 'effect'
import { AssetStatus, AssetLocation, AssetMetadata, BaseAssetFields } from '../common'
import { EnterpriseId } from '../enterprise/schema'
import { HierarchyPath } from '../../hierarchy'

// =============================================================================
// Site Identifier
// =============================================================================

/**
 * Site identifier with embedded slug.
 * Format: 'SIT-{slug}' where slug is alphanumeric with hyphens.
 *
 * @example
 * ```ts
 * const id = makeSiteId('chicago-facility') // 'SIT-chicago-facility'
 * ```
 */
export const SiteId = Schema.String.pipe(
  Schema.pattern(/^SIT-[a-zA-Z0-9-]+$/),
  Schema.brand('SiteId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/SiteId',
    description: 'Site identifier with SIT- prefix and slug',
  })
)
export type SiteId = typeof SiteId.Type

/**
 * Factory function to create a SiteId from a slug.
 *
 * @param slug - Alphanumeric slug with hyphens (e.g., 'chicago-facility')
 * @returns SiteId branded string (e.g., 'SIT-chicago-facility')
 */
export const makeSiteId = (slug: string): SiteId => `SIT-${slug}` as SiteId

// =============================================================================
// Site Entity
// =============================================================================

/**
 * Site Entity Schema - ISA-95 Level 3 (MES/MOM scope - geographic)
 *
 * Represents a physical location in the equipment hierarchy.
 * Sites are geographic containers that hold one or more plants/areas.
 *
 * @example
 * ```ts
 * import { DateTime, Option } from 'effect'
 *
 * const site = new Site({
 *   id: makeSiteId('chicago-main'),
 *   name: 'Chicago Main Site',
 *   status: 'active',
 *   enterpriseId: 'ENT-acme-corp' as EnterpriseId,
 *   timezone: 'America/Chicago',
 *   address: Option.some('123 Industrial Pkwy'),
 *   city: Option.some('Chicago'),
 *   state: Option.some('IL'),
 *   country: Option.some('USA'),
 *   postalCode: Option.some('60601'),
 *   hierarchyPath: HierarchyPath.fromSegments([...]),
 *   createdAt: DateTime.unsafeNow(),
 * })
 *
 * site.getAutomationLevel() // 3
 * site.isOperational() // true
 * site.isContainer() // true
 * site.materializePath() // '/ENT-acme-corp/SIT-chicago-main'
 * ```
 */
export class Site extends Schema.TaggedClass<Site>()('Site', {
  /** Unique site identifier (SIT-{slug} format) */
  id: SiteId,

  /** Spread base asset fields (name, status, description, location, metadata, timestamps, hierarchyPath, parent IDs) */
  ...BaseAssetFields,

  /** Override enterpriseId to be required (sites must belong to an enterprise) */
  enterpriseId: EnterpriseId,

  /** Street address */
  address: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** City name */
  city: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** State/province/region */
  state: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Country name or ISO code */
  country: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Postal/ZIP code */
  postalCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** IANA timezone identifier (e.g., 'America/Chicago') - required */
  timezone: Schema.String.pipe(
    Schema.annotations({
      description: 'IANA timezone identifier for the site location',
    })
  ),
}) {
  /**
   * Get ISA-95 automation level.
   * Sites are Level 3 (MES/MOM - geographic scope).
   */
  getAutomationLevel(): 3 {
    return 3
  }

  /**
   * Check if site is operational.
   * A site is operational if it's active or inactive (not in maintenance or decommissioned).
   */
  isOperational(): boolean {
    return this.status === 'active' || this.status === 'inactive'
  }

  /**
   * Check if this asset is a container.
   * Sites always contain plants/areas, so this returns true.
   */
  isContainer(): true {
    return true
  }

  /**
   * Get the materialized hierarchy path as a string.
   * Convenience method for path display and URL generation.
   */
  materializePath(): string {
    return this.hierarchyPath.toString()
  }
}

/** Site entity type alias */
export type SiteEntity = typeof Site.Type

// =============================================================================
// Create Site Parameters
// =============================================================================

/**
 * Parameters for creating a new Site.
 * Used in command handlers and service methods.
 */
export const CreateSiteParams = Schema.Struct({
  /** Slug for the site ID (will be prefixed with 'SIT-') */
  slug: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z0-9-]+$/),
    Schema.annotations({
      description: 'Alphanumeric slug for site ID (e.g., "chicago-main")',
    })
  ),

  /** Human-readable site name */
  name: Schema.NonEmptyString,

  /** Parent enterprise identifier */
  enterpriseId: EnterpriseId,

  /** IANA timezone identifier */
  timezone: Schema.String,

  /** Initial status (defaults to 'active' in handler) */
  status: Schema.optionalWith(AssetStatus, { as: 'Option' }),

  /** Street address */
  address: Schema.optional(Schema.String),

  /** City name */
  city: Schema.optional(Schema.String),

  /** State/province/region */
  state: Schema.optional(Schema.String),

  /** Country name or ISO code */
  country: Schema.optional(Schema.String),

  /** Postal/ZIP code */
  postalCode: Schema.optional(Schema.String),

  /** GPS coordinates and physical location details */
  location: Schema.optionalWith(AssetLocation, { as: 'Option' }),

  /** Optional description */
  description: Schema.optional(Schema.String),

  /** Initial metadata */
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
})
export type CreateSiteParams = Schema.Schema.Type<typeof CreateSiteParams>

// =============================================================================
// Update Site Parameters
// =============================================================================

/**
 * Parameters for updating an existing Site.
 */
export const UpdateSiteParams = Schema.Struct({
  /** Site ID to update */
  id: SiteId,

  /** Updated name */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated status */
  status: Schema.optionalWith(AssetStatus, { as: 'Option' }),

  /** Updated timezone */
  timezone: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated street address */
  address: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated city */
  city: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated state/province/region */
  state: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated country */
  country: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated postal/ZIP code */
  postalCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated GPS coordinates and physical location details */
  location: Schema.optionalWith(AssetLocation, { as: 'Option' }),

  /** Updated description */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated metadata (merged with existing) */
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
})
export type UpdateSiteParams = Schema.Schema.Type<typeof UpdateSiteParams>
