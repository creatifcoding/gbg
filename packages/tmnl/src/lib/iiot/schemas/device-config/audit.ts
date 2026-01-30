/**
 * DeviceConfig Audit Event Schemas
 *
 * Audit trail events for configuration changes.
 * Supports FDA 21 CFR Part 11 electronic records compliance.
 *
 * @module @gbg/tmnl/iiot/schemas/device-config/audit
 * @see FDA 21 CFR Part 11 for electronic records requirements
 */

import { Schema } from 'effect'
import { DeviceConfigId, ConfigVersion } from './schema'

// =============================================================================
// ConfigCreated Event
// =============================================================================

/**
 * Event emitted when a new configuration is created.
 */
export class ConfigCreated extends Schema.TaggedClass<ConfigCreated>()('ConfigCreated', {
  /** ID of the created configuration */
  configId: DeviceConfigId,

  /** Target device type */
  targetType: Schema.Literal('sensor', 'device'),

  /** Target device identifier */
  targetId: Schema.String,

  /** Initial version number (always 1 for new configs) */
  version: ConfigVersion,

  /** Configuration data */
  config: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  }),

  /** User who created the configuration */
  createdBy: Schema.String,

  /** Creation timestamp */
  createdAt: Schema.DateTimeUtc,
}) {}
export type ConfigCreatedType = typeof ConfigCreated.Type

// =============================================================================
// ConfigUpdated Event
// =============================================================================

/**
 * Event emitted when a configuration is modified (creates new version).
 */
export class ConfigUpdated extends Schema.TaggedClass<ConfigUpdated>()('ConfigUpdated', {
  /** ID of the new configuration version */
  configId: DeviceConfigId,

  /** ID of the previous version */
  previousVersionId: DeviceConfigId,

  /** New version number */
  version: ConfigVersion,

  /** Updated configuration data */
  config: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  }),

  /** Reason for the change */
  changeReason: Schema.String,

  /** User who made the update */
  updatedBy: Schema.String,

  /** Update timestamp */
  updatedAt: Schema.DateTimeUtc,
}) {}
export type ConfigUpdatedType = typeof ConfigUpdated.Type

// =============================================================================
// ConfigActivated Event
// =============================================================================

/**
 * Event emitted when a configuration is set as active.
 */
export class ConfigActivated extends Schema.TaggedClass<ConfigActivated>()('ConfigActivated', {
  /** ID of the activated configuration */
  configId: DeviceConfigId,

  /** ID of the previously active configuration (if any) */
  previousActiveId: Schema.optionalWith(DeviceConfigId, { as: 'Option' }),

  /** User who activated the configuration */
  activatedBy: Schema.String,

  /** Activation timestamp */
  activatedAt: Schema.DateTimeUtc,
}) {}
export type ConfigActivatedType = typeof ConfigActivated.Type

// =============================================================================
// ConfigArchived Event
// =============================================================================

/**
 * Event emitted when a configuration is archived.
 * Typically occurs when a new version is activated.
 */
export class ConfigArchived extends Schema.TaggedClass<ConfigArchived>()('ConfigArchived', {
  /** ID of the archived configuration */
  configId: DeviceConfigId,

  /** User/system that archived the configuration */
  archivedBy: Schema.String,

  /** Archive timestamp */
  archivedAt: Schema.DateTimeUtc,

  /** Reason for archiving */
  reason: Schema.String,
}) {}
export type ConfigArchivedType = typeof ConfigArchived.Type

// =============================================================================
// ConfigApproved Event
// =============================================================================

/**
 * Event emitted when a configuration is approved.
 * Required for FDA 21 CFR Part 11 compliance.
 */
export class ConfigApproved extends Schema.TaggedClass<ConfigApproved>()('ConfigApproved', {
  /** ID of the approved configuration */
  configId: DeviceConfigId,

  /** User who approved the configuration */
  approvedBy: Schema.String,

  /** Approval timestamp */
  approvedAt: Schema.DateTimeUtc,

  /** Optional approval notes */
  notes: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {}
export type ConfigApprovedType = typeof ConfigApproved.Type

// =============================================================================
// ConfigRejected Event
// =============================================================================

/**
 * Event emitted when a configuration is rejected.
 */
export class ConfigRejected extends Schema.TaggedClass<ConfigRejected>()('ConfigRejected', {
  /** ID of the rejected configuration */
  configId: DeviceConfigId,

  /** User who rejected the configuration */
  rejectedBy: Schema.String,

  /** Rejection timestamp */
  rejectedAt: Schema.DateTimeUtc,

  /** Reason for rejection */
  reason: Schema.String,
}) {}
export type ConfigRejectedType = typeof ConfigRejected.Type

// =============================================================================
// Union of All Audit Events
// =============================================================================

/**
 * Union of all configuration audit events.
 * Useful for event sourcing and audit log processing.
 */
export const ConfigAuditEvent = Schema.Union(
  ConfigCreated,
  ConfigUpdated,
  ConfigActivated,
  ConfigArchived,
  ConfigApproved,
  ConfigRejected
)
export type ConfigAuditEvent = Schema.Schema.Type<typeof ConfigAuditEvent>
