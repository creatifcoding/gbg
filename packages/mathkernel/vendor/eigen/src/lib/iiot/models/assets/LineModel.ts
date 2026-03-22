/**
 * LineModel - Effect SQL Model for Production Line Entity
 *
 * Model for PostgreSQL persistence - defines fields per DDL.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { LineId, PlantId, EnterpriseId, SiteId, AreaId } from '../../schemas/identifiers'
import { CreatedAt, OptionalMetadata, OptionalNumeric } from '../_common'

// =============================================================================
// Asset Status (inline to avoid circular import)
// =============================================================================

const AssetStatus = Schema.Literal('active', 'inactive', 'maintenance', 'decommissioned')

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Line Model
 *
 * Defines fields for PostgreSQL persistence per DDL:
 * - id: TEXT PRIMARY KEY (client-provided LineId)
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL
 * - hierarchy_path: TEXT NOT NULL
 * - enterprise_id: TEXT NOT NULL (ancestry)
 * - site_id: TEXT NOT NULL (ancestry)
 * - area_id: TEXT (optional ancestry)
 * - plant_id: TEXT NOT NULL (direct parent)
 * - capacity: NUMERIC (nullable)
 * - operating_hours_per_day: NUMERIC (nullable)
 * - location: JSONB (nullable)
 * - metadata: JSONB DEFAULT '{}'
 *
 * PK: id (client-provided LineId)
 * FK: enterprise_id, site_id, area_id, plant_id
 */
export class LineModel extends Model.Class<LineModel>('LineModel')({
  // Core identity
  id: Model.GeneratedByApp(LineId),
  name: Schema.NonEmptyString,
  status: AssetStatus,

  // Hierarchy (required)
  hierarchyPath: Schema.String,
  enterpriseId: EnterpriseId,
  siteId: SiteId,
  plantId: PlantId,

  // Optional ancestry
  areaId: Model.FieldOption(AreaId),

  // Optional fields
  description: Model.FieldOption(Schema.String),
  capacity: OptionalNumeric,
  operatingHoursPerDay: OptionalNumeric,
  location: Model.FieldOption(Schema.Unknown),
  metadata: OptionalMetadata,

  // DB-only fields (timestamps)
  createdAt: CreatedAt,
  updatedAt: Model.FieldOption(Schema.DateFromSelf),
}) {}
