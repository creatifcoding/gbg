/**
 * SensorModel - Effect SQL Model for Sensor Entity
 *
 * Model for PostgreSQL persistence - defines fields per DDL.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { DeviceId, MachineId, PlantId, LineId, EnterpriseId, SiteId, AreaId, WorkCellId } from '../../schemas/identifiers'
import { CreatedAt, OptionalMetadata, OptionalNumeric } from '../_common'

// =============================================================================
// Local Schema Definitions (matching DDL)
// =============================================================================

const AssetStatus = Schema.Literal('active', 'inactive', 'maintenance', 'decommissioned')

/**
 * Sensor type enumeration.
 * Matches Schema's SensorType - DDL has no CHECK constraint (accepts any).
 */
const SensorType = Schema.Literal(
  'temperature',
  'pressure',
  'vibration',
  'humidity',
  'flow',
  'level',
  'speed',
  'position',
  'current',
  'voltage',
  'power',
  'force',
  'torque',
  'weight',
  'ph',
  'conductivity',
  'other'
)

/**
 * Measurement unit enumeration.
 * Matches Schema's MeasurementUnit - uses underscores (mm_s not mm/s).
 */
const MeasurementUnit = Schema.Literal(
  // Temperature
  'celsius',
  'fahrenheit',
  'kelvin',
  // Pressure
  'psi',
  'bar',
  'pascal',
  'kpa',
  // Vibration
  'mm_s',
  'in_s',
  'g',
  // Flow
  'l_min',
  'gpm',
  'm3_h',
  // Level
  'meters',
  'feet',
  'mm',
  'inches',
  // General
  'percent',
  'rpm',
  'ampere',
  'volt',
  'watt',
  'newton',
  'nm',
  'kg',
  'count',
  'unitless'
)

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Sensor Model
 *
 * Defines fields for PostgreSQL persistence per DDL:
 * - device_id: TEXT PRIMARY KEY (client-provided DeviceId)
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL
 * - hierarchy_path: TEXT NOT NULL
 * - enterprise_id: TEXT NOT NULL (ancestry)
 * - site_id: TEXT NOT NULL (ancestry)
 * - area_id: TEXT (optional ancestry)
 * - plant_id: TEXT NOT NULL (ancestry)
 * - line_id: TEXT NOT NULL (ancestry)
 * - workcell_id: TEXT (optional ancestry)
 * - machine_id: TEXT NOT NULL (direct parent)
 * - sensor_type: TEXT NOT NULL
 * - unit: TEXT NOT NULL
 * - sample_rate_ms: INTEGER (nullable)
 * - threshold_high: NUMERIC (nullable)
 * - threshold_critical: NUMERIC (nullable)
 * - threshold_low: NUMERIC (nullable)
 * - opc_ua_node_id: TEXT (nullable)
 * - location: JSONB (nullable)
 * - metadata: JSONB DEFAULT '{}'
 *
 * PK: deviceId (client-provided DeviceId)
 * FK: enterprise_id, site_id, area_id, plant_id, line_id, workcell_id, machine_id
 */
export class SensorModel extends Model.Class<SensorModel>('SensorModel')({
  // Core identity
  deviceId: Model.GeneratedByApp(DeviceId),
  name: Schema.NonEmptyString,
  status: AssetStatus,
  type: SensorType,
  unit: MeasurementUnit,

  // Hierarchy (required)
  hierarchyPath: Schema.String,
  enterpriseId: EnterpriseId,
  siteId: SiteId,
  plantId: PlantId,
  lineId: LineId,
  machineId: MachineId,

  // Optional ancestry
  areaId: Model.FieldOption(AreaId),
  workcellId: Model.FieldOption(WorkCellId),

  // Optional fields
  description: Model.FieldOption(Schema.String),
  sampleRateMs: Model.FieldOption(Schema.Number),
  thresholdHigh: OptionalNumeric,
  thresholdCritical: OptionalNumeric,
  thresholdLow: OptionalNumeric,
  opcUaNodeId: Model.FieldOption(Schema.String),
  location: Model.FieldOption(Schema.Unknown),
  metadata: OptionalMetadata,

  // DB-only fields (timestamps)
  createdAt: CreatedAt,
  updatedAt: Model.FieldOption(Schema.DateFromSelf),
}) {}
