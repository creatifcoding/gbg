/**
 * LineModel DDL - Co-located database schema for Production Line entity
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
 * Columns derived from LineModel:
 * - id: TEXT PRIMARY KEY (client-provided LineId, e.g., 'LINE-001')
 * - name: TEXT NOT NULL
 * - plant_id: TEXT NOT NULL REFERENCES iiot.plants(id)
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ DEFAULT NOW()
 */
export const createLinesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.lines (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      plant_id    TEXT NOT NULL REFERENCES iiot.plants(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_lines_plant ON iiot.lines (plant_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_lines_name ON iiot.lines (name)`
})
