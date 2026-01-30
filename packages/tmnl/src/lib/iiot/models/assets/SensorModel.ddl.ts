/**
 * SensorModel DDL - Co-located database schema for Sensor entity
 *
 * ISA-95 Level 0 (Control Module / Read) - Parent: Machine (required)
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

// =============================================================================
// Sensors Table DDL
// =============================================================================

/**
 * Creates the sensors table in the iiot schema.
 *
 * ISA-95 Equipment Hierarchy: Sensor is instrumentation/control module (L0).
 * Parent: Machine (required)
 * Leaf node - no children
 *
 * Columns:
 * - id: TEXT PRIMARY KEY (SensorId, e.g., 'SNS-temp-01')
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
 * - sensor_type: TEXT NOT NULL (temperature|pressure|vibration|humidity|flow|level|speed|position|current|voltage|power|force|torque|weight|ph|conductivity|other)
 * - unit: TEXT NOT NULL (measurement unit)
 * - sample_rate_ms: INTEGER (nullable, sample rate in milliseconds)
 * - threshold_high: NUMERIC (nullable, warning high threshold)
 * - threshold_critical: NUMERIC (nullable, critical high threshold)
 * - threshold_low: NUMERIC (nullable, warning low threshold)
 * - opc_ua_node_id: TEXT (nullable, OPC-UA Node ID)
 * - location: JSONB (nullable, AssetLocation)
 * - metadata: JSONB DEFAULT '{}'
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ
 */
export const createSensorsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.sensors (
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
      workcell_id         TEXT REFERENCES iiot.workcells(id) ON DELETE CASCADE,
      machine_id          TEXT NOT NULL REFERENCES iiot.machines(id) ON DELETE CASCADE,
      sensor_type         TEXT NOT NULL,
      unit                TEXT NOT NULL,
      sample_rate_ms      INTEGER,
      threshold_high      NUMERIC,
      threshold_critical  NUMERIC,
      threshold_low       NUMERIC,
      opc_ua_node_id      TEXT,
      location            JSONB,
      metadata            JSONB DEFAULT '{}',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMPTZ
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_hierarchy ON iiot.sensors (hierarchy_path)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_enterprise ON iiot.sensors (enterprise_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_site ON iiot.sensors (site_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_area ON iiot.sensors (area_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_plant ON iiot.sensors (plant_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_line ON iiot.sensors (line_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_workcell ON iiot.sensors (workcell_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_machine ON iiot.sensors (machine_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_name ON iiot.sensors (name)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_status ON iiot.sensors (status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_type ON iiot.sensors (sensor_type)`
})
