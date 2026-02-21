/**
 * GeniferTreeModel DDL — genifer_trees table
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const createGeniferTreesTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS genifer_trees (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      prompt          TEXT NOT NULL,
      root_key        TEXT NOT NULL,
      model           TEXT,
      quality_score   REAL NOT NULL DEFAULT 0,
      element_count   INT  NOT NULL DEFAULT 0,
      repair_count    INT  NOT NULL DEFAULT 0,
      duration_ms     INT,
      thread_id       TEXT,
      parent_tree_id  UUID REFERENCES genifer_trees(id),
      human_rating    SMALLINT CHECK (human_rating IS NULL OR human_rating BETWEEN 1 AND 5),
      usage_count     INT DEFAULT 0,
      tags            TEXT[] DEFAULT '{}',
      metadata        JSONB DEFAULT '{}',
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_trees_thread   ON genifer_trees(thread_id) WHERE thread_id IS NOT NULL`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_trees_model    ON genifer_trees(model) WHERE model IS NOT NULL`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_trees_tags     ON genifer_trees USING GIN(tags)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_trees_parent   ON genifer_trees(parent_tree_id) WHERE parent_tree_id IS NOT NULL`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_trees_quality  ON genifer_trees(quality_score DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_trees_created  ON genifer_trees(created_at DESC)`
})
