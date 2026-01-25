/**
 * SensorModel DDL - Co-located database schema for Sensor entity
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
 * Columns derived from SensorModel:
 * - device_id: TEXT PRIMARY KEY (client-provided DeviceId, e.g., 'TMP-001')
 * - type: TEXT NOT NULL (sensor type: temperature, vibration, etc.)
 * - unit: TEXT NOT NULL (measurement unit: celsius, mm/s, etc.)
 * - machine_id: TEXT NOT NULL REFERENCES iiot.machines(id)
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ DEFAULT NOW()
 */
export const createSensorsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.sensors (
      device_id   TEXT PRIMARY KEY,
      type        TEXT NOT NULL,
      unit        TEXT NOT NULL,
      machine_id  TEXT NOT NULL REFERENCES iiot.machines(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_machine ON iiot.sensors (machine_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_sensors_type ON iiot.sensors (type)`
})
