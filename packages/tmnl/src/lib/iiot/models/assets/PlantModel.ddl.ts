/**
 * PlantModel DDL - Co-located database schema for Plant entity
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
 * Columns derived from PlantModel:
 * - id: TEXT PRIMARY KEY (client-provided PlantId, e.g., 'PLANT-A')
 * - name: TEXT NOT NULL
 * - location: TEXT (nullable, FieldOption)
 * - created_at: TIMESTAMPTZ DEFAULT NOW()
 * - updated_at: TIMESTAMPTZ DEFAULT NOW()
 */
export const createPlantsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.plants (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      location    TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Index for name lookups
  yield* sql`CREATE INDEX IF NOT EXISTS idx_plants_name ON iiot.plants (name)`
})
