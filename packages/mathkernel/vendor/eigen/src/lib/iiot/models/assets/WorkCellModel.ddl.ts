/**
 * WorkCellModel DDL - Co-located database schema for WorkCell entity
 *
 * ISA-95 Level 1 (Work Unit) - Parent: Line (required)
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// WorkCells Table DDL
// =============================================================================

/**
 * Creates the workcells table in the iiot schema.
 *
 * ISA-95 Equipment Hierarchy: WorkCell is a work unit grouping (L1).
 * Parent: Line (required)
 * Contains: Machines
 *
 * Columns:
 * - id: TEXT PRIMARY KEY (WorkCellId, e.g., 'WCL-weld-01')
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL (active|inactive|maintenance|decommissioned)
 * - description: TEXT (nullable)
 * - hierarchy_path: TEXT NOT NULL (materialized path for queries)
 * - enterprise_id: TEXT NOT NULL REFERENCES iiot.enterprises(id) (ancestry)
 * - site_id: TEXT NOT NULL REFERENCES iiot.sites(id) (ancestry)
 * - area_id: TEXT REFERENCES iiot.areas(id) (optional ancestry)
 * - plant_id: TEXT NOT NULL REFERENCES iiot.plants(id) (ancestry)
 * - line_id: TEXT NOT NULL REFERENCES iiot.lines(id) (direct parent)
 * - cell_type: TEXT (nullable, cell classification)
 * - cycle_time_seconds: NUMERIC (nullable, cycle time)
 * - position: INTEGER (nullable, sequence position in line)
 * - location: JSONB (nullable, AssetLocation)
 * - metadata: JSONB DEFAULT '{}'
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ
 */
export const createWorkCellsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.workcells (
      id                  TEXT PRIMARY KEY,
      name                TEXT NOT NULL,
      status              TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
      description         TEXT,
      hierarchy_path      TEXT NOT NULL,
      enterprise_id       TEXT NOT NULL REFERENCES iiot.enterprises(id) ON DELETE CASCADE,
      site_id             TEXT NOT NULL REFERENCES iiot.sites(id) ON DELETE CASCADE,
      area_id             TEXT REFERENCES iiot.areas(id) ON DELETE CASCADE,
      plant_id            TEXT NOT NULL REFERENCES iiot.plants(id) ON DELETE CASCADE,
      line_id             TEXT NOT NULL REFERENCES iiot.lines(id) ON DELETE CASCADE,
      cell_type           TEXT,
      cycle_time_seconds  NUMERIC,
      position            INTEGER,
      location            JSONB,
      metadata            JSONB DEFAULT '{}',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_workcells_hierarchy ON iiot.workcells (hierarchy_path)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_workcells_enterprise ON iiot.workcells (enterprise_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_workcells_site ON iiot.workcells (site_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_workcells_area ON iiot.workcells (area_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_workcells_plant ON iiot.workcells (plant_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_workcells_line ON iiot.workcells (line_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_workcells_name ON iiot.workcells (name)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_workcells_status ON iiot.workcells (status)`
})
