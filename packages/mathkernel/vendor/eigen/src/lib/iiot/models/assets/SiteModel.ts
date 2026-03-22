/**
 * SiteModel - Effect SQL Model for Site Entity
 *
 * ISA-95 Level 3 (Geographic) - Parent: Enterprise (required).
 * Model for PostgreSQL persistence - defines fields per DDL.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { SiteId, EnterpriseId } from '../../schemas/identifiers'
import { CreatedAt, OptionalMetadata } from '../_common'

// =============================================================================
// Asset Status (inline to avoid circular import)
// =============================================================================

const AssetStatus = Schema.Literal('active', 'inactive', 'maintenance', 'decommissioned')

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Site Model
 *
 * Defines fields for PostgreSQL persistence per DDL:
 * - id: TEXT PRIMARY KEY (SiteId, e.g., 'SIT-chicago')
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL (active|inactive|maintenance|decommissioned)
 * - description: TEXT (nullable)
 * - hierarchy_path: TEXT NOT NULL (materialized path for queries)
 * - enterprise_id: TEXT NOT NULL REFERENCES iiot.enterprises(id)
 * - timezone: TEXT NOT NULL (IANA timezone ID)
 * - address: TEXT (nullable, street address)
 * - city: TEXT (nullable)
 * - country: TEXT (nullable)
 * - location: JSONB (nullable, AssetLocation)
 * - metadata: JSONB DEFAULT '{}'
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ
 *
 * PK: id (client-provided SiteId)
 * FK: enterprise_id
 */
export class SiteModel extends Model.Class<SiteModel>('SiteModel')({
  // Core identity
  id: Model.GeneratedByApp(SiteId),
  name: Schema.NonEmptyString,
  status: AssetStatus,

  // Hierarchy (required)
  hierarchyPath: Schema.String,
  enterpriseId: EnterpriseId,
  timezone: Schema.String,

  // Optional fields
  description: Model.FieldOption(Schema.String),
  address: Model.FieldOption(Schema.String),
  city: Model.FieldOption(Schema.String),
  country: Model.FieldOption(Schema.String),
  location: Model.FieldOption(Schema.Unknown), // JSONB stored as unknown
  metadata: OptionalMetadata,

  // DB-only fields (timestamps)
  createdAt: CreatedAt,
  updatedAt: Model.FieldOption(Schema.DateFromSelf),
}) {}
