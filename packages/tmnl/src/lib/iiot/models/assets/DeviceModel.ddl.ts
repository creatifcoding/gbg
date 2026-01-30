/**
 * DeviceModel DDL - Co-located database schema for Device entity
 *
 * ISA-95 Level 0 (Control Module / Write) - Parent: Machine (required)
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Devices Table DDL
// =============================================================================

/**
 * Creates the devices table in the iiot schema.
 *
 * ISA-95 Equipment Hierarchy: Device is an actuator/control module (L0).
 * Parent: Machine (required)
 * Leaf node - no children
 *
 * Columns:
 * - id: TEXT PRIMARY KEY (DeviceId, e.g., 'DEV-motor-01')
 * - name: TEXT NOT NULL
 * - status: TEXT NOT NULL (active|inactive|maintenance|decommissioned)
 * - description: TEXT (nullable)
 * - hierarchy_path: TEXT NOT NULL (materialized path for queries)
 * - enterprise_id: TEXT NOT NULL REFERENCES iiot.enterprises(id) (ancestry)
 * - site_id: TEXT NOT NULL REFERENCES iiot.sites(id) (ancestry)
 * - area_id: TEXT REFERENCES iiot.areas(id) (optional ancestry)
 * - plant_id: TEXT NOT NULL REFERENCES iiot.plants(id) (ancestry)
 * - line_id: TEXT NOT NULL REFERENCES iiot.lines(id) (ancestry)
 * - workcell_id: TEXT REFERENCES iiot.workcells(id) (optional ancestry)
 * - machine_id: TEXT NOT NULL REFERENCES iiot.machines(id) (direct parent)
 * - device_type: TEXT NOT NULL (motor|valve|pump|heater|cooler|conveyor|actuator|servo|relay|vfd|solenoid|gripper|light|alarm|other)
 * - control_mode: TEXT (nullable, manual|auto|remote|local)
 * - rated_power: NUMERIC (nullable, power capacity)
 * - power_unit: TEXT (nullable, power unit)
 * - opc_ua_node_id: TEXT (nullable, OPC-UA Node ID)
 * - location: JSONB (nullable, AssetLocation)
 * - metadata: JSONB DEFAULT '{}'
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ
 */
export const createDevicesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.devices (
      id              TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      status          TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'maintenance', 'decommissioned')),
      description     TEXT,
      hierarchy_path  TEXT NOT NULL,
      enterprise_id   TEXT NOT NULL REFERENCES iiot.enterprises(id) ON DELETE CASCADE,
      site_id         TEXT NOT NULL REFERENCES iiot.sites(id) ON DELETE CASCADE,
      area_id         TEXT REFERENCES iiot.areas(id) ON DELETE CASCADE,
      plant_id        TEXT NOT NULL REFERENCES iiot.plants(id) ON DELETE CASCADE,
      line_id         TEXT NOT NULL REFERENCES iiot.lines(id) ON DELETE CASCADE,
      workcell_id     TEXT REFERENCES iiot.workcells(id) ON DELETE CASCADE,
      machine_id      TEXT NOT NULL REFERENCES iiot.machines(id) ON DELETE CASCADE,
      device_type     TEXT NOT NULL,
      control_mode    TEXT CHECK (control_mode IS NULL OR control_mode IN ('manual', 'auto', 'remote', 'local')),
      rated_power     NUMERIC,
      power_unit      TEXT,
      opc_ua_node_id  TEXT,
      location        JSONB,
      metadata        JSONB DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_devices_hierarchy ON iiot.devices (hierarchy_path)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_devices_enterprise ON iiot.devices (enterprise_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_devices_site ON iiot.devices (site_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_devices_area ON iiot.devices (area_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_devices_plant ON iiot.devices (plant_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_devices_line ON iiot.devices (line_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_devices_workcell ON iiot.devices (workcell_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_devices_machine ON iiot.devices (machine_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_devices_name ON iiot.devices (name)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_devices_status ON iiot.devices (status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_devices_type ON iiot.devices (device_type)`
})
