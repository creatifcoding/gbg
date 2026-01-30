/**
 * Enterprise Entity Schema
 *
 * ISA-95 Level 4 (Business Planning) - Enterprise/Corporation level.
 * The topmost level of the equipment hierarchy representing the entire
 * corporation or organization.
 *
 * @module @gbg/tmnl/iiot/schemas/assets/enterprise
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

import { Schema } from 'effect'
import { AssetStatus, AssetMetadata, BaseAssetFields } from '../common'
import { HierarchyPath } from '../../hierarchy'

// =============================================================================
// Enterprise Identifier
// =============================================================================

/**
 * Enterprise identifier with embedded slug.
 * Format: 'ENT-{slug}' where slug is alphanumeric with hyphens.
 *
 * @example
 * ```ts
 * const id = makeEnterpriseId('acme-corp') // 'ENT-acme-corp'
 * ```
 */
export const EnterpriseId = Schema.String.pipe(
  Schema.pattern(/^ENT-[a-zA-Z0-9-]+$/),
  Schema.brand('EnterpriseId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/EnterpriseId',
    description: 'Enterprise identifier with ENT- prefix and slug',
  })
)
export type EnterpriseId = typeof EnterpriseId.Type

/**
 * Factory function to create an EnterpriseId from a slug.
 *
 * @param slug - Alphanumeric slug with hyphens (e.g., 'acme-corp')
 * @returns EnterpriseId branded string (e.g., 'ENT-acme-corp')
 */
export const makeEnterpriseId = (slug: string): EnterpriseId => `ENT-${slug}` as EnterpriseId

// =============================================================================
// Enterprise Entity
// =============================================================================

/**
 * Enterprise Entity Schema - ISA-95 Level 4 (Business Planning)
 *
 * Represents the topmost level of the ISA-95 equipment hierarchy.
 * An enterprise is the entire corporation or organization that contains sites.
 *
 * @example
 * ```ts
 * const enterprise = new EnterpriseSchema({
 *   id: makeEnterpriseId('acme-corp'),
 *   name: 'ACME Corporation',
 *   status: 'active',
 *   industry: Option.some('manufacturing'),
 *   hierarchyPath: HierarchyPath.root('ENT-acme-corp', 'ACME Corporation'),
 *   createdAt: DateTime.unsafeNow(),
 * })
 *
 * enterprise.getAutomationLevel() // 4
 * enterprise.isOperational() // true
 * enterprise.isContainer() // true
 * enterprise.materializePath() // '/ENT-acme-corp'
 * ```
 */
export class EnterpriseSchema extends Schema.TaggedClass<EnterpriseSchema>()('Enterprise', {
  /** Unique enterprise identifier (ENT-{slug} format) */
  id: EnterpriseId,

  // Spread base asset fields (name, status, description, location, metadata, timestamps, hierarchyPath, parent IDs)
  ...BaseAssetFields,

  /** Industry sector (e.g., 'manufacturing', 'pharma', 'automotive') */
  industry: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Legal entity name (for regulatory/compliance purposes) */
  legalName: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Tax identification number */
  taxId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Headquarters location/address */
  headquarters: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  /**
   * Get ISA-95 automation level.
   * Enterprise is Level 4 (Business Planning/ERP).
   */
  getAutomationLevel(): 4 {
    return 4
  }

  /**
   * Check if enterprise is operational.
   * An enterprise is operational if it's active or inactive (not in maintenance or decommissioned).
   */
  isOperational(): boolean {
    return this.status === 'active' || this.status === 'inactive'
  }

  /**
   * Check if this asset is a container.
   * Enterprises always contain sites, so this returns true.
   */
  isContainer(): true {
    return true
  }

  /**
   * Materialize the hierarchy path to a string.
   * For Enterprise (root entity), this returns the path containing only itself.
   * @returns Materialized path string (e.g., '/ENT-acme-corp')
   */
  materializePath(): string {
    return this.hierarchyPath.toString()
  }
}

// =============================================================================
// Enterprise Namespace
// =============================================================================

/**
 * Enterprise namespace for type-safe access to schema and type.
 */
export namespace Enterprise {
  export const Schema = EnterpriseSchema
  export type Type = typeof EnterpriseSchema.Type
}

// =============================================================================
// Create Enterprise Parameters
// =============================================================================

/**
 * Parameters for creating a new Enterprise.
 * Used in command handlers and service methods.
 */
export const CreateEnterpriseParams = Schema.Struct({
  /** Slug for the enterprise ID (will be prefixed with 'ENT-') */
  slug: Schema.String.pipe(
    Schema.pattern(/^[a-zA-Z0-9-]+$/),
    Schema.annotations({
      description: 'Alphanumeric slug for enterprise ID (e.g., "acme-corp")',
    })
  ),

  /** Human-readable enterprise name */
  name: Schema.NonEmptyString,

  /** Initial status (defaults to 'active' in handler) */
  status: Schema.optionalWith(AssetStatus, { as: 'Option' }),

  /** Industry sector */
  industry: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Legal entity name */
  legalName: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Tax identification number */
  taxId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Headquarters location/address */
  headquarters: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Optional description */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Initial metadata */
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
})
export type CreateEnterpriseParams = Schema.Schema.Type<typeof CreateEnterpriseParams>

// =============================================================================
// Update Enterprise Parameters
// =============================================================================

/**
 * Parameters for updating an existing Enterprise.
 */
export const UpdateEnterpriseParams = Schema.Struct({
  /** Enterprise ID to update */
  id: EnterpriseId,

  /** Updated name */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated status */
  status: Schema.optionalWith(AssetStatus, { as: 'Option' }),

  /** Updated industry */
  industry: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated legal name */
  legalName: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated tax ID */
  taxId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated headquarters */
  headquarters: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated description */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated metadata (merged with existing) */
  metadata: Schema.optionalWith(AssetMetadata, { as: 'Option' }),
})
export type UpdateEnterpriseParams = Schema.Schema.Type<typeof UpdateEnterpriseParams>
