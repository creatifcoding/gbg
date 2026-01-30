/**
 * AreaModel DDL - Co-located database schema for Area entity
 *
 * ISA-95 Level 2 (Supervisory Control) - Parent: Site (required)
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Areas Table DDL
// =============================================================================

/**
 * Creates the areas table in the iiot schema.
 *
 * ISA-95 Equipment Hierarchy: Area is a supervisory control scope (L2).
 * Parent: Site (required)
 * Contains: Plants, Lines
 *
 * Columns:
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
 */
export const createAreasTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.areas (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      status          TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
      description     TEXT,
      hierarchy_path  TEXT NOT NULL,
      enterprise_id   TEXT NOT NULL REFERENCES iiot.enterprises(id) ON DELETE CASCADE,
      site_id         TEXT NOT NULL REFERENCES iiot.sites(id) ON DELETE CASCADE,
      area_type       TEXT,
      building        TEXT,
      floor           TEXT,
      location        JSONB,
      metadata        JSONB DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_areas_hierarchy ON iiot.areas (hierarchy_path)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_areas_enterprise ON iiot.areas (enterprise_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_areas_site ON iiot.areas (site_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_areas_name ON iiot.areas (name)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_areas_status ON iiot.areas (status)`
})
