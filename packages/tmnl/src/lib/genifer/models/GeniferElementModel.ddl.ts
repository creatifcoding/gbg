/**
 * GeniferElementModel DDL — genifer.elements table (leaves-as-graph)
 *
 * Every UIElement is a row. parent_key encodes the tree graph.
 * children TEXT[] preserves ordering.
 *
 * @module
 */

import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const createGeniferElementsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS genifer.elements (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tree_id         UUID NOT NULL REFERENCES genifer.trees(id) ON DELETE CASCADE,
      element_key     TEXT NOT NULL,
      element_type    TEXT NOT NULL,
      props           JSONB NOT NULL DEFAULT '{}',
      class_name      TEXT,
      parent_key      TEXT,
      children        TEXT[] DEFAULT '{}',
      depth           INT NOT NULL DEFAULT 0,
      entrance        JSONB,
      role            TEXT,
      aria_label      TEXT,
      visible         JSONB,
      quality_score   REAL DEFAULT 0,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

      UNIQUE(tree_id, element_key)
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_elements_tree    ON genifer.elements(tree_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_elements_type    ON genifer.elements(element_type)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_elements_parent  ON genifer.elements(tree_id, parent_key)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_elements_props   ON genifer.elements USING GIN(props)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_elements_class   ON genifer.elements(class_name) WHERE class_name IS NOT NULL`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_genifer_elements_depth   ON genifer.elements(tree_id, depth)`
})
