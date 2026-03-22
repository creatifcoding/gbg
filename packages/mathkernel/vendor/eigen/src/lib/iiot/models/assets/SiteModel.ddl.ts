/**
 * SiteModel DDL - Co-located database schema for Site entity
 *
 * ISA-95 Level 3 (Geographic) - Parent: Enterprise (required)
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Sites Table DDL
// =============================================================================

/**
 * Creates the sites table in the iiot schema.
 *
 * ISA-95 Equipment Hierarchy: Site is a geographic location (L3).
 * Parent: Enterprise (required)
 *
 * Columns:
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
 */
export const createSitesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.sites (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      status          TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
      description     TEXT,
      hierarchy_path  TEXT NOT NULL,
      enterprise_id   TEXT NOT NULL REFERENCES iiot.enterprises(id) ON DELETE CASCADE,
      timezone        TEXT NOT NULL,
      address         TEXT,
      city            TEXT,
      country         TEXT,
      location        JSONB,
      metadata        JSONB DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_sites_hierarchy ON iiot.sites (hierarchy_path)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sites_enterprise ON iiot.sites (enterprise_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sites_name ON iiot.sites (name)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sites_status ON iiot.sites (status)`
})
