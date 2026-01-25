/**
 * SensorModel - Effect SQL Model for Sensor Entity
 *
 * Derives from Sensor domain schema with Model-specific transforms
 * for PostgreSQL persistence.
 *
 * @module
 */

import { Model } from '@effect/sql'
import { DeviceId } from '../../schemas/identifiers'
import { Sensor } from '../../schemas/assets'
import { CreatedAt, UpdatedAt } from '../_common'

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Sensor Model
 *
 * Derives from Sensor domain schema (schemas/assets.ts).
 * Applies Model-specific transforms for PostgreSQL:
 * - deviceId → Model.GeneratedByApp (client-provided)
 * - Adds createdAt/updatedAt timestamps
 *
 * PK: deviceId (client-provided DeviceId, e.g., "TMP-001")
 * FK: machineId → iiot.machines(id)
 */
export class SensorModel extends Model.Class<SensorModel>('SensorModel')({
  // Derived from Sensor.fields - direct reuse
  type: Sensor.fields.type,
  unit: Sensor.fields.unit,
  machineId: Sensor.fields.machineId,

  // Derived with Model-specific transforms
  deviceId: Model.GeneratedByApp(DeviceId),  // Add GeneratedByApp modifier

  // DB-only fields (not in domain schema)
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
