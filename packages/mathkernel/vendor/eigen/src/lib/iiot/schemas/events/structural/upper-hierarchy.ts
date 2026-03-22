/**
 * Upper Hierarchy Entity Lifecycle Events
 *
 * Structural events for Enterprise, Site, and Area entities.
 * These are the top levels of the ISA-95 equipment hierarchy.
 *
 * | Entity     | ISA-95 Level | Automation Level |
 * |------------|--------------|------------------|
 * | Enterprise | L4           | Business Planning|
 * | Site       | L3           | Manufacturing Ops|
 * | Area       | L2           | Supervisory Ctrl |
 *
 * @module @gbg/tmnl/iiot/schemas/events/structural/upper-hierarchy
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 * @see thoughts/shared/specs/entity-system/00-unified-entity-system-spec.md
 */

import { Schema } from 'effect'
import { BaseStructuralEvent } from '../base'
import { EnterpriseId, SiteId, AreaId } from '../../identifiers'
// Import AreaType from existing asset schema (avoid duplication)
import { AreaType as AreaTypeFromAsset } from '../../assets/area/schema'

// Re-export the asset type under original name
export const AreaType = AreaTypeFromAsset
export type AreaType = typeof AreaTypeFromAsset.Type

// =============================================================================
// Enterprise Events (L4 - Business Planning)
// =============================================================================

/**
 * Event: A new enterprise (multi-site corporation) was registered.
 *
 * Enterprise is the root of the ISA-95 hierarchy. All other entities
 * ultimately belong to an enterprise.
 *
 * @example
 * ```typescript
 * const event = new EnterpriseCreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'ADMIN-001',
 *   entityId: 'ENT-acme' as AssetId,
 *   entityType: 'enterprise',
 *   hierarchyPath: ['ENT-acme' as AssetId],
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   enterpriseId: 'ENT-acme' as EnterpriseId,
 *   name: 'Acme Corporation',
 *   industry: Option.some('Manufacturing'),
 *   legalName: Option.some('Acme Corp Inc.'),
 * })
 * ```
 */
export class EnterpriseCreated extends BaseStructuralEvent.extend<EnterpriseCreated>(
  'EnterpriseCreated'
)({
  /** Enterprise identifier */
  enterpriseId: EnterpriseId,

  /** Display name of the enterprise */
  name: Schema.NonEmptyString,

  /** Industry sector (e.g., 'Manufacturing', 'Automotive') */
  industry: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Legal entity name */
  legalName: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Tax identification number */
  taxId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Headquarters location/address */
  headquarters: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Enterprise ${this.name} (${this.enterpriseId}) created`
  }
}
export type EnterpriseCreatedType = typeof EnterpriseCreated.Type

/**
 * Event: Enterprise metadata was updated.
 *
 * Captures changes to enterprise name, industry, legal details, etc.
 */
export class EnterpriseUpdated extends BaseStructuralEvent.extend<EnterpriseUpdated>(
  'EnterpriseUpdated'
)({
  /** Enterprise identifier */
  enterpriseId: EnterpriseId,

  /** Updated display name (if changed) */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated industry (if changed) */
  industry: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated legal name (if changed) */
  legalName: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated tax ID (if changed) */
  taxId: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated headquarters (if changed) */
  headquarters: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Reason for the update */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Enterprise ${this.enterpriseId} updated`
  }
}
export type EnterpriseUpdatedType = typeof EnterpriseUpdated.Type

/**
 * Event: Enterprise was decommissioned (soft delete).
 *
 * Enterprise and all child entities are marked as decommissioned.
 * This is a soft delete - data is retained for audit compliance.
 */
export class EnterpriseDecommissioned extends BaseStructuralEvent.extend<EnterpriseDecommissioned>(
  'EnterpriseDecommissioned'
)({
  /** Enterprise identifier */
  enterpriseId: EnterpriseId,

  /** Reason for decommissioning */
  reason: Schema.NonEmptyString,

  /** Effective date of decommissioning */
  effectiveDate: Schema.DateTimeUtc,

  /** Notes about the decommissioning */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Enterprise ${this.enterpriseId} decommissioned: ${this.reason}`
  }
}
export type EnterpriseDecommissionedType = typeof EnterpriseDecommissioned.Type

// =============================================================================
// Site Events (L3 - Manufacturing Operations)
// =============================================================================

/**
 * Event: A new site (physical location) was registered.
 *
 * Site represents a geographic location within an enterprise.
 * Contains Areas and/or Plants.
 *
 * @example
 * ```typescript
 * const event = new SiteCreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'ADMIN-001',
 *   entityId: 'SIT-chicago' as AssetId,
 *   entityType: 'site',
 *   hierarchyPath: ['ENT-acme', 'SIT-chicago'] as AssetId[],
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   siteId: 'SIT-chicago' as SiteId,
 *   enterpriseId: 'ENT-acme' as EnterpriseId,
 *   name: 'Chicago Plant',
 *   timezone: 'America/Chicago',
 *   address: Option.some('123 Industrial Way'),
 * })
 * ```
 */
export class SiteCreated extends BaseStructuralEvent.extend<SiteCreated>(
  'SiteCreated'
)({
  /** Site identifier */
  siteId: SiteId,

  /** Parent enterprise */
  enterpriseId: EnterpriseId,

  /** Display name of the site */
  name: Schema.NonEmptyString,

  /** IANA timezone ID (e.g., 'America/Chicago') */
  timezone: Schema.String,

  /** Street address */
  address: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** City name */
  city: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** State/province */
  state: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Country */
  country: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Postal/ZIP code */
  postalCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** GPS latitude */
  latitude: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** GPS longitude */
  longitude: Schema.optionalWith(Schema.Number, { as: 'Option' }),
}) {
  describe(): string {
    return `Site ${this.name} (${this.siteId}) created under enterprise ${this.enterpriseId}`
  }
}
export type SiteCreatedType = typeof SiteCreated.Type

/**
 * Event: Site metadata was updated.
 */
export class SiteUpdated extends BaseStructuralEvent.extend<SiteUpdated>(
  'SiteUpdated'
)({
  /** Site identifier */
  siteId: SiteId,

  /** Parent enterprise */
  enterpriseId: EnterpriseId,

  /** Updated name (if changed) */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated timezone (if changed) */
  timezone: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated address (if changed) */
  address: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated city (if changed) */
  city: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated state (if changed) */
  state: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated country (if changed) */
  country: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated postal code (if changed) */
  postalCode: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated latitude (if changed) */
  latitude: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Updated longitude (if changed) */
  longitude: Schema.optionalWith(Schema.Number, { as: 'Option' }),

  /** Reason for the update */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Site ${this.siteId} updated`
  }
}
export type SiteUpdatedType = typeof SiteUpdated.Type

/**
 * Event: Site was decommissioned.
 *
 * All child Areas and Plants are cascaded as decommissioned.
 */
export class SiteDecommissioned extends BaseStructuralEvent.extend<SiteDecommissioned>(
  'SiteDecommissioned'
)({
  /** Site identifier */
  siteId: SiteId,

  /** Parent enterprise */
  enterpriseId: EnterpriseId,

  /** Reason for decommissioning */
  reason: Schema.NonEmptyString,

  /** Effective date of decommissioning */
  effectiveDate: Schema.DateTimeUtc,

  /** Notes about the decommissioning */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Site ${this.siteId} decommissioned: ${this.reason}`
  }
}
export type SiteDecommissionedType = typeof SiteDecommissioned.Type

// =============================================================================
// Area Events (L2 - Supervisory Control)
// =============================================================================

/**
 * Event: A new area was registered within a site.
 *
 * Area represents a sub-zone within a site, typically at the
 * SCADA/HMI level of the automation pyramid.
 *
 * @example
 * ```typescript
 * const event = new AreaCreated({
 *   eventId: makeEventId(),
 *   occurredAt: DateTime.unsafeNow(),
 *   causedBy: 'ADMIN-001',
 *   entityId: 'ARA-assembly' as AssetId,
 *   entityType: 'area',
 *   hierarchyPath: ['ENT-acme', 'SIT-chicago', 'ARA-assembly'] as AssetId[],
 *   correlationId: Option.none(),
 *   schemaVersion: 1,
 *   areaId: 'ARA-assembly' as AreaId,
 *   siteId: 'SIT-chicago' as SiteId,
 *   name: 'Assembly Area',
 *   areaType: Option.some('production'),
 * })
 * ```
 */
export class AreaCreated extends BaseStructuralEvent.extend<AreaCreated>(
  'AreaCreated'
)({
  /** Area identifier */
  areaId: AreaId,

  /** Parent site */
  siteId: SiteId,

  /** Display name of the area */
  name: Schema.NonEmptyString,

  /** Area classification */
  areaType: Schema.optionalWith(AreaType, { as: 'Option' }),

  /** Building name/identifier */
  building: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Floor/level within building */
  floor: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Zone designation */
  zone: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Description of the area */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Area ${this.name} (${this.areaId}) created under site ${this.siteId}`
  }
}
export type AreaCreatedType = typeof AreaCreated.Type

/**
 * Event: Area metadata was updated.
 */
export class AreaUpdated extends BaseStructuralEvent.extend<AreaUpdated>(
  'AreaUpdated'
)({
  /** Area identifier */
  areaId: AreaId,

  /** Parent site */
  siteId: SiteId,

  /** Updated name (if changed) */
  name: Schema.optionalWith(Schema.NonEmptyString, { as: 'Option' }),

  /** Updated area type (if changed) */
  areaType: Schema.optionalWith(AreaType, { as: 'Option' }),

  /** Updated building (if changed) */
  building: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated floor (if changed) */
  floor: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated zone (if changed) */
  zone: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Updated description (if changed) */
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Reason for the update */
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Area ${this.areaId} updated`
  }
}
export type AreaUpdatedType = typeof AreaUpdated.Type

/**
 * Event: Area was decommissioned.
 *
 * All child Plants and Lines are cascaded as decommissioned.
 */
export class AreaDecommissioned extends BaseStructuralEvent.extend<AreaDecommissioned>(
  'AreaDecommissioned'
)({
  /** Area identifier */
  areaId: AreaId,

  /** Parent site */
  siteId: SiteId,

  /** Reason for decommissioning */
  reason: Schema.NonEmptyString,

  /** Effective date of decommissioning */
  effectiveDate: Schema.DateTimeUtc,

  /** Notes about the decommissioning */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  describe(): string {
    return `Area ${this.areaId} decommissioned: ${this.reason}`
  }
}
export type AreaDecommissionedType = typeof AreaDecommissioned.Type

// =============================================================================
// Event Union for Upper Hierarchy
// =============================================================================

/**
 * Union of all upper hierarchy structural events.
 */
export const UpperHierarchyEvent = Schema.Union(
  EnterpriseCreated,
  EnterpriseUpdated,
  EnterpriseDecommissioned,
  SiteCreated,
  SiteUpdated,
  SiteDecommissioned,
  AreaCreated,
  AreaUpdated,
  AreaDecommissioned
)
export type UpperHierarchyEvent = Schema.Schema.Type<typeof UpperHierarchyEvent>

