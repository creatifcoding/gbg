/**
 * Co-located DDL for {@link EntityModel}. Public schema. No iiot search_path.
 *
 * @module @tmnl/specimendb/models/EntityModel.ddl
 */

import * as Effect from 'effect/Effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';

export const createEntitiesTable = Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS entities (
      id          TEXT PRIMARY KEY,
      kind        TEXT NOT NULL CHECK (kind IN (
                    'specimen',
                    'sheet',
                    'solid',
                    'media',
                    'run',
                    'report',
                    'pr',
                    'issue',
                    'observation',
                    'analog',
                    'view',
                    'activity'
                  )),
      created_at  TEXT NOT NULL
    )
  `;

  yield* sql`CREATE INDEX IF NOT EXISTS idx_entities_kind ON entities (kind)`;
});
