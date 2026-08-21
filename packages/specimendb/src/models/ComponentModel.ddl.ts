/**
 * Co-located DDL for {@link ComponentModel}. `entity_id`, not `specimen_id`.
 *
 * @module @tmnl/specimendb/models/ComponentModel.ddl
 */

import * as Effect from 'effect/Effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';

const KIND_CHECK = `(
  'Status',
  'Claim',
  'Media',
  'Exif',
  'Locality',
  'Taxon',
  'Structure',
  'Mechanism',
  'Function',
  'AnalogLink',
  'Tag',
  'Question',
  'Observation',
  'Kind',
  'Class',
  'Provenance',
  'W7',
  'Used',
  'Generated'
)`;

export const createComponentsTable = Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS components (
      id           TEXT PRIMARY KEY,
      entity_id    TEXT NOT NULL REFERENCES entities(id),
      kind         TEXT NOT NULL CHECK (kind IN ${KIND_CHECK}),
      payload      JSONB NOT NULL,
      attached_at  TEXT NOT NULL
    )
  `);

  yield* sql`CREATE INDEX IF NOT EXISTS idx_components_entity ON components (entity_id)`;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_components_entity_kind ON components (entity_id, kind)`;
});

/** Widen `components.kind` after Used/Generated landed. Idempotent. */
export const ensureComponentKindCheck = Effect.gen(function* () {
  const sql = yield* SqlClient;
  yield* sql`ALTER TABLE components DROP CONSTRAINT IF EXISTS components_kind_check`;
  yield* sql.unsafe(
    `ALTER TABLE components ADD CONSTRAINT components_kind_check CHECK (kind IN ${KIND_CHECK})`,
  );
});
