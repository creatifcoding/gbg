/**
 * MachineModel - Effect SQL Model for Machine Entity
 *
 * Model for PostgreSQL persistence - defines fields per DDL.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { MachineId, LineId, PlantId, EnterpriseId, SiteId, AreaId, WorkCellId } from '../../schemas/identifiers'
import { CreatedAt, UpdatedAt, OptionalMetadata } from '../_common'

// =============================================================================
// Asset Status (inline to avoid circular import)
// =============================================================================

const AssetStatus = Schema.Literal('active', 'inactive', 'maintenance', 'decommissioned')

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Machine Model
 *
 * Defines fields for PostgreSQL persistence per DDL:
 * - id: TEXT PRIMARY KEY (client-provided MachineId)
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL
 * - hierarchy_path: TEXT NOT NULL
 * - enterprise_id: TEXT NOT NULL (ancestry)
 * - site_id: TEXT NOT NULL (ancestry)
 * - area_id: TEXT (optional ancestry)
 * - plant_id: TEXT NOT NULL (ancestry)
 * - line_id: TEXT NOT NULL (direct parent)
 * - workcell_id: TEXT (optional parent)
 * - machine_type: TEXT NOT NULL
 * - manufacturer: TEXT (nullable)
 * - model_number: TEXT (nullable)
 * - serial_number: TEXT (nullable)
 * - installation_date: TIMESTAMPTZ (nullable)
 * - last_maintenance_date: TIMESTAMPTZ (nullable)
 * - next_maintenance_date: TIMESTAMPTZ (nullable)
 * - location: JSONB (nullable)
 * - metadata: JSONB DEFAULT '{}'
 *
 * PK: id (client-provided MachineId)
 * FK: enterprise_id, site_id, area_id, plant_id, line_id, workcell_id
 */
export class MachineModel extends Model.Class<MachineModel>('MachineModel')({
  // Core identity
  id: Model.GeneratedByApp(MachineId),
  name: Schema.NonEmptyString,
  status: AssetStatus,
  machineType: Schema.String,

  // Hierarchy (required)
  hierarchyPath: Schema.String,
  enterpriseId: EnterpriseId,
  siteId: SiteId,
  plantId: PlantId,
  lineId: LineId,

  // Optional ancestry/parent
  areaId: Model.FieldOption(AreaId),
  workcellId: Model.FieldOption(WorkCellId),

  // Optional fields
  description: Model.FieldOption(Schema.String),
  manufacturer: Model.FieldOption(Schema.String),
  modelNumber: Model.FieldOption(Schema.String),
  serialNumber: Model.FieldOption(Schema.String),
  installationDate: Model.FieldOption(Schema.DateFromSelf),
  lastMaintenanceDate: Model.FieldOption(Schema.DateFromSelf),
  nextMaintenanceDate: Model.FieldOption(Schema.DateFromSelf),
  location: Model.FieldOption(Schema.Unknown),
  metadata: OptionalMetadata,

  // DB-only fields (timestamps)
  createdAt: CreatedAt,
  updatedAt: Model.FieldOption(Schema.DateFromSelf),
}) {}
