/**
 * GeniferCompositeModel DDL — genifer_composites table
 *
 * Agent-created reusable tree fragments.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const createGeniferCompositesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS genifer_composites (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name            TEXT UNIQUE NOT NULL,
      description     TEXT,
      template        JSONB NOT NULL,
      props_schema    JSONB,
      default_class   TEXT,
      has_children    BOOLEAN DEFAULT false,
      quality_score   REAL DEFAULT 0,
      human_rating    SMALLINT CHECK (human_rating IS NULL OR human_rating BETWEEN 1 AND 5),
      usage_count     INT DEFAULT 0,
      created_by      TEXT NOT NULL DEFAULT 'agent'
                      CHECK (created_by IN ('system', 'agent', 'human')),
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_composites_name    ON genifer_composites(name)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_composites_quality ON genifer_composites(quality_score DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_composites_usage   ON genifer_composites(usage_count DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_composites_creator ON genifer_composites(created_by)`
})
