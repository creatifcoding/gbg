/**
 * EntityModel DDL — `entities` table. Co-located with the Model.
 * Shape mined from tmnl iiot models/*.ddl.ts. Catalog schema, public.
 *
 * @module @tmnl/specimendb/models/EntityModel.ddl
 */

import * as Effect from 'effect/Effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { ENTITY_KIND_VALUES } from '../schemas/provenance.js';
import { sqlTextLiteralList } from './_ddl-helpers.js';

const KIND_CHECK = sqlTextLiteralList(ENTITY_KIND_VALUES);

export const createEntitiesTable = Effect.gen(function* () {
  const sql = yield* SqlClient;

  // Catalog SoT is entities. Drop a leftover specimens table if one is still around.
  yield* sql.unsafe(`DROP TABLE IF EXISTS specimens CASCADE`);

  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS entities (
      id          TEXT PRIMARY KEY,
      kind        TEXT NOT NULL CHECK (kind IN (${KIND_CHECK})),
      type        TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_entities_kind ON entities (kind)`);
  yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_entities_kind_type ON entities (kind, type)`);
  yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities (created_at)`);
});

/** Widen the kind CHECK when ENTITY_KIND_VALUES grows (contract, catalog, html). */
export const syncEntityKindCheck = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql.unsafe(`ALTER TABLE entities DROP CONSTRAINT IF EXISTS entities_kind_check`);
  yield* sql.unsafe(
    `ALTER TABLE entities ADD CONSTRAINT entities_kind_check CHECK (kind IN (${KIND_CHECK}))`,
  );
});

/** Type is a column on entities, not a third table. */
export const addEntityTypeColumn = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql.unsafe(`ALTER TABLE entities ADD COLUMN IF NOT EXISTS type TEXT`);
  yield* sql.unsafe(`CREATE INDEX IF NOT EXISTS idx_entities_kind_type ON entities (kind, type)`);
});
