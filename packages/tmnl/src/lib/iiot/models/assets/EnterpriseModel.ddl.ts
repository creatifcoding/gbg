/**
 * EnterpriseModel DDL - Co-located database schema for Enterprise entity
 *
 * ISA-95 Level 4 (Business Planning) - Root entity, no parent
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Enterprises Table DDL
// =============================================================================

/**
 * Creates the enterprises table in the iiot schema.
 *
 * ISA-95 Equipment Hierarchy: Enterprise is the root entity (L4).
 * No parent FK constraints - this is the top of the hierarchy.
 *
 * Columns:
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
 */
export const createEnterprisesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.enterprises (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      status          TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
      description     TEXT,
      hierarchy_path  TEXT NOT NULL,
      industry        TEXT,
      legal_name      TEXT,
      tax_id          TEXT,
      headquarters    TEXT,
      location        JSONB,
      metadata        JSONB DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ
    )
  `

  // Index for hierarchy path queries (GiST for pattern matching)
  yield* sql`CREATE INDEX IF NOT EXISTS idx_enterprises_hierarchy ON iiot.enterprises (hierarchy_path)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_enterprises_name ON iiot.enterprises (name)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_enterprises_status ON iiot.enterprises (status)`
})
