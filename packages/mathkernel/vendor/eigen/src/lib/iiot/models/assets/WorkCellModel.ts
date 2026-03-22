/**
 * WorkCellModel - Effect SQL Model for WorkCell Entity
 *
 * ISA-95 Level 1 (Work Unit) - Parent: Line (required).
 * Model for PostgreSQL persistence - defines fields per DDL.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { WorkCellId, EnterpriseId, SiteId, AreaId, PlantId, LineId } from '../../schemas/identifiers'
import { CreatedAt, OptionalMetadata } from '../_common'

// =============================================================================
// Asset Status (inline to avoid circular import)
// =============================================================================

const AssetStatus = Schema.Literal('active', 'inactive', 'maintenance', 'decommissioned')

// =============================================================================
// Model Definition
// =============================================================================

/**
 * WorkCell Model
 *
 * Defines fields for PostgreSQL persistence per DDL:
 * - id: TEXT PRIMARY KEY (WorkCellId, e.g., 'WCL-weld-01')
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL (active|inactive|maintenance|decommissioned)
 * - description: TEXT (nullable)
 * - hierarchy_path: TEXT NOT NULL (materialized path for queries)
 * - enterprise_id: TEXT NOT NULL REFERENCES iiot.enterprises(id) (ancestry)
 * - site_id: TEXT NOT NULL REFERENCES iiot.sites(id) (ancestry)
 * - area_id: TEXT REFERENCES iiot.areas(id) (optional ancestry)
 * - plant_id: TEXT NOT NULL REFERENCES iiot.plants(id) (ancestry)
 * - line_id: TEXT NOT NULL REFERENCES iiot.lines(id) (direct parent)
 * - cell_type: TEXT (nullable, cell classification)
 * - cycle_time_seconds: NUMERIC (nullable, cycle time)
 * - position: INTEGER (nullable, sequence position in line)
 * - location: JSONB (nullable, AssetLocation)
 * - metadata: JSONB DEFAULT '{}'
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ
 *
 * PK: id (client-provided WorkCellId)
 * FK: enterprise_id, site_id, area_id (optional), plant_id, line_id
 */
export class WorkCellModel extends Model.Class<WorkCellModel>('WorkCellModel')({
  // Core identity
  id: Model.GeneratedByApp(WorkCellId),
  name: Schema.NonEmptyString,
  status: AssetStatus,

  // Hierarchy (required)
  hierarchyPath: Schema.String,
  enterpriseId: EnterpriseId,
  siteId: SiteId,
  plantId: PlantId,
  lineId: LineId,

  // Optional parent reference
  areaId: Model.FieldOption(AreaId),

  // Optional fields
  description: Model.FieldOption(Schema.String),
  cellType: Model.FieldOption(Schema.String),
  cycleTimeSeconds: Model.FieldOption(Schema.Number),
  position: Model.FieldOption(Schema.Number),
  location: Model.FieldOption(Schema.Unknown), // JSONB stored as unknown
  metadata: OptionalMetadata,

  // DB-only fields (timestamps)
  createdAt: CreatedAt,
  updatedAt: Model.FieldOption(Schema.DateFromSelf),
}) {}
