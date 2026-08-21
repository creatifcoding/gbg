/**
 * Co-located DDL for {@link EdgeModel}. Append-only.
 *
 * @module @tmnl/specimendb/models/EdgeModel.ddl
 */

import * as Effect from 'effect/Effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';

export const createEdgesTable = Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS edges (
      id       TEXT PRIMARY KEY,
      src      TEXT NOT NULL,
      rel      TEXT NOT NULL CHECK (rel IN (
                 'used',
                 'generated',
                 'exhibits',
                 'performs',
                 'via',
                 'inspires',
                 'depicts',
                 'contained-in',
                 'contradicts',
                 'derived-from'
               )),
      dst      TEXT NOT NULL,
      payload  JSONB NOT NULL,
      at       TEXT NOT NULL
    )
  `;

  yield* sql`CREATE INDEX IF NOT EXISTS idx_edges_src ON edges (src)`;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_edges_dst ON edges (dst)`;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_edges_rel ON edges (rel)`;

  yield* sql.unsafe(`
    CREATE OR REPLACE FUNCTION catalog_edges_append_only() RETURNS trigger AS $fn$
    BEGIN
      RAISE EXCEPTION 'edges is append-only';
    END;
    $fn$ LANGUAGE plpgsql
  `);

  yield* sql.unsafe(`DROP TRIGGER IF EXISTS edges_no_mutate ON edges`);
  yield* sql.unsafe(`
    CREATE TRIGGER edges_no_mutate
      BEFORE UPDATE OR DELETE ON edges
      FOR EACH ROW
      EXECUTE PROCEDURE catalog_edges_append_only()
  `);
});
