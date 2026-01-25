/**
 * MachineModel DDL - Co-located database schema for Machine entity
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
 * Columns derived from MachineModel:
 * - id: TEXT PRIMARY KEY (client-provided MachineId, e.g., 'MCH-001')
 * - name: TEXT NOT NULL
 * - line_id: TEXT NOT NULL REFERENCES iiot.lines(id)
 * - model: TEXT (nullable, FieldOption - machine model/part number)
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ DEFAULT NOW()
 */
export const createMachinesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.machines (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      line_id     TEXT NOT NULL REFERENCES iiot.lines(id) ON DELETE CASCADE,
      model       TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_machines_line ON iiot.machines (line_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_machines_name ON iiot.machines (name)`
})
