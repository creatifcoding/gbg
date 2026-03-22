/**
 * PlantModel DDL - Co-located database schema for Plant entity
 *
 * ISA-95 Level 3 (Functional Manufacturing Unit) - Parent: Site OR Area (optional)
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Plants Table DDL
// =============================================================================

/**
 * Creates the plants table in the iiot schema.
 *
 * ISA-95 Equipment Hierarchy: Plant is a functional manufacturing unit (L3).
 * Parent: Site OR Area (optional - can be direct under Site or nested under Area)
 * Contains: Lines
 *
 * Columns:
 * - id: TEXT PRIMARY KEY (PlantId, e.g., 'PLT-north')
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL (active|inactive|maintenance|decommissioned)
 * - description: TEXT (nullable)
 * - hierarchy_path: TEXT NOT NULL (materialized path for queries)
 * - enterprise_id: TEXT NOT NULL REFERENCES iiot.enterprises(id) (ancestry)
 * - site_id: TEXT REFERENCES iiot.sites(id) (optional parent)
 * - area_id: TEXT REFERENCES iiot.areas(id) (optional parent)
 * - timezone: TEXT NOT NULL (IANA timezone ID)
 * - site_code: TEXT (nullable, ERP site code)
 * - location: JSONB (nullable, AssetLocation)
 * - metadata: JSONB DEFAULT '{}'
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ
 */
export const createPlantsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.plants (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      status          TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
      description     TEXT,
      hierarchy_path  TEXT NOT NULL,
      enterprise_id   TEXT NOT NULL REFERENCES iiot.enterprises(id) ON DELETE CASCADE,
      site_id         TEXT REFERENCES iiot.sites(id) ON DELETE CASCADE,
      area_id         TEXT REFERENCES iiot.areas(id) ON DELETE CASCADE,
      timezone        TEXT NOT NULL,
      site_code       TEXT,
      location        JSONB,
      metadata        JSONB DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ,
      CONSTRAINT plant_has_parent CHECK (site_id IS NOT NULL OR area_id IS NOT NULL)
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_plants_hierarchy ON iiot.plants (hierarchy_path)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_plants_enterprise ON iiot.plants (enterprise_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_plants_site ON iiot.plants (site_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_plants_area ON iiot.plants (area_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_plants_name ON iiot.plants (name)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_plants_status ON iiot.plants (status)`
})
