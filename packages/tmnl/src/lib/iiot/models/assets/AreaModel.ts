/**
 * AreaModel - Effect SQL Model for Area Entity
 *
 * ISA-95 Level 2 (Supervisory Control) - Parent: Site (required).
 * Model for PostgreSQL persistence - defines fields per DDL.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { AreaId, EnterpriseId, SiteId } from '../../schemas/identifiers'
import { CreatedAt, OptionalMetadata } from '../_common'

// =============================================================================
// Asset Status (inline to avoid circular import)
// =============================================================================

const AssetStatus = Schema.Literal('active', 'inactive', 'maintenance', 'decommissioned')

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Area Model
 *
 * Defines fields for PostgreSQL persistence per DDL:
 * - id: TEXT PRIMARY KEY (AreaId, e.g., 'ARA-assembly')
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL (active|inactive|maintenance|decommissioned)
 * - description: TEXT (nullable)
 * - hierarchy_path: TEXT NOT NULL (materialized path for queries)
 * - enterprise_id: TEXT NOT NULL REFERENCES iiot.enterprises(id) (ancestry)
 * - site_id: TEXT NOT NULL REFERENCES iiot.sites(id) (direct parent)
 * - area_type: TEXT (nullable, area classification)
 * - building: TEXT (nullable, building name)
 * - floor: TEXT (nullable, floor/level)
 * - location: JSONB (nullable, AssetLocation)
 * - metadata: JSONB DEFAULT '{}'
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ
 *
 * PK: id (client-provided AreaId)
 * FK: enterprise_id, site_id
 */
export class AreaModel extends Model.Class<AreaModel>('AreaModel')({
  // Core identity
  id: Model.GeneratedByApp(AreaId),
  name: Schema.NonEmptyString,
  status: AssetStatus,

  // Hierarchy (required)
  hierarchyPath: Schema.String,
  enterpriseId: EnterpriseId,
  siteId: SiteId,

  // Optional fields
  description: Model.FieldOption(Schema.String),
  areaType: Model.FieldOption(Schema.String),
  building: Model.FieldOption(Schema.String),
  floor: Model.FieldOption(Schema.String),
  location: Model.FieldOption(Schema.Unknown), // JSONB stored as unknown
  metadata: OptionalMetadata,

  // DB-only fields (timestamps)
  createdAt: CreatedAt,
  updatedAt: Model.FieldOption(Schema.DateFromSelf),
}) {}
