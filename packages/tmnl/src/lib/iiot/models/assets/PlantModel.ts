/**
 * PlantModel - Effect SQL Model for Plant Entity
 *
 * Model for PostgreSQL persistence - defines fields per DDL.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { PlantId, EnterpriseId, SiteId, AreaId } from '../../schemas/identifiers'
import { CreatedAt, UpdatedAt, OptionalMetadata } from '../_common'

// =============================================================================
// Asset Status (inline to avoid circular import)
// =============================================================================

const AssetStatus = Schema.Literal('active', 'inactive', 'maintenance', 'decommissioned')

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Plant Model
 *
 * Defines fields for PostgreSQL persistence per DDL:
 * - id: TEXT PRIMARY KEY (client-provided PlantId)
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL (active|inactive|maintenance|decommissioned)
 * - hierarchy_path: TEXT NOT NULL
 * - enterprise_id: TEXT NOT NULL REFERENCES iiot.enterprises(id)
 * - site_id: TEXT REFERENCES iiot.sites(id) (optional parent)
 * - area_id: TEXT REFERENCES iiot.areas(id) (optional parent)
 * - timezone: TEXT NOT NULL
 * - description: TEXT (nullable)
 * - site_code: TEXT (nullable)
 * - location: JSONB (nullable)
 * - metadata: JSONB DEFAULT '{}'
 *
 * PK: id (client-provided PlantId)
 * FK: enterprise_id, site_id, area_id
 */
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  // Core identity
  id: Model.GeneratedByApp(PlantId),
  name: Schema.NonEmptyString,
  status: AssetStatus,

  // Hierarchy (required)
  hierarchyPath: Schema.String,
  enterpriseId: EnterpriseId,
  timezone: Schema.String,

  // Parent references (optional - plant can be under site or area)
  siteId: Model.FieldOption(SiteId),
  areaId: Model.FieldOption(AreaId),

  // Optional fields
  description: Model.FieldOption(Schema.String),
  siteCode: Model.FieldOption(Schema.String),
  location: Model.FieldOption(Schema.Unknown), // JSONB stored as unknown
  metadata: OptionalMetadata,

  // DB-only fields (timestamps)
  createdAt: CreatedAt,
  updatedAt: Model.FieldOption(Schema.DateFromSelf),
}) {}
