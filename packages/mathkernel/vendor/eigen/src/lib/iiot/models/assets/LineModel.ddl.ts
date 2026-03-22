/**
 * LineModel DDL - Co-located database schema for Production Line entity
 *
 * ISA-95 Level 1 (Work Center) - Parent: Plant (required)
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Lines Table DDL
// =============================================================================

/**
 * Creates the lines table in the iiot schema.
 *
 * ISA-95 Equipment Hierarchy: Line is a production work center (L1).
 * Parent: Plant (required)
 * Contains: WorkCells, Machines
 *
 * Columns:
 * - id: TEXT PRIMARY KEY (LineId, e.g., 'LIN-assembly-01')
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL (active|inactive|maintenance|decommissioned)
 * - description: TEXT (nullable)
 * - hierarchy_path: TEXT NOT NULL (materialized path for queries)
 * - enterprise_id: TEXT NOT NULL REFERENCES iiot.enterprises(id) (ancestry)
 * - site_id: TEXT NOT NULL REFERENCES iiot.sites(id) (ancestry)
 * - area_id: TEXT REFERENCES iiot.areas(id) (optional ancestry)
 * - plant_id: TEXT NOT NULL REFERENCES iiot.plants(id) (direct parent)
 * - capacity: NUMERIC (nullable, units/hour capacity)
 * - operating_hours_per_day: NUMERIC (nullable, 0-24)
 * - location: JSONB (nullable, AssetLocation)
 * - metadata: JSONB DEFAULT '{}'
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ
 */
export const createLinesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.lines (
      id                      TEXT PRIMARY KEY,
      name                    TEXT NOT NULL,
      status                  TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
      description             TEXT,
      hierarchy_path          TEXT NOT NULL,
      enterprise_id           TEXT NOT NULL REFERENCES iiot.enterprises(id) ON DELETE CASCADE,
      site_id                 TEXT NOT NULL REFERENCES iiot.sites(id) ON DELETE CASCADE,
      area_id                 TEXT REFERENCES iiot.areas(id) ON DELETE CASCADE,
      plant_id                TEXT NOT NULL REFERENCES iiot.plants(id) ON DELETE CASCADE,
      capacity                NUMERIC,
      operating_hours_per_day NUMERIC CHECK (operating_hours_per_day IS NULL OR (operating_hours_per_day >= 0 AND operating_hours_per_day <= 24)),
      location                JSONB,
      metadata                JSONB DEFAULT '{}',
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_lines_hierarchy ON iiot.lines (hierarchy_path)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_lines_enterprise ON iiot.lines (enterprise_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_lines_site ON iiot.lines (site_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_lines_area ON iiot.lines (area_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_lines_plant ON iiot.lines (plant_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_lines_name ON iiot.lines (name)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_lines_status ON iiot.lines (status)`
})
