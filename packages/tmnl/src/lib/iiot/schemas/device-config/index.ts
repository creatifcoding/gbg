/**
 * DeviceConfig Schema Exports
 *
 * Device configuration management with versioning and audit trail.
 *
 * @module @gbg/tmnl/iiot/schemas/device-config
 */

// Schema exports
export {
  // Identifiers
  DeviceConfigId,
  makeDeviceConfigId,

  // Version
  ConfigVersion,

  // Status
  ConfigStatus,

  // Thresholds
  ThresholdsConfig,

  // Entity
  DeviceConfig,

  // Command Params
  CreateConfigParams,
  UpdateConfigParams,
  ActivateConfigParams,
  ApproveConfigParams,
  RejectConfigParams,
} from './schema'

// Type exports
export type {
  DeviceConfigType,
} from './schema'

// Audit event exports
export {
  ConfigCreated,
  ConfigUpdated,
  ConfigActivated,
  ConfigArchived,
  ConfigApproved,
  ConfigRejected,
  ConfigAuditEvent,
} from './audit'

// Audit type exports
export type {
  ConfigCreatedType,
  ConfigUpdatedType,
  ConfigActivatedType,
  ConfigArchivedType,
  ConfigApprovedType,
  ConfigRejectedType,
} from './audit'
