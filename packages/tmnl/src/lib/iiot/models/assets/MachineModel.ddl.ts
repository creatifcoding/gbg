/**
 * MachineModel DDL - Co-located database schema for Machine entity
 *
 * ISA-95 Level 1 (Equipment) - Parent: Line (required), Optional: WorkCell
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Machines Table DDL
// =============================================================================

/**
 * Creates the machines table in the iiot schema.
 *
 * ISA-95 Equipment Hierarchy: Machine is discrete processing equipment (L1).
 * Parent: Line (required), WorkCell (optional)
 * Contains: Sensors, Devices
 *
 * Columns:
 * - id: TEXT PRIMARY KEY (MachineId, e.g., 'MCH-cnc-01')
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL (active|inactive|maintenance|decommissioned)
 * - description: TEXT (nullable)
 * - hierarchy_path: TEXT NOT NULL (materialized path for queries)
 * - enterprise_id: TEXT NOT NULL REFERENCES iiot.enterprises(id) (ancestry)
 * - site_id: TEXT NOT NULL REFERENCES iiot.sites(id) (ancestry)
 * - area_id: TEXT REFERENCES iiot.areas(id) (optional ancestry)
 * - plant_id: TEXT NOT NULL REFERENCES iiot.plants(id) (ancestry)
 * - line_id: TEXT NOT NULL REFERENCES iiot.lines(id) (direct parent)
 * - workcell_id: TEXT REFERENCES iiot.workcells(id) (optional parent)
 * - machine_type: TEXT NOT NULL (machine type/category)
 * - manufacturer: TEXT (nullable, equipment manufacturer)
 * - model_number: TEXT (nullable, model number)
 * - serial_number: TEXT (nullable, serial number)
 * - installation_date: TIMESTAMPTZ (nullable)
 * - last_maintenance_date: TIMESTAMPTZ (nullable)
 * - next_maintenance_date: TIMESTAMPTZ (nullable)
 * - location: JSONB (nullable, AssetLocation)
 * - metadata: JSONB DEFAULT '{}'
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ
 */
export const createMachinesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.machines (
      id                      TEXT PRIMARY KEY,
      name                    TEXT NOT NULL,
      status                  TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
      description             TEXT,
      hierarchy_path          TEXT NOT NULL,
      enterprise_id           TEXT NOT NULL REFERENCES iiot.enterprises(id) ON DELETE CASCADE,
      site_id                 TEXT NOT NULL REFERENCES iiot.sites(id) ON DELETE CASCADE,
      area_id                 TEXT REFERENCES iiot.areas(id) ON DELETE CASCADE,
      plant_id                TEXT NOT NULL REFERENCES iiot.plants(id) ON DELETE CASCADE,
      line_id                 TEXT NOT NULL REFERENCES iiot.lines(id) ON DELETE CASCADE,
      workcell_id             TEXT REFERENCES iiot.workcells(id) ON DELETE CASCADE,
      machine_type            TEXT NOT NULL,
      manufacturer            TEXT,
      model_number            TEXT,
      serial_number           TEXT,
      installation_date       TIMESTAMPTZ,
      last_maintenance_date   TIMESTAMPTZ,
      next_maintenance_date   TIMESTAMPTZ,
      location                JSONB,
      metadata                JSONB DEFAULT '{}',
      created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at              TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_machines_hierarchy ON iiot.machines (hierarchy_path)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_machines_enterprise ON iiot.machines (enterprise_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_machines_site ON iiot.machines (site_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_machines_area ON iiot.machines (area_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_machines_plant ON iiot.machines (plant_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_machines_line ON iiot.machines (line_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_machines_workcell ON iiot.machines (workcell_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_machines_name ON iiot.machines (name)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_machines_status ON iiot.machines (status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_machines_type ON iiot.machines (machine_type)`
})
