/**
 * ComponentModel DDL — components keyed by entity_id.
 *
 * @module @tmnl/specimendb/models/ComponentModel.ddl
 */

import * as Effect from 'effect/Effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';
import { COMPONENT_KIND_VALUES } from '../schemas/components.js';
import { sqlTextLiteralList } from './_ddl-helpers.js';

const KIND_CHECK = sqlTextLiteralList(COMPONENT_KIND_VALUES);

export const createComponentsTable = Effect.gen(function* () {
  const sql = yield* SqlClient;

  // Recreate if an older components table is still keyed the wrong way.
  yield* sql.unsafe(`DROP TABLE IF EXISTS components CASCADE`);

  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS components (
      id          TEXT PRIMARY KEY,
      entity_id   TEXT NOT NULL REFERENCES entities(id),
      kind        TEXT NOT NULL CHECK (kind IN (${KIND_CHECK})),
      payload     JSONB NOT NULL,
      attached_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  yield* sql.unsafe(
    `CREATE INDEX IF NOT EXISTS idx_components_entity ON components (entity_id)`,
  );
  yield* sql.unsafe(
    `CREATE INDEX IF NOT EXISTS idx_components_entity_kind ON components (entity_id, kind)`,
  );
});

/** Widen the kind CHECK when COMPONENT_KIND_VALUES grows (e.g. Supersedes). */
export const syncComponentKindCheck = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql.unsafe(`ALTER TABLE components DROP CONSTRAINT IF EXISTS components_kind_check`);
  yield* sql.unsafe(
    `ALTER TABLE components ADD CONSTRAINT components_kind_check CHECK (kind IN (${KIND_CHECK}))`,
  );
});
