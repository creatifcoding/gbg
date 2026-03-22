/**
 * DeviceConfig Entity Schema
 *
 * Device configuration management with versioning and audit trail.
 * Stores configuration settings for sensors and devices with version history.
 *
 * @module @gbg/tmnl/iiot/schemas/device-config
 * @see FDA 21 CFR Part 11 for electronic records compliance
 * @see ISA-95/IEC 62264 for equipment hierarchy standards
 */

import { Schema } from 'effect'

// =============================================================================
// DeviceConfigId with Embedded Slug
// =============================================================================

/**
 * Device configuration identifier with embedded slug pattern.
 * Format: 'CFG-{slug}' where slug is alphanumeric with hyphens.
 *
 * @example
 * ```ts
 * const id = makeDeviceConfigId('temp-sensor-01-v1') // 'CFG-temp-sensor-01-v1'
 * ```
 */
export const DeviceConfigId = Schema.String.pipe(
  Schema.pattern(/^CFG-[a-zA-Z0-9-]+$/),
  Schema.brand('DeviceConfigId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/DeviceConfigId',
    description: 'Device configuration identifier with CFG- prefix and alphanumeric slug',
  })
)
export type DeviceConfigId = Schema.Schema.Type<typeof DeviceConfigId>

/**
 * Factory function to create a DeviceConfigId from a slug.
 *
 * @param slug - Alphanumeric identifier (hyphens allowed)
 * @returns Branded DeviceConfigId
 *
 * @example
 * ```ts
 * const id = makeDeviceConfigId('temp-sensor-01-v1') // 'CFG-temp-sensor-01-v1'
 * ```
 */
export const makeDeviceConfigId = (slug: string): DeviceConfigId => `CFG-${slug}` as DeviceConfigId

// =============================================================================
// ConfigVersion
// =============================================================================

/**
 * Configuration version number.
 * Must be a positive integer (starts at 1).
 */
export const ConfigVersion = Schema.Number.pipe(
  Schema.int(),
  Schema.positive(),
  Schema.brand('ConfigVersion'),
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/ConfigVersion',
    description: 'Configuration version number (positive integer)',
  })
)
export type ConfigVersion = Schema.Schema.Type<typeof ConfigVersion>

// =============================================================================
// ConfigStatus
// =============================================================================

/**
 * Configuration lifecycle status.
 *
 * - `draft`: Being edited, not active
 * - `active`: Currently in use
 * - `archived`: Previous version, kept for audit
 * - `rejected`: Reviewed and rejected
 */
export const ConfigStatus = Schema.Literal(
  'draft',
  'active',
  'archived',
  'rejected'
).pipe(
  Schema.annotations({
    identifier: '@gbg/tmnl/iiot/ConfigStatus',
    description: 'Configuration lifecycle status',
  })
)
export type ConfigStatus = Schema.Schema.Type<typeof ConfigStatus>

// =============================================================================
// Thresholds Schema
// =============================================================================

/**
 * Threshold configuration for sensor alarms.
 */
export const ThresholdsConfig = Schema.Struct({
  low: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  high: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  criticalLow: Schema.optionalWith(Schema.Number, { as: 'Option' }),
  criticalHigh: Schema.optionalWith(Schema.Number, { as: 'Option' }),
})
export type ThresholdsConfig = Schema.Schema.Type<typeof ThresholdsConfig>

// =============================================================================
// DeviceConfig Entity
// =============================================================================

/**
 * DeviceConfig Entity - Configuration with versioning and audit trail.
 *
 * Represents configuration settings for sensors and devices with full
 * version history for FDA 21 CFR Part 11 compliance.
 *
 * @example
 * ```ts
 * import { DateTime, Option } from 'effect'
 *
 * const config = new DeviceConfig({
 *   id: makeDeviceConfigId('temp-sensor-01-v1'),
 *   targetType: 'sensor',
 *   targetId: 'SNS-temp-01',
 *   version: 1 as ConfigVersion,
 *   status: 'active',
 *   config: { sampleRate: 1000, precision: 2 },
 *   sampleRateMs: Option.some(1000),
 *   thresholds: Option.some({
 *     low: Option.some(10),
 *     high: Option.some(85),
 *     criticalLow: Option.some(5),
 *     criticalHigh: Option.some(95),
 *   }),
 *   createdBy: 'operator-001',
 *   createdAt: DateTime.unsafeNow(),
 *   updatedBy: Option.none(),
 *   updatedAt: Option.none(),
 *   approvedBy: Option.some('supervisor-001'),
 *   approvedAt: Option.some(DateTime.unsafeNow()),
 *   changeReason: Option.some('Initial configuration'),
 *   previousVersionId: Option.none(),
 * })
 * ```
 */
export class DeviceConfig extends Schema.TaggedClass<DeviceConfig>()('DeviceConfig', {
  /** Unique configuration identifier (CFG-{slug} format) */
  id: DeviceConfigId,

  /** Target device type (sensor or device/actuator) */
  targetType: Schema.Literal('sensor', 'device'),

  /** Target device identifier (SensorId or DeviceId) */
  targetId: Schema.String,

  /** Version number (positive integer, starts at 1) */
  version: ConfigVersion,

  /** Configuration lifecycle status */
  status: ConfigStatus,

  /** Configuration data (flexible JSON) */
  config: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  }),

  /** Sample rate in milliseconds (common config field) */
  sampleRateMs: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { as: 'Option' }
  ),

  /** Threshold configuration (common config field) */
  thresholds: Schema.optionalWith(ThresholdsConfig, { as: 'Option' }),

  /** User/system that created this version */
  createdBy: Schema.String,

  /** Creation timestamp */
  createdAt: Schema.DateTimeUtc,

  /** User who last updated (if modified) */
  updatedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Last update timestamp */
  updatedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** User who approved (for FDA compliance) */
  approvedBy: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Approval timestamp */
  approvedAt: Schema.optionalWith(Schema.DateTimeUtc, { as: 'Option' }),

  /** Reason for configuration change */
  changeReason: Schema.optionalWith(Schema.String, { as: 'Option' }),

  /** Previous version ID for version chain */
  previousVersionId: Schema.optionalWith(DeviceConfigId, { as: 'Option' }),
}) {
  /**
   * Check if config is the active version.
   */
  isActive(): boolean {
    return this.status === 'active'
  }

  /**
   * Check if config requires approval.
   * Only draft configurations require approval.
   */
  requiresApproval(): boolean {
    return this.status === 'draft'
  }
}
export type DeviceConfigType = typeof DeviceConfig.Type

// =============================================================================
// Command Parameter Schemas
// =============================================================================

/**
 * Parameters for creating a new configuration.
 */
export const CreateConfigParams = Schema.Struct({
  /** Target device type */
  targetType: Schema.Literal('sensor', 'device'),

  /** Target device identifier */
  targetId: Schema.String,

  /** Configuration data */
  config: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  }),

  /** User creating the configuration */
  createdBy: Schema.NonEmptyString,

  /** Optional sample rate in milliseconds */
  sampleRateMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),

  /** Optional threshold configuration */
  thresholds: Schema.optional(ThresholdsConfig),

  /** Optional change reason */
  changeReason: Schema.optional(Schema.String),
})
export type CreateConfigParams = Schema.Schema.Type<typeof CreateConfigParams>

/**
 * Parameters for updating an existing configuration.
 * Creates a new version rather than modifying in place.
 */
export const UpdateConfigParams = Schema.Struct({
  /** Configuration ID to update */
  id: DeviceConfigId,

  /** New configuration data */
  config: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  }),

  /** Reason for the change (required for audit) */
  changeReason: Schema.NonEmptyString,

  /** User making the update */
  updatedBy: Schema.NonEmptyString,

  /** Optional updated sample rate */
  sampleRateMs: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),

  /** Optional updated thresholds */
  thresholds: Schema.optional(ThresholdsConfig),
})
export type UpdateConfigParams = Schema.Schema.Type<typeof UpdateConfigParams>

/**
 * Parameters for activating a configuration.
 * Sets this version as the active configuration for the target device.
 */
export const ActivateConfigParams = Schema.Struct({
  /** Configuration ID to activate */
  id: DeviceConfigId,

  /** User activating the configuration */
  activatedBy: Schema.NonEmptyString,
})
export type ActivateConfigParams = Schema.Schema.Type<typeof ActivateConfigParams>

/**
 * Parameters for approving a configuration.
 * Required for FDA 21 CFR Part 11 compliance.
 */
export const ApproveConfigParams = Schema.Struct({
  /** Configuration ID to approve */
  id: DeviceConfigId,

  /** User approving the configuration */
  approvedBy: Schema.NonEmptyString,

  /** Optional approval notes */
  notes: Schema.optional(Schema.String),
})
export type ApproveConfigParams = Schema.Schema.Type<typeof ApproveConfigParams>

/**
 * Parameters for rejecting a configuration.
 * Requires a reason for audit trail.
 */
export const RejectConfigParams = Schema.Struct({
  /** Configuration ID to reject */
  id: DeviceConfigId,

  /** User rejecting the configuration */
  rejectedBy: Schema.NonEmptyString,

  /** Reason for rejection (required for audit) */
  reason: Schema.NonEmptyString,
})
export type RejectConfigParams = Schema.Schema.Type<typeof RejectConfigParams>
