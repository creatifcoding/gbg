/**
 * EnterpriseModel - Effect SQL Model for Enterprise Entity
 *
 * ISA-95 Level 4 (Business Planning) - Root entity, no parent.
 * Model for PostgreSQL persistence - defines fields per DDL.
 *
 * @module
 */

import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { EnterpriseId } from '../../schemas/identifiers'
import { CreatedAt, OptionalMetadata } from '../_common'

// =============================================================================
// Asset Status (inline to avoid circular import)
// =============================================================================

const AssetStatus = Schema.Literal('active', 'inactive', 'maintenance', 'decommissioned')

// =============================================================================
// Model Definition
// =============================================================================

/**
 * Enterprise Model
 *
 * Defines fields for PostgreSQL persistence per DDL:
 * - id: TEXT PRIMARY KEY (EnterpriseId, e.g., 'ENT-acme')
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL (active|inactive|maintenance|decommissioned)
 * - description: TEXT (nullable)
 * - hierarchy_path: TEXT NOT NULL (materialized path for queries)
 * - industry: TEXT (nullable, industry sector)
 * - legal_name: TEXT (nullable, legal entity name)
 * - tax_id: TEXT (nullable, tax identification)
 * - headquarters: TEXT (nullable, HQ location)
 * - location: JSONB (nullable, AssetLocation)
 * - metadata: JSONB DEFAULT '{}'
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ
 *
 * PK: id (client-provided EnterpriseId)
 * FK: None (root entity)
 */
export class EnterpriseModel extends Model.Class<EnterpriseModel>('EnterpriseModel')({
  // Core identity
  id: Model.GeneratedByApp(EnterpriseId),
  name: Schema.NonEmptyString,
  status: AssetStatus,

  // Hierarchy (required)
  hierarchyPath: Schema.String,

  // Optional fields
  description: Model.FieldOption(Schema.String),
  industry: Model.FieldOption(Schema.String),
  legalName: Model.FieldOption(Schema.String),
  taxId: Model.FieldOption(Schema.String),
  headquarters: Model.FieldOption(Schema.String),
  location: Model.FieldOption(Schema.Unknown), // JSONB stored as unknown
  metadata: OptionalMetadata,

  // DB-only fields (timestamps)
  createdAt: CreatedAt,
  updatedAt: Model.FieldOption(Schema.DateFromSelf),
}) {}
