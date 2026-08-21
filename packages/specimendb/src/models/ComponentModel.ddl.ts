/**
 * Co-located DDL for {@link ComponentModel}. `entity_id`, not `specimen_id`.
 *
 * @module @tmnl/specimendb/models/ComponentModel.ddl
 */

import * as Effect from 'effect/Effect';
import { SqlClient } from 'effect/unstable/sql/SqlClient';

export const createComponentsTable = Effect.gen(function* () {
  const sql = yield* SqlClient;

  yield* sql`
    CREATE TABLE IF NOT EXISTS components (
      id           TEXT PRIMARY KEY,
      entity_id    TEXT NOT NULL REFERENCES entities(id),
      kind         TEXT NOT NULL CHECK (kind IN (
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
                     'W7'
                   )),
      payload      JSONB NOT NULL,
      attached_at  TEXT NOT NULL
    )
  `;

  yield* sql`CREATE INDEX IF NOT EXISTS idx_components_entity ON components (entity_id)`;
  yield* sql`CREATE INDEX IF NOT EXISTS idx_components_entity_kind ON components (entity_id, kind)`;
});
