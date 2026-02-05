/**
 * DeviceConfigModel - Effect SQL Model for DeviceConfig Entity
 *
 * Derives from DeviceConfig domain schema with Model-specific transforms
 * for PostgreSQL persistence. Manages device configuration with versioning
 * and audit trail for FDA 21 CFR Part 11 compliance.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import {
  DeviceConfigId,
  ConfigVersion,
  ConfigStatus,
  ThresholdsConfig,
} from '../../schemas/device-config/schema'
import { CreatedAt } from '../_common'

// =============================================================================
// Model Definition
// =============================================================================

/**
 * DeviceConfig Model
 *
 * Derives from DeviceConfig domain schema (schemas/device-config/schema.ts).
 * Applies Model-specific transforms for PostgreSQL:
 * - Optional fields → Model.FieldOption (NULL ↔ Option)
 * - DateTimeUtc → Schema.DateFromSelf (pg Date objects)
 * - Config/Thresholds → JSONB (parsed by pg driver)
 *
 * PK: id (auto-generated DeviceConfigId, e.g., "CFG-xxxxx")
 * FK: previousVersionId → iiot.device_configs(id) (self-referential)
 */
export class DeviceConfigModel extends Model.Class<DeviceConfigModel>('DeviceConfigModel')({
  // ==========================================================================
  // Primary Key
  // ==========================================================================
  id: Model.Generated(DeviceConfigId),

  // ==========================================================================
  // Required Fields
  // ==========================================================================
  /** Target device type (sensor or device/actuator) */
  targetType: Schema.Literal('sensor', 'device'),

  /** Target device identifier (SensorId or DeviceId) */
  targetId: Schema.String,

  /** Version number (positive integer, starts at 1) */
  version: ConfigVersion,

  /** Configuration lifecycle status */
  status: ConfigStatus,

  /** Configuration data (JSONB - pg driver parses automatically) */
  config: Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  }),

  /** User/system that created this version */
  createdBy: Schema.String,

  /** Creation timestamp */
  createdAt: CreatedAt,

  // ==========================================================================
  // Optional Number Fields
  // ==========================================================================
  /** Sample rate in milliseconds */
  sampleRateMs: Model.FieldOption(Schema.Number),

  // ==========================================================================
  // Optional JSONB Fields (pg driver parses automatically)
  // ==========================================================================
  /** Threshold configuration */
  thresholds: Model.FieldOption(ThresholdsConfig),

  // ==========================================================================
  // Optional String Fields
  // ==========================================================================
  /** User who last updated (if modified) */
  updatedBy: Model.FieldOption(Schema.String),

  /** User who approved (for FDA compliance) */
  approvedBy: Model.FieldOption(Schema.String),

  /** Reason for configuration change */
  changeReason: Model.FieldOption(Schema.String),

  // ==========================================================================
  // Optional DateTime Fields (pg returns native Date objects)
  // ==========================================================================
  /** Last update timestamp */
  updatedAt: Model.FieldOption(Schema.DateFromSelf),

  /** Approval timestamp */
  approvedAt: Model.FieldOption(Schema.DateFromSelf),

  // ==========================================================================
  // Optional Identifier Fields
  // ==========================================================================
  /** Previous version ID for version chain */
  previousVersionId: Model.FieldOption(DeviceConfigId),
}) {}
