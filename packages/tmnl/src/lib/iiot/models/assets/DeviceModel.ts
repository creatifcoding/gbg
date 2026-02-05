/**
 * DeviceModel - Effect SQL Model for Device Entity
 *
 * ISA-95 Level 0 (Control Module / Write) - Parent: Machine (required).
 * Model for PostgreSQL persistence - defines fields per DDL.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { DeviceId, EnterpriseId, SiteId, AreaId, PlantId, LineId, WorkCellId, MachineId } from '../../schemas/identifiers'
import { CreatedAt, OptionalMetadata } from '../_common'

// =============================================================================
// Asset Status (inline to avoid circular import)
// =============================================================================

const AssetStatus = Schema.Literal('active', 'inactive', 'maintenance', 'decommissioned')

// =============================================================================
// Control Mode
// =============================================================================

const ControlMode = Schema.Literal('manual', 'auto', 'remote', 'local')

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Device Model
 *
 * Defines fields for PostgreSQL persistence per DDL:
 * - id: TEXT PRIMARY KEY (DeviceId, e.g., 'DEV-motor-01')
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL (active|inactive|maintenance|decommissioned)
 * - description: TEXT (nullable)
 * - hierarchy_path: TEXT NOT NULL (materialized path for queries)
 * - enterprise_id: TEXT NOT NULL REFERENCES iiot.enterprises(id) (ancestry)
 * - site_id: TEXT NOT NULL REFERENCES iiot.sites(id) (ancestry)
 * - area_id: TEXT REFERENCES iiot.areas(id) (optional ancestry)
 * - plant_id: TEXT NOT NULL REFERENCES iiot.plants(id) (ancestry)
 * - line_id: TEXT NOT NULL REFERENCES iiot.lines(id) (ancestry)
 * - workcell_id: TEXT REFERENCES iiot.workcells(id) (optional ancestry)
 * - machine_id: TEXT NOT NULL REFERENCES iiot.machines(id) (direct parent)
 * - device_type: TEXT NOT NULL (motor|valve|pump|etc.)
 * - control_mode: TEXT (nullable, manual|auto|remote|local)
 * - rated_power: NUMERIC (nullable, power capacity)
 * - power_unit: TEXT (nullable, power unit)
 * - opc_ua_node_id: TEXT (nullable, OPC-UA Node ID)
 * - location: JSONB (nullable, AssetLocation)
 * - metadata: JSONB DEFAULT '{}'
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ
 *
 * PK: id (client-provided DeviceId)
 * FK: enterprise_id, site_id, area_id (optional), plant_id, line_id,
 *     workcell_id (optional), machine_id
 */
export class DeviceModel extends Model.Class<DeviceModel>('DeviceModel')({
  // Core identity
  id: Model.GeneratedByApp(DeviceId),
  name: Schema.NonEmptyString,
  status: AssetStatus,

  // Hierarchy (required)
  hierarchyPath: Schema.String,
  enterpriseId: EnterpriseId,
  siteId: SiteId,
  plantId: PlantId,
  lineId: LineId,
  machineId: MachineId,
  deviceType: Schema.String,

  // Optional parent references
  areaId: Model.FieldOption(AreaId),
  workcellId: Model.FieldOption(WorkCellId),

  // Optional fields
  description: Model.FieldOption(Schema.String),
  controlMode: Model.FieldOption(ControlMode),
  ratedPower: Model.FieldOption(Schema.Number),
  powerUnit: Model.FieldOption(Schema.String),
  opcUaNodeId: Model.FieldOption(Schema.String),
  location: Model.FieldOption(Schema.Unknown), // JSONB stored as unknown
  metadata: OptionalMetadata,

  // DB-only fields (timestamps)
  createdAt: CreatedAt,
  updatedAt: Model.FieldOption(Schema.DateFromSelf),
}) {}
